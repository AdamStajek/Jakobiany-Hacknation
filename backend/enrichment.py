import os
import re
from datetime import UTC, date, datetime
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlsplit

from connectors.public import BZP, KINDS, FetchError, bzp_search, ted_search, ted_text
from intake import external, extract, save_risk
from store import (
    ACCEPTED,
    confidence,
    entries,
    evidence,
    find,
    fingerprint,
    identifier,
    now,
    project,
    put,
    put_project,
    ref,
    review_fields,
    revision,
    source,
    unique,
    values,
)


class NoticeText(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.parts = []
        self.feed(html)
        self.close()

    def handle_data(self, data):
        if data.strip():
            self.parts.append(data.strip())

    def handle_starttag(self, tag, attrs):
        if tag in {"div", "p", "br", "li", "tr", "h2", "h3", "h4"}:
            self.parts.append("\n")

    def plain(self):
        return re.sub(r"\s+", " ", " ".join(self.parts)).strip()


def words(text):
    return {
        word
        for word in re.findall(r"[^\W_]+", text.casefold())
        if len(word) > 2 and word not in {"dla", "oraz", "wraz", "gminy", "gminie"}
    }


def similarity(left, right):
    a, b = words(left), words(right)
    return len(a & b) / len(a | b) if a and b else 0.0


def plain_field(text, label):
    match = re.search(
        re.escape(label) + r"\s*(.*?)(?=\s*\d+\.\d+(?:\.\d+)?\.\s*\)|\s*SEKCJA\s|$)",
        text,
        re.I,
    )
    return match[1].strip() if match else ""


def valid_date(value):
    try:
        return date.fromisoformat(value[:10]).isoformat() if value else None
    except (TypeError, ValueError):
        return None


def timestamp(value):
    try:
        result = datetime.fromisoformat(value)
        return (
            result.astimezone(UTC).isoformat().replace("+00:00", "Z")
            if result.tzinfo
            else None
        )
    except (TypeError, ValueError):
        return None


def procure(db, value, provider, raw, url, exact, confirmed_keys):
    pid = value["id"]
    published_on = None
    if provider == "bzp":
        key, number = raw.get("objectId"), raw.get("noticeNumber")
        tender = raw.get("tenderId") or key
        title, buyer = raw.get("orderObject") or "", raw.get("organizationName") or ""
        number_field, title_field, buyer_field = (
            "noticeNumber",
            "orderObject",
            "organizationName",
        )
        kind = KINDS.get(raw.get("noticeType"), "other")
        published = timestamp(raw.get("publicationDate"))
        original = f"{BZP}/mo-board/api/v1/Board/GetNoticePdfById?noticeId={key}"
        buyer_id = re.sub(r"\D", "", str(raw.get("organizationNationalId") or ""))
    else:
        key = number = raw["publication-number"]
        tender = key
        title, buyer = (
            ted_text(raw.get("notice-title")),
            ted_text(raw.get("buyer-name")),
        )
        number_field, title_field, buyer_field = (
            "publication-number",
            "notice-title",
            "buyer-name",
        )
        kind = "other"
        published = timestamp(raw.get("publication-date"))
        published_on = valid_date(raw.get("publication-date"))
        original = f"https://ted.europa.eu/pl/notice/-/detail/{number}"
        buyer_id = ""
    if not key or not number:
        return None, "error", "Odpowiedź bez identyfikatora ogłoszenia."
    origin = source(
        db,
        provider,
        key,
        fingerprint(raw),
        raw=raw,
        original_url=original,
        name=title or number,
    )
    put(
        db,
        "fetch",
        {"id": identifier("fetch"), "source_id": origin["id"], "url": url, "at": now()},
        pid,
    )
    number_ev = evidence(
        db, pid, origin, {"kind": "record_field", "field": number_field}, number
    )
    title_ev = evidence(
        db, pid, origin, {"kind": "record_field", "field": title_field}, title
    )
    buyer_ev = evidence(
        db, pid, origin, {"kind": "record_field", "field": buyer_field}, buyer
    )
    proof = [number_ev["id"], title_ev["id"], buyer_ev["id"]]
    body = NoticeText(raw.get("htmlBody") or "").plain() if provider == "bzp" else ""
    kpo = any(
        item["scheme"] == "kpo"
        and item["normalized"] in re.sub(r"\s+", "", body).upper()
        for item in value["external_ids"]
    )
    by_id = {
        item["normalized"]
        for item in value.get("beneficiary", {}).get("identifiers", [])
        if item["scheme"] in {"nip", "regon"}
    }
    beneficiary = value.get("beneficiary", {}).get("name", "")
    name_score = similarity(beneficiary, buyer)
    title_score = similarity(value["title"], title)
    organization = (buyer_id in by_id) if buyer_id and by_id else name_score >= 0.5
    context = title_score >= 0.34 and (organization or not beneficiary)
    confirmed = tender in confirmed_keys or ((exact or kpo) and context)
    if confirmed:
        confirmed_keys.add(tender)
    proc_id = identifier("proc", pid, provider, tender)
    link_id = identifier("link", pid, proc_id)
    existing_link = find(db, "link", link_id)
    link = {
        **review_fields(link_id, "approved" if confirmed else "proposed"),
        "from": ref("project", pid),
        "to": ref("procedure", proc_id),
        "relation": "project_has_procedure",
        "method": "verified_identifier" if confirmed else "ranked",
        "confidence": confidence(
            "high" if confirmed else "low",
            "Ocena klucza, zamawiającego i przedmiotu zamówienia.",
        ),
        "rationale": "Identyfikator i kontekst są zgodne."
        if confirmed
        else "Dopasowanie wymaga sprawdzenia przez eksperta.",
        "evidence_ids": unique(value["evidence_ids"] + proof),
        "signals": [
            {
                "feature": "identifier",
                "direction": "supports" if exact or kpo or confirmed else "missing",
                "explanation": f"Numer ogłoszenia: {number}.",
            },
            {
                "feature": "buyer",
                "direction": "supports"
                if organization
                else ("contradicts" if buyer and beneficiary else "missing"),
                "explanation": f"Zamawiający w źródle: {buyer or 'brak'}. Odbiorca: {beneficiary or 'brak'}.",
            },
            {
                "feature": "title",
                "direction": "supports"
                if title_score >= 0.34
                else ("contradicts" if title else "missing"),
                "explanation": f"Podobieństwo słów w tytule: {title_score:.0%}.",
            },
        ],
    }
    if not existing_link or (
        existing_link[0]["revision"] == 1
        and existing_link[0]["review_status"] == "proposed"
        and confirmed
    ):
        if existing_link:
            revision(db, "link", existing_link[0], pid)
            link["revision"] = existing_link[0]["revision"] + 1
        put(db, "link", link, pid)
    else:
        link = existing_link[0]
    previous = find(db, "procedure", proc_id)
    procedure = (
        previous[0]
        if previous
        else {
            "id": proc_id,
            "title": title or value["title"],
            "parts": [],
            "notices": [],
            "contracts": [],
            "identifiers": [external("ocid", tender)]
            if provider == "bzp" and raw.get("tenderId")
            else [],
            "evidence_ids": proof,
            "status": "unknown",
        }
    )
    if buyer and not (previous and previous[2].get("edited")):
        procedure["buyer"] = {"name": buyer}
        if buyer_id:
            procedure["buyer"]["identifiers"] = [
                external("nip" if len(buyer_id) == 10 else "other", buyer_id)
            ]
    if provider == "bzp" and not (previous and previous[2].get("edited")):
        procedure["cpv_codes"] = unique(
            re.findall(r"\b\d{8}-\d\b", raw.get("cpvCode") or "")
        )
        if kind == "procurement" and procedure["status"] == "unknown":
            procedure["status"] = "open"
        if kind == "award" and raw.get("procedureResult") == "zawarcieUmowy":
            procedure["status"] = "awarded"
    procedure["evidence_ids"] = unique(procedure["evidence_ids"] + proof)
    put(
        db,
        "procedure",
        procedure,
        pid,
        **{**(previous[2] if previous else {}), "link_id": link_id},
    )
    notice_id = identifier("notice", pid, provider, key)
    notice = {
        "id": notice_id,
        "identifier": external(provider, number),
        "kind": kind,
        "source": origin,
        "evidence_ids": proof,
    }
    if published and ("+" in published[10:] or published.endswith("Z")):
        notice["published_at"] = published
    if body:
        body_ev = evidence(
            db, pid, origin, {"kind": "record_field", "field": "htmlBody.plain_text"}
        )
        parts = parse_contract(db, pid, proc_id, kind, raw, body, body_ev, notice_id)
        if parts:
            notice["part_ids"] = parts
    found_notice = find(db, "notice", notice_id)
    if not found_notice or not found_notice[2].get("edited"):
        put(
            db,
            "notice",
            notice,
            pid,
            procedure_id=proc_id,
            external_key=key,
            published_on=published_on,
        )
    if body and link["review_status"] in ACCEPTED:
        extract_notice_risks(db, value, notice, body, proc_id)
    return (
        origin,
        "matched" if link["review_status"] in ACCEPTED else "needs_review",
        link["rationale"],
    )


def extract_notice_risks(db, value, notice, body, proc_id):
    pid, kind, origin = value["id"], notice["kind"], notice["source"]
    risks = []
    # Terms and legal boilerplate can contain hypothetical triggers.
    if kind == "contract_change":
        reason = plain_field(body, "Przyczyny dokonania zmian umowy/umowy ramowej:")
        reason = reason or plain_field(body, "Przyczyny dokonania zmian umowy:")
        if reason:
            cause_ev = evidence(
                db,
                pid,
                origin,
                {"kind": "record_field", "field": "htmlBody.change_reason"},
                reason,
            )
            risks = extract(db, value, reason, cause_ev, observed=True)
            for risk in risks:
                if risk["revision"] == 1 and risk["kind"] == "OBSERVED_EVENT":
                    risk["causes"] = [
                        {
                            "status": "confirmed",
                            "description": reason,
                            "evidence_ids": [cause_ev["id"]],
                        }
                    ]
    elif kind == "contract_execution":
        for label in (
            "Czy umowę wykonano w pierwotnie określonym terminie:",
            "Czy umowa została wykonana należycie:",
        ):
            answer = plain_field(body, label)
            if re.match(r"nie\b", answer, re.I):
                event_ev = evidence(
                    db,
                    pid,
                    origin,
                    {"kind": "record_field", "field": f"htmlBody: {label}"},
                    answer,
                )
                risks.append(
                    save_risk(
                        db,
                        pid,
                        "R06" if "terminie" in label else "R09",
                        label[:-1],
                        f"{label} Nie",
                        event_ev,
                        True,
                    )
                )
    for risk in risks:
        if risk["revision"] == 1:
            risk["related_to"] = [
                ref("procedure", proc_id),
                ref("notice", notice["id"]),
            ]
            put(db, "risk", risk, pid)


def extract_linked_notices(db, value, proc_id):
    for notice, _, meta in entries(db, "notice", value["id"]):
        if meta.get("procedure_id") == proc_id:
            origin = find(db, "source", notice["source"]["id"])
            raw = origin[2].get("raw") if origin else None
            if raw and raw.get("htmlBody"):
                extract_notice_risks(
                    db, value, notice, NoticeText(raw["htmlBody"]).plain(), proc_id
                )


PART_MARKER = r"(?:Numer części\s*:?\s*|Część\s+(?:nr\s*)?)(\d+)\b"
AWARD_PART = r"Część\s+(\d+)\s+SEKCJA V\s"
INITIAL_AMOUNT = r"Wartość umowy(?:/umowy ramowej)?"


def notice_amount(text, pattern):
    match = re.search(
        pattern + r"\s*:\s*([\d \u00a0]+[,.]\d{2})\s*([A-Z]{3})\b", text, re.I
    )
    if match:
        return re.sub(r"\s", "", match[1]).replace(",", "."), match[2].upper()
    return None


def parse_contract(db, pid, proc_id, kind, raw, text, body_ev, notice_id):
    parts = {}
    matches = re.finditer(r"Część\s+(\d+)\s+4\.(?:2\.2|5\.1)\.", text, re.I)
    for match in matches:
        parts[match[1]] = {
            "id": identifier("part", proc_id, match[1]),
            "number": match[1],
            "evidence_ids": [body_ev["id"]],
        }
    for number in re.findall(PART_MARKER, text, re.I) if kind != "procurement" else []:
        parts.setdefault(
            number,
            {
                "id": identifier("part", proc_id, number),
                "number": number,
                "evidence_ids": [body_ev["id"]],
            },
        )
    block = re.split(AWARD_PART, text, flags=re.I) if kind == "award" else []
    if len(block) > 1:
        for index in range(1, len(block), 2):
            number, segment = block[index : index + 2]
            if re.search(r"zakończył[ao]? się zawarciem umowy", segment, re.I):
                parts.setdefault(
                    number,
                    {
                        "id": identifier("part", proc_id, number),
                        "number": number,
                        "evidence_ids": [body_ev["id"]],
                    },
                )["outcome"] = "awarded"
                save_contract(
                    db, pid, proc_id, kind, raw, segment, body_ev, notice_id, number
                )
            elif re.search(r"zakończył[ao]? się unieważnieniem", segment, re.I):
                parts.setdefault(
                    number,
                    {
                        "id": identifier("part", proc_id, number),
                        "number": number,
                        "evidence_ids": [body_ev["id"]],
                    },
                )["outcome"] = "cancelled"
    elif kind in {"award", "contract_change", "contract_execution"} and (
        kind != "award" or raw.get("procedureResult") == "zawarcieUmowy"
    ):
        number = next(iter(parts)) if kind == "award" and len(parts) == 1 else None
        linked = save_contract(
            db, pid, proc_id, kind, raw, text, body_ev, notice_id, number
        )
        if linked and linked.get("part_ids") and not parts:
            return linked["part_ids"]
    for value in parts.values():
        old = find(db, "part", value["id"])
        if old and old[2].get("edited"):
            continue
        put(db, "part", {**(old[0] if old else {}), **value}, pid, procedure_id=proc_id)
    return [value["id"] for value in parts.values()]


def add_observation(items, value):
    fields = {key: item for key, item in value.items() if key != "evidence_ids"}
    for item in items:
        if {
            key: field for key, field in item.items() if key != "evidence_ids"
        } == fields:
            item["evidence_ids"] = unique(item["evidence_ids"] + value["evidence_ids"])
            return
    items.append(value)


def save_contract(db, pid, proc_id, kind, raw, text, body_ev, notice_id, number):
    ev = [body_ev["id"]]
    contractors = raw.get("contractors") or []
    contractor = re.search(
        r"Nazwa \(firma\) wykonawcy[^:]*:\s*(.*?)(?=\s*\d+\.\d+(?:\.\d+)?\.\s*\)|$)",
        text,
        re.I,
    )
    name = contractor[1].strip() if contractor else ""
    if not name and isinstance(contractors, list) and len(contractors) == 1:
        name = contractors[0].get("contractorName") or ""
    signed = re.search(
        r"Data zawarcia (?:umowy/umowy ramowej|umowy)\s*:\s*(\d{4}-\d\d-\d\d)",
        text,
        re.I,
    )
    award_ref = re.search(
        r"Numer ogłoszenia o wyniku postępowania[^:]*:\s*(\d{4}/BZP \d{8}(?:/\d\d)?)",
        text,
        re.I,
    )
    stable = external(
        "bzp", award_ref[1] if award_ref else raw.get("noticeNumber", notice_id)
    )["normalized"]
    stable = re.sub(r"/\d\d$", "", stable)
    contract_id = identifier("contract", proc_id, stable, number)
    if award_ref and kind != "award":
        candidates = [
            (item, meta)
            for item, _, meta in entries(db, "contract", pid)
            if meta.get("award_number") == stable
            and meta.get("procedure_id") == proc_id
            and meta.get("has_award")
        ]
        initial = notice_amount(text, INITIAL_AMOUNT)
        if len(candidates) > 1:
            candidates = [
                (item, meta)
                for item, meta in candidates
                if (
                    initial
                    and any(
                        (amount["value"], amount["currency"]) == initial
                        for amount in item["amounts"]
                        if amount["kind"] == "contract_initial"
                    )
                )
                or (
                    name
                    and similarity(item.get("contractor", {}).get("name", ""), name)
                    == 1
                )
            ]
        if len(candidates) == 1:
            contract_id = candidates[0][0]["id"]
        else:
            contract_id = identifier("contract", proc_id, notice_id)
    old = find(db, "contract", contract_id)
    if old and old[2].get("edited"):
        return old[0]
    contract = (
        old[0]
        if old
        else {
            "id": contract_id,
            "basis": "notice_only",
            "amounts": [],
            "milestones": [],
            "changes": [],
            "evidence_ids": [],
        }
    )
    contract["evidence_ids"] = unique(contract["evidence_ids"] + ev)
    if name and (kind == "award" or not contract.get("contractor")):
        contract["contractor"] = {"name": name}
    if number:
        contract["part_ids"] = [identifier("part", proc_id, number)]
    scope = {
        "award": [("contract_initial", r"Wartość umowy(?:/umowy ramowej)?")],
        "contract_execution": [
            ("contract_initial", r"Wartość umowy"),
            (
                "final_payment",
                r"Łączna wartość wynagrodzenia wypłacona z tytułu zrealizowanej umowy",
            ),
        ],
        "contract_change": [],
    }
    for amount_kind, pattern in scope[kind]:
        match = re.search(
            pattern + r"\s*:\s*([\d \u00a0]+[,.]\d{2})\s*(PLN|EUR|USD)\b", text, re.I
        )
        if match:
            item = {
                "kind": amount_kind,
                "value": re.sub(r"\s", "", match[1]).replace(",", "."),
                "currency": match[2].upper(),
                "vat": "unknown",
                "evidence_ids": ev,
            }
            add_observation(contract["amounts"], item)
    dates = [("signed", valid_date(signed[1]) if signed else None)]
    baseline = re.search(
        r"Okres realizacji zamówienia albo umowy ramowej:\s*(?:od \d{4}-\d\d-\d\d\s+)?do\s+(\d{4}-\d\d-\d\d)",
        text,
        re.I,
    )
    actual = re.search(r"Termin wykonania umowy:\s*(\d{4}-\d\d-\d\d)", text, re.I)
    if baseline and kind == "award":
        dates.append(("baseline_finish", valid_date(baseline[1])))
    if actual and kind == "contract_execution":
        dates.append(("actual_finish", valid_date(actual[1])))
    for date_kind, day in dates:
        if day:
            item = {"kind": date_kind, "date": day, "evidence_ids": ev}
            add_observation(contract["milestones"], item)
    put(
        db,
        "contract",
        contract,
        pid,
        procedure_id=proc_id,
        award_number=stable,
        has_award=kind == "award" or (old and old[2].get("has_award")),
    )
    if kind == "contract_change":
        change_id = identifier("change", notice_id)
        old_change = find(db, "contract_change", change_id)
        if old_change and old_change[2].get("edited"):
            return
        explanation = plain_field(
            text, "Krótki opis zmiany umowy/umowy ramowej:"
        ) or plain_field(text, "Krótki opis zmiany umowy:")
        legal = plain_field(
            text, "Podstawa prawna zmiany umowy/umowy ramowej:"
        ) or plain_field(text, "Podstawa prawna zmiany umowy:")
        effective = re.search(r"Data zmiany [^:]+:\s*(\d{4}-\d\d-\d\d)", text, re.I)
        change = {
            "id": change_id,
            "description": explanation or "Zmiana opublikowana w BZP.",
            "dimensions": [],
            "evidence_ids": ev,
        }
        if legal:
            change["legal_basis"] = legal
        if effective and (day := valid_date(effective[1])):
            change["effective_on"] = day
        if re.search(r"zakres|robot", explanation, re.I):
            change["dimensions"].append("scope")
        if re.search(r"termin|harmonogram", explanation, re.I):
            change["dimensions"].append("schedule")
        if amount := re.search(
            r"Wartość zmiany:\s*([\d \u00a0]+[,.]\d{2})\s*.*?Kod waluty:\s*([A-Z]{3})\b",
            text,
        ):
            change["dimensions"].append("cost")
            change["amounts"] = [
                {
                    "kind": "contract_change",
                    "value": re.sub(r"\s", "", amount[1]).replace(",", "."),
                    "currency": amount[2],
                    "vat": "unknown",
                    "evidence_ids": ev,
                }
            ]
        if not change["dimensions"]:
            change["dimensions"] = ["other"]
        put(db, "contract_change", change, pid, contract_id=contract_id)
    return contract


def enrich(path, project_id, references):
    from store import connect

    with connect(path) as db:
        value = project(db, project_id)
        confirmed = {
            item["to"]["id"]
            for item in values(db, "link", project_id)
            if item["review_status"] in ACCEPTED
            and item["relation"] == "project_has_procedure"
            and item["to"]["type"] == "procedure"
        }
        known_notices = {}
        for notice, _, meta in entries(db, "notice", project_id):
            proc_id = meta.get("procedure_id")
            if (
                proc_id in confirmed
                and notice["kind"] == "procurement"
                and notice["identifier"]["scheme"] == "bzp"
            ):
                known_notices.setdefault(proc_id, notice["identifier"])
    refs = unique(
        (item["scheme"], item["value"])
        for item in value["external_ids"] + references + list(known_notices.values())
    )
    candidates = list(refs)
    for scheme, raw in refs:
        if scheme == "url":
            try:
                address = urlsplit(raw)
                if address.scheme == "https" and address.hostname == "ted.europa.eu":
                    if match := re.search(r"/(\d{1,8}-\d{4})(?=/|$)", address.path):
                        candidates.append(("ted", match[1]))
                if (
                    address.scheme == "https"
                    and address.hostname == "ezamowienia.gov.pl"
                ):
                    query = parse_qs(address.query)
                    candidates.extend(
                        ("bzp", number) for number in query.get("NoticeNumber", [])[:1]
                    )
            except ValueError:
                continue
    references = [external(scheme, raw) for scheme, raw in unique(candidates)]

    if os.getenv("RISK_MINER_OFFLINE") == "1" or not references:
        yield {
            "stage": "fetch",
            "status": "unmatched",
            "project_id": project_id,
            "message": "Pobieranie zewnętrzne wyłączone w konfiguracji."
            if references
            else "Projekt nie ma identyfikatorów źródłowych.",
        }
        return
    outcome, seen = set(), set()
    for provider, fetch in [("bzp", bzp_search), ("ted", ted_search)]:
        confirmed_keys = set()
        for entry in fetch(value, references):
            if isinstance(entry, FetchError):
                outcome.add("error")
                yield {
                    "stage": "fetch",
                    "status": "error",
                    "project_id": project_id,
                    "attempted_url": entry.url,
                    "attempted_at": now(),
                    "error": {"code": "source_error", "message": str(entry)},
                }
                continue
            url, raw, exact = entry
            key = (provider, raw.get("objectId") or raw.get("publication-number"))
            if key in seen:
                continue
            seen.add(key)
            with connect(path, write=True) as db:
                origin, status, message = procure(
                    db, value, provider, raw, url, exact, confirmed_keys
                )
            outcome.add(status)
            attempt = {
                "project_id": project_id,
                "attempted_at": now(),
                "attempted_url": url,
            }
            if origin:
                yield {
                    "stage": "fetch",
                    "status": "found",
                    "source_id": origin["id"],
                    **attempt,
                }
            yield {
                "stage": "link",
                "status": status,
                "message": message,
                **attempt,
                **({"source_id": origin["id"]} if origin else {}),
            }
    status = next(
        (item for item in ("matched", "needs_review", "error") if item in outcome),
        "unmatched",
    )
    if not outcome:
        yield {
            "stage": "link",
            "status": status,
            "project_id": project_id,
            "message": "Nie odnaleziono powiązanych ogłoszeń.",
        }
    with connect(path, write=True) as db:
        current = project(db, project_id)
        link_statuses = {
            item["review_status"] for item in values(db, "link", project_id)
        }
        current["enrichment_status"] = (
            "matched"
            if link_statuses & ACCEPTED
            else "needs_review"
            if link_statuses & {"proposed", "needs_evidence"}
            else status
            if status != "needs_review"
            else "unmatched"
        )
        put_project(db, current)
