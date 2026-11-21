"""Associate public records with a selected project and preserve the proof."""

import os
import re
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

from connectors.materials import (
    PLATFORMS,
    PROCUREMENT,
    allowed,
    document_type,
    page_materials,
)
from connectors.public import FetchError
from connectors.registers import BDL_CODES, bdl, krs, regon
from intake import media_type, save_document
from reference_data import FUNDING_ID, key_for, reference
from store import (
    ACCEPTED,
    Problem,
    confidence,
    connect,
    dump,
    entries,
    evidence,
    find,
    fingerprint,
    identifier,
    now,
    project,
    put,
    ref,
    review_fields,
    source,
    unique,
    values,
)

KIO_HOST = {"orzeczenia.uzp.gov.pl"}
PATTERNS = {
    "bdl": r"\d{12}",
    "teryt": r"\d{2}(?:\d{2}(?:\d{3})?)?",
    "kposk": r"PL[A-Z]{2}\d{3,4}[A-Z]{0,2}",
    "prices": r"20\d{2}-(0[1-9]|1[0-2])",
    "krs": r"\d{1,10}",
    "regon": r"\d{9,10}|\d{14}",
}


def bip_hosts():
    # Deployments supply exact local BIP hosts when they are outside the national portal.
    return {
        "www.gov.pl",
        "gov.pl",
        *filter(None, os.getenv("RISK_MINER_BIP_HOSTS", "").lower().split()),
    }


def validate_query(provider, query):
    value = query.strip()
    if provider in PATTERNS:
        if re.fullmatch(PATTERNS[provider], value.upper()):
            return value.zfill(10) if provider == "krs" else value.upper()
    elif provider == "funding":
        if not value or FUNDING_ID.fullmatch(value):
            return key_for(value)
    elif provider == "procurement":
        if (
            not value
            or allowed(value, PLATFORMS)
            and (
                PROCUREMENT.fullmatch(value)
                or re.fullmatch(
                    r"/mp-readmodels/api/Tender/DownloadDocument/[\w-]+/[\w-]+",
                    urlsplit(value).path,
                )
                or re.fullmatch(
                    r"/file/get_new/[\da-f]+\.(?:docx?|pdf)", urlsplit(value).path, re.I
                )
            )
        ):
            return value
    elif provider == "bip" and allowed(value, bip_hosts()):
        return value
    elif (
        provider == "kio"
        and allowed(value, KIO_HOST)
        and re.fullmatch(r"/Home/Details/\d+", urlsplit(value).path, re.I)
    ):
        return value
    raise Problem(
        422,
        "source_query_invalid",
        "Podaj prawidłowy identyfikator lub adres dla wybranego źródła.",
    )


def public_fact(
    db, pid, provider, key, label, data, origin, locator, *, query=None, exact=False
):
    rid = identifier(
        "fact", "public", pid, provider, key, origin["id"], fingerprint(data)
    )
    if find(db, "fact", rid):
        return rid
    quote = data.get("fragment") or dump(data)
    proof = evidence(db, pid, origin, locator, quote[:32768])
    put(
        db,
        "fact",
        {
            **review_fields(rid, "approved" if exact else "proposed"),
            "subject": ref("project", pid),
            "key": f"source.{provider}",
            "value": data,
            "claim_type": "SOURCE_FACT",
            "confidence": confidence(
                "high" if exact else "moderate",
                "Identyfikator projektu zgodny z publikacją."
                if exact
                else "Wynik odczytu źródła dla wskazanego identyfikatora lub adresu. Powiązanie wymaga weryfikacji.",
            ),
            "evidence_ids": [proof["id"]],
        },
        pid,
        provider=provider,
        label=label,
        query=query,
        source=origin,
        external_key=key,
    )
    return rid


def from_reference(db, pid, data, exact=False):
    locator = data["locator"]
    if locator["kind"] == "pdf_page":
        locator = {"kind": "public_pdf", "page": locator["page"]}
    return public_fact(
        db,
        pid,
        data["provider"],
        data["key"],
        data["label"],
        data["value"],
        data["source"],
        locator,
        exact=exact,
    )


def attach_funding(db, value):
    found = []
    for entry in value["external_ids"]:
        if entry["scheme"] in {"kpo", "cst"}:
            item = reference(db, "funding", key_for(entry["value"]))
            if item:
                buyer = " ".join(
                    value.get("beneficiary", {}).get("name", "").casefold().split()
                )
                text = " ".join(dump(item["value"]).casefold().split())
                from_reference(
                    db, value["id"], item, exact=bool(buyer and buyer in text)
                )
                found.append(item["source"]["id"])
    return found


def source_records(db, pid):
    result = []
    keys = set()
    records = sorted(
        entries(db, "fact", pid),
        key=lambda row: row[2].get("source", {}).get("retrieved_at", ""),
        reverse=True,
    )
    for fact, _, meta in records:
        if not meta.get("provider"):
            continue
        key = (meta["provider"], meta["external_key"])
        if key in keys:
            continue
        keys.add(key)
        result.append(
            {
                "id": fact["id"],
                "label": meta["label"],
                "source": meta["source"],
                "value": fact["value"],
                "evidence_ids": fact["evidence_ids"],
                "review_status": fact["review_status"],
            }
        )
    return result


def procurement_urls(db, pid):
    confirmed = {
        item["to"]["id"]
        for item in values(db, "link", pid)
        if item["review_status"] in ACCEPTED
        and item["relation"] == "project_has_procedure"
    }
    urls = {}
    for notice, _, meta in entries(db, "notice", pid):
        procedure_id = meta.get("procedure_id")
        if notice["kind"] != "procurement" or procedure_id not in confirmed:
            continue
        origin = find(db, "source", notice["source"]["id"])
        html = (origin[2].get("raw") or {}).get("htmlBody", "") if origin else ""
        for link in PROCUREMENT.findall(html):
            urls.setdefault(link, procedure_id)
    return urls


def fetch_materials(path, pid, provider, urls, extract_version):
    hosts = {"procurement": PLATFORMS, "bip": bip_hosts(), "kio": KIO_HOST}[provider]
    for url, procedure_id in list(urls.items())[:4]:
        try:
            for item in page_materials(
                url, hosts, procurement=provider == "procurement"
            ):
                if isinstance(item, FetchError):
                    yield source_error(pid, item)
                    continue
                address, name, content = item
                if not name:
                    if not content:
                        continue
                    signature = re.search(r"\bKIO\s+\d{1,5}/\d{2}\b", content)
                    label = (
                        signature[0]
                        if provider == "kio" and signature
                        else (
                            "Publikacja BIP" if provider == "bip" else "Orzeczenie KIO"
                        )
                    )
                    with connect(path, write=True) as db:
                        origin = source(
                            db,
                            provider,
                            address,
                            fingerprint(content),
                            pid,
                            original_url=address,
                            name=label,
                        )
                        public_fact(
                            db,
                            pid,
                            provider,
                            address,
                            label,
                            {"fragment": content},
                            origin,
                            {"kind": "record_field", "field": "Treść strony"},
                        )
                    yield report(
                        pid, "found", f"Zapisano treść strony: {label}", origin["id"]
                    )
                    continue
                try:
                    media = media_type(name, content)
                except Problem as exc:
                    yield source_error(pid, FetchError(address, exc.data["message"]))
                    continue
                kind = "kio_decision" if provider == "kio" else document_type(name)
                with connect(path, write=True) as db:
                    doc_id = identifier("doc", pid, address)
                    version_id = save_document(
                        db,
                        pid,
                        name,
                        content,
                        media,
                        doc_id,
                        kind,
                        remote=(provider, address),
                    )
                    if procedure_id:
                        doc = find(db, "document", doc_id)[0]
                        relation = ref("procedure", procedure_id)
                        if relation not in doc["related_to"]:
                            doc["related_to"].append(relation)
                            put(db, "document", doc, pid)
                    origin_id = find(db, "document_version", version_id)[0]["source"][
                        "id"
                    ]
                error, model_error = extract_version(path, pid, version_id)
                yield report(pid, "found", f"Zapisano dokument: {name}", origin_id)
                if error or model_error:
                    yield source_error(
                        pid,
                        FetchError(address, error["message"] if error else model_error),
                    )
        except FetchError as exc:
            yield source_error(pid, exc)


def report(pid, status, message, origin=None):
    return {
        "stage": "fetch",
        "status": status,
        "project_id": pid,
        "message": message,
        **({"source_id": origin} if origin else {}),
    }


def source_error(pid, exc):
    return {
        "stage": "fetch",
        "status": "error",
        "project_id": pid,
        "attempted_url": exc.url,
        "attempted_at": now(),
        "error": {"code": "source_error", "message": str(exc)},
    }


def fetch_source(path, pid, provider, query, extract_version):
    core = {"funding", "teryt", "kposk", "prices"}
    if provider in core | {"bdl"}:
        with connect(path, write=True) as db:
            if provider == "funding" and not query:
                sources = attach_funding(db, project(db, pid))
            else:
                variants = {"prices": ("ogolem", "inzynieria"), "bdl": BDL_CODES}
                keys = (
                    [f"{query}:{name}" for name in variants[provider]]
                    if provider in variants
                    else [query]
                )
                sources = []
                for key in keys:
                    if data := reference(db, provider, key):
                        from_reference(db, pid, data)
                        sources.append(data["source"]["id"])
        for origin in unique(sources):
            yield report(pid, "found", "Dołączono rekord z bazy referencyjnej.", origin)
        if sources or provider in core:
            return
    if os.getenv("RISK_MINER_OFFLINE") == "1":
        yield report(pid, "unmatched", "Pobieranie zewnętrzne jest wyłączone.")
        return

    if provider in {"procurement", "bip", "kio"}:
        with connect(path) as db:
            urls = {query: None} if query else procurement_urls(db, pid)
        yield from fetch_materials(path, pid, provider, urls, extract_version)
        return

    with connect(path) as db:
        valid_after = (datetime.now(UTC) - timedelta(hours=24)).isoformat()
        cached = next(
            (
                meta
                for _, _, meta in entries(db, "fact", pid)
                if meta.get("provider") == provider
                and meta.get("query") == query
                and meta["source"]["retrieved_at"] >= valid_after
            ),
            None,
        )
    if cached:
        yield report(
            pid, "found", "Użyto aktualnego zapisu źródła.", cached["source"]["id"]
        )
        return
    try:
        if provider == "bdl":
            records = list(bdl(query, BDL_CODES))
        else:
            data = (krs if provider == "krs" else regon)(query)
            records = [(query, *data)] if data else []
    except FetchError as exc:
        yield source_error(pid, exc)
        return
    for key, url, label, value in records:
        with connect(path, write=True) as db:
            origin = source(
                db, provider, key, fingerprint(value), original_url=url, name=label
            )
            public_fact(
                db,
                pid,
                provider,
                key,
                label,
                value,
                origin,
                {"kind": "record_field", "field": key},
                query=query,
            )
        yield report(pid, "found", f"Zapisano: {label}", origin["id"])
