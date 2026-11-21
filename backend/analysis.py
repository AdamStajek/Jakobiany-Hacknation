import re
from datetime import date
from decimal import Decimal

from domain import (
    active_rules,
    evidence_records,
    export_row,
    grounded_ids,
    project_detail,
)
from enrichment import similarity
from intake import CHECKS, infer_subsectors
from store import (
    ACCEPTED,
    Problem,
    confidence,
    entries,
    evidence,
    find,
    fingerprint,
    identifier,
    now,
    project,
    projects,
    put,
    record,
    ref,
    review_fields,
    source,
    unique,
    values,
)

METHOD = "rules-and-weighted-features/1"
STATE_COVERAGE = {
    "confirmed": 1,
    "confirmed_not_done": 1,
    "partially_confirmed": 0.5,
    "missing_from_package": 0,
    "not_addressed": 0,
    "conflicting_sources": 0,
    "not_applicable": None,
}
SIGNALS = {code: pattern for code, _, _, _, pattern in CHECKS}


def ready_versions(db, project_id, actor, requested):
    selected = (
        requested
        if requested is not None
        else [
            item["current_version_id"]
            for item in values(db, "document", project_id)
            if item.get("current_version_id")
        ]
    )
    result = []
    for version_id in selected:
        value, owner_project, meta = record(db, "document_version", version_id, actor)
        if owner_project != project_id:
            raise Problem(404, "not_found", "Wersja nie należy do projektu.")
        if value["extraction_status"] != "ready":
            raise Problem(
                409,
                "document_not_ready",
                "Wybrana wersja dokumentu nie ma gotowej ekstrakcji.",
            )
        result.append({"version": value, "evidence_ids": meta.get("evidence_ids", [])})
    return result


def prepare(db, actor, project_id, requested):
    value = project(db, project_id, actor)
    if value["kind"] != "planned":
        raise Problem(
            422, "planned_project_required", "Analiza wymaga projektu planowanego."
        )
    selected = ready_versions(db, project_id, actor, requested)
    inputs = [
        record(db, "evidence", key, actor)[0]
        for key in unique(value["evidence_ids"] + grounded_ids(selected))
    ]
    if not any(item.get("quote", "").strip() for item in inputs):
        raise Problem(
            422,
            "insufficient_input",
            "Dodaj opis lub dokument z gotową warstwą tekstową.",
            [
                {
                    "field": "description",
                    "message": "Opisz cel inwestycji, zakres robót i obszar obsługi.",
                },
                {
                    "field": "document_version_ids",
                    "message": "Dołącz gotowy PDF lub DOCX, np. koncepcję albo PFU.",
                },
            ],
        )
    rules = active_rules(db, value.get("sector_code", "water_and_sewerage"))
    if rules is None:
        raise Problem(
            409,
            "sector_rules_unavailable",
            "Brak zatwierdzonych reguł dla sektora projektu.",
        )
    as_of = now()
    rules_source = source(
        db,
        "sector_rules",
        rules["id"],
        rules["revision"],
        raw=rules,
        name=rules["description"],
    )
    version_ids = [entry["version"]["id"] for entry in selected]
    package_fields = {
        "project_revision": value["revision"],
        "document_version_ids": version_ids,
    }
    revision_source = source(
        db,
        "assessment_input",
        project_id,
        fingerprint(package_fields),
        project_id,
        raw=package_fields,
    )
    package = evidence(
        db,
        project_id,
        revision_source,
        {"kind": "record_field", "field": "document_version_ids"},
    )
    checks = {}
    text = "\n".join(item.get("quote", "") for item in inputs)
    subsectors = value.get("primary_subsector_codes") or infer_subsectors(
        value["title"] + "\n" + text
    )
    for checklist in rules["checklists"]:
        if checklist["subsector_code"] in subsectors and checklist[
            "phase"
        ] == value.get("phase", "planning"):
            for item in checklist["requirements"]:
                checks[item["code"]] = {
                    "requirement": item,
                    "evidence": evidence(
                        db,
                        project_id,
                        rules_source,
                        {
                            "kind": "record_field",
                            "field": f"checklists.{checklist['subsector_code']}.{checklist['phase']}.{item['code']}",
                        },
                    )["id"],
                }
    input_ids = {item["id"] for item in inputs}
    documents = set(version_ids)
    catalog = {item["code"] for item in rules["risk_categories"]}

    def applicable(proofs):
        return all(
            item["id"] in input_ids
            or item.get("document_version_id") in documents
            or (
                item["source"]["provider"] not in {"user_description", "uploaded_file"}
                and "document_version_id" not in item
            )
            for key in proofs
            for item in [record(db, "evidence", key, actor)[0]]
        )

    facts = [
        item
        for item in values(db, "fact", project_id)
        if item["review_status"] in ACCEPTED and applicable(item["evidence_ids"])
    ]
    risks = [
        risk
        for risk in values(db, "risk", project_id)
        if risk["kind"] == "POTENTIAL_RISK"
        and risk["review_status"] in ACCEPTED | {"proposed"}
        and risk["risk_code"] in catalog
        and risk["evidence_ids"]
        and applicable(risk["evidence_ids"])
    ]
    approved_codes = {
        item["risk_code"] for item in risks if item["review_status"] in ACCEPTED
    }
    risks = [
        item
        for item in risks
        if item["review_status"] in ACCEPTED or item["risk_code"] not in approved_codes
    ]
    recommendations = [
        item
        for item, _, meta in entries(db, "recommendation", project_id)
        if item["review_status"] in ACCEPTED
        and not meta.get("assessment_id")
        and applicable(item["evidence_ids"])
    ]
    corpus = []
    for candidate in projects(db, actor):
        if (
            candidate["kind"] == "historical"
            and candidate["status"] == "completed"
            and candidate.get("sector_code", "water_and_sewerage")
            == value.get("sector_code", "water_and_sewerage")
            and candidate["evidence_ids"]
        ):
            candidate = project_detail(db, candidate["id"], actor)
            approved = [
                item
                for item in values(db, "fact", candidate["id"])
                if item["review_status"] in ACCEPTED
            ]
            for document in candidate["documents"]:
                for version in document["versions"]:
                    if (
                        version["id"] == document.get("current_version_id")
                        and version["extraction_status"] == "ready"
                    ):
                        meta = record(db, "document_version", version["id"], actor)[2]
                        proofs = [
                            record(db, "evidence", key, actor)[0]
                            for key in meta.get("evidence_ids", [])
                        ]
                        approved.extend(
                            {
                                "key": "source_text",
                                "value": item["quote"],
                                "evidence_ids": [item["id"]],
                            }
                            for item in proofs
                            if "quote" in item
                        )
            history = [
                item
                for item in values(db, "risk", candidate["id"])
                if item["kind"] == "OBSERVED_EVENT"
                and item["review_status"] in ACCEPTED
                and item["evidence_ids"]
            ]
            visible_procedures = {item["id"] for item in candidate["procedures"]}
            history = [
                risk
                for risk in history
                if all(
                    item["type"] != "procedure" or item["id"] in visible_procedures
                    for item in risk.get("related_to", [])
                )
            ]
            corpus.append({"project": candidate, "facts": approved, "risks": history})
    return {
        "project": value,
        "snapshot": {
            "project_revision": value["revision"],
            "document_version_ids": version_ids,
            "sector_rules_id": rules["id"],
            "sector_rules_revision": rules["revision"],
            "method_version": METHOD,
            "knowledge_as_of": as_of,
        },
        "subsectors": subsectors,
        "inputs": inputs,
        "facts": facts,
        "selected": selected,
        "rules": rules,
        "package": package,
        "checks": checks,
        "risks": risks,
        "recommendations": recommendations,
        "corpus": corpus,
    }


def gap_state(requirement, inputs, facts, selected):
    code = requirement["code"]
    findings = []
    for fact in facts:
        if fact["key"] in {code, "check." + code} and fact["evidence_ids"]:
            value = fact["value"]
            state = value.get("state") if isinstance(value, dict) else "confirmed"
            if state in STATE_COVERAGE:
                findings.append((state, fact["evidence_ids"]))
    if findings:
        states = {state for state, _ in findings}
        return next(iter(states)) if len(
            states
        ) == 1 else "conflicting_sources", unique(
            key for _, keys in findings for key in keys
        )
    if pattern := SIGNALS.get(code):
        seen = [
            item["id"]
            for item in inputs
            if re.search(pattern, item.get("quote", ""), re.I)
        ]
        if seen:
            return "partially_confirmed", seen
    return ("not_addressed" if selected else "missing_from_package"), []


def numeric_features(text):
    meters = []
    for value, unit in re.findall(r"\b(\d+(?:[,.]\d+)?)\s*(km|mb?)(?!\w)", text, re.I):
        meters.append(
            Decimal(value.replace(",", ".")) * (1000 if unit.lower() == "km" else 1)
        )
    return {str(item.normalize()) for item in meters}


def comparison_contracts(value):
    part_number = value.get("seed_scope", {}).get("part_number")
    contracts = []
    for procedure in value["procedures"]:
        if part_number is None:
            contracts.extend(procedure["contracts"])
        else:
            matched_parts = {
                part["id"]
                for part in procedure["parts"]
                if part["number"] == part_number
            }
            contracts.extend(
                item
                for item in procedure["contracts"]
                if matched_parts.intersection(item.get("part_ids", []))
            )
    return contracts


def compare(data, example):
    value = data["project"]
    other = example["project"]
    current_text = (
        value["title"]
        + "\n"
        + "\n".join(item.get("quote", "") for item in data["inputs"])
    )
    other_text = (
        other["title"]
        + "\n"
        + other.get("description", "")
        + "\n"
        + "\n".join(
            str(item["value"])
            for item in example["facts"]
            if item["key"] == "source_text"
        )
    )
    other_proof = unique(other["evidence_ids"] + grounded_ids(example["facts"]))
    current_proof = [item["id"] for item in data["inputs"]]
    features = {
        "subsector": (
            data["subsectors"],
            other.get("primary_subsector_codes"),
            "Podsektory",
        ),
        "work_type": (value.get("work_type"), other.get("work_type"), "Rodzaj prac"),
        "technical": (
            numeric_features(current_text),
            numeric_features(other_text),
            "Długości w metrach",
        ),
        "text": (current_text, other_text, "Wspólne słowa opisu i dokumentów"),
    }
    for feature in ("function", "organization", "cost", "schedule", "location"):
        left = next(
            (
                item
                for item in data["facts"]
                if item["key"] == feature and item["evidence_ids"]
            ),
            None,
        )
        right = next(
            (
                item
                for item in example["facts"]
                if item["key"] == feature and item["evidence_ids"]
            ),
            None,
        )
        if left and right:
            features[feature] = (left["value"], right["value"], feature)
            current_proof = unique(current_proof + left["evidence_ids"])
            other_proof = unique(other_proof + right["evidence_ids"])
    compared, missing = [], []
    total = score = 0.0
    proof = unique(current_proof + other_proof)
    for feature, weight in data["rules"]["comparison_weights"].items():
        if not weight:
            continue
        left, right, label = features.get(feature, (None, None, ""))
        if not left or not right:
            missing.append(feature)
            continue
        if feature == "text":
            metric = similarity(left, right)
            explanation = f"{label}: zgodność słownikowa {metric:.0%}."
        elif (
            isinstance(left, (list, set))
            and isinstance(right, (list, set))
            and feature in {"subsector", "technical"}
        ):
            metric = len(set(left) & set(right)) / len(set(left) | set(right))
            explanation = (
                f"{label}: {', '.join(sorted(left))} / {', '.join(sorted(right))}."
            )
        else:
            metric = float(left == right)
            explanation = f"{label}: {left} / {right}."
        total += weight
        score += weight * metric
        compared.append(
            {
                "feature": feature,
                "direction": "similar" if metric >= 0.25 else "different",
                "explanation": explanation,
                "evidence_ids": proof,
            }
        )
    if not total:
        return None
    contracts = comparison_contracts(other)
    return {
        "project_id": other["id"],
        "score": score / total,
        "compared_features": compared,
        "missing_features": missing,
        "related_event_ids": [item["id"] for item in example["risks"]],
        "evidence_ids": proof,
        "comparable_amounts": other["amounts"]
        + [amount for item in contracts for amount in item["amounts"]],
        "comparable_milestones": other["milestones"]
        + [milestone for item in contracts for milestone in item["milestones"]],
        "explanation": " ".join(item["explanation"] for item in compared),
    }


def unique_observation(items, kind, fields):
    candidates = [
        item for item in items if item["kind"] == kind and item["evidence_ids"]
    ]
    if len({tuple(item.get(key) for key in fields) for item in candidates}) == 1:
        return candidates[0]
    return None


def deviation(samples, dimension):
    observations, proofs = [], []
    cost = dimension == "cost"
    for item in samples:
        contracts = comparison_contracts(item)
        # Contract values can only be paired inside one contract. Project-level milestones have an independent scope.
        if cost and len(contracts) != 1:
            continue
        if not cost and not item["milestones"] and len(contracts) != 1:
            continue
        if cost:
            keys = ("value", "currency", "vat", "as_of")
            before = unique_observation(
                contracts[0]["amounts"], "contract_initial", keys
            )
            after = unique_observation(contracts[0]["amounts"], "final_payment", keys)
            if (
                not before
                or not after
                or before["vat"] == "unknown"
                or any(before[key] != after[key] for key in ("currency", "vat"))
                or Decimal(before["value"]) <= 0
            ):
                continue
            observations.append(
                (Decimal(after["value"]) / Decimal(before["value"]) - 1) * 100
            )
        else:
            records = item["milestones"] or contracts[0]["milestones"]
            before = unique_observation(records, "baseline_finish", ("date",))
            after = unique_observation(records, "actual_finish", ("date",))
            if not before or not after:
                continue
            observations.append(
                (
                    date.fromisoformat(after["date"])
                    - date.fromisoformat(before["date"])
                ).days
            )
        proofs.extend(before["evidence_ids"] + after["evidence_ids"])
    enough = len(observations) >= 3
    result = {
        "status": "estimated" if enough else "insufficient_evidence",
        "sample_size": len(observations),
        "missing_data_fraction": 1 - len(observations) / len(samples)
        if samples
        else None,
        "confidence": confidence(
            "low" if enough else "insufficient_evidence",
            "Zakres empiryczny próby."
            if enough
            else "Potrzeba co najmniej trzech porównywalnych przypadków.",
        ),
        "evidence_ids": unique(proofs),
    }
    if enough:
        result["interval"] = {
            "lower": format(min(observations), ".2f")
            if cost
            else str(min(observations)),
            "upper": format(max(observations), ".2f")
            if cost
            else str(max(observations)),
            "unit": "percent" if cost else "days",
            "methodology": (
                "Min–max procentowej zmiany nominalnej w obrębie każdego kontraktu. Wymagana zgodna waluta i znane rozliczenie VAT. Brak indeksacji między latami."
                if cost
                else "Min–max różnicy między pierwotnym i rzeczywistym terminem zakończenia w dniach."
            )
            + " Minimum trzy projekty z porównywalnymi danymi.",
        }
    return result


def evaluate(db, assessment_id, actor, data):
    value = data["project"]
    project_id = value["id"]
    checks, recommendations = [], data["recommendations"][:]
    risks = data["risks"][:]
    for entry in data["checks"].values():
        requirement = entry["requirement"]
        state, proofs = gap_state(
            requirement, data["inputs"], data["facts"], data["selected"]
        )
        check_id = identifier("gap", assessment_id, requirement["code"])
        expected = (
            " lub ".join(requirement.get("expected_evidence", []))
            or requirement["question"]
        )
        explanation = {
            "confirmed": "Zatwierdzony dowód potwierdza informację.",
            "confirmed_not_done": "Zatwierdzony dowód potwierdza niewykonanie.",
            "partially_confirmed": "W materiale znaleziono wzmiankę dotyczącą pytania.",
            "missing_from_package": "W pakiecie brakuje dokumentu potwierdzającego tę informację.",
            "not_addressed": "W sprawdzonych materiałach brakuje potwierdzenia tej informacji.",
            "conflicting_sources": "Zatwierdzone ustalenia wskazują sprzeczne stany informacji.",
            "not_applicable": "Zatwierdzony zapis wskazuje brak zastosowania.",
        }[state]
        checks.append(
            {
                "id": check_id,
                "requirement": requirement,
                "state": state,
                "coverage": STATE_COVERAGE[state],
                "explanation": explanation,
                "evidence_ids": proofs,
            }
        )
        if STATE_COVERAGE[state] in (0, 0.5):
            references = unique(proofs + [entry["evidence"], data["package"]["id"]])
            checks[-1]["requested_information"] = expected
            checks[-1]["evidence_ids"] = references
            recommendations.append(
                {
                    **review_fields(identifier("rec", check_id)),
                    "claim_type": "MODEL_INFERENCE",
                    "kind": "provide_information",
                    "action": f"Uzupełnij: {expected}",
                    "rationale": requirement["rationale"],
                    "confidence": confidence(
                        "moderate",
                        "Wymaganie z zatwierdzonej checklisty i sprawdzony pakiet.",
                    ),
                    "related_to": [ref("gap", check_id)],
                    "evidence_ids": references,
                }
            )
    approved_codes = {item["risk_code"] for item in risks}
    for check in checks:
        if check["state"] not in {"confirmed_not_done", "conflicting_sources"}:
            continue
        for code in check["requirement"]["risk_codes"]:
            if code in approved_codes:
                continue
            risks.append(
                {
                    **review_fields(
                        identifier("risk", assessment_id, check["id"], code)
                    ),
                    "project_id": project_id,
                    "kind": "POTENTIAL_RISK",
                    "risk_code": code,
                    "title": check["requirement"]["question"],
                    "signal": check["explanation"],
                    "event": check["requirement"]["rationale"],
                    "causes": [],
                    "impacts": [],
                    "measures": [],
                    "claim_type": "MODEL_INFERENCE",
                    "confidence": confidence(
                        "moderate", "Sygnał z zatwierdzonego ustalenia."
                    ),
                    "evidence_ids": check["evidence_ids"],
                    "related_to": [ref("gap", check["id"])],
                }
            )
    # Sector conditions can cite a checklist state by code or a literal phrase in the selected inputs.
    for rule in data["rules"]["rules"]:
        condition = rule["condition"]
        selector = re.fullmatch(r"([a-z_]+)\s*=\s*([a-z_]+)", condition)
        refs = [
            item["id"]
            for item in data["inputs"]
            if condition and condition.casefold() in item.get("quote", "").casefold()
        ]
        if selector:
            refs = [
                key
                for gap in checks
                if gap["requirement"]["code"] == selector[1]
                and gap["state"] == selector[2]
                for key in gap["evidence_ids"]
            ]
        if not refs:
            continue
        for code in rule["risk_codes"]:
            key = identifier("risk", assessment_id, rule["id"], code)
            risks.append(
                {
                    **review_fields(key),
                    "project_id": project_id,
                    "kind": "POTENTIAL_RISK",
                    "risk_code": code,
                    "title": rule["consequence"],
                    "signal": condition,
                    "event": rule["consequence"],
                    "causes": [],
                    "impacts": [],
                    "measures": [],
                    "claim_type": "MODEL_INFERENCE",
                    "confidence": confidence(
                        "moderate", "Zadziałał warunek zatwierdzonej reguły sektorowej."
                    ),
                    "evidence_ids": unique(refs),
                    "related_to": [ref("project", project_id)],
                }
            )
            if rule.get("suggested_action"):
                recommendations.append(
                    {
                        **review_fields(identifier("rec", key)),
                        "claim_type": "MODEL_INFERENCE",
                        "kind": "mitigate",
                        "action": rule["suggested_action"],
                        "rationale": rule["consequence"],
                        "confidence": risks[-1]["confidence"],
                        "related_to": [ref("risk", key)],
                        "evidence_ids": unique(refs),
                    }
                )
    for risk in risks:
        if not find(db, "risk", risk["id"]):
            put(db, "risk", risk, project_id)
    applicable = [item for item in checks if item["coverage"] is not None]
    total = sum(item["requirement"]["weight"] for item in applicable)
    if total:
        for item in applicable:
            item["potential_completeness_gain"] = (
                (1 - item["coverage"]) * item["requirement"]["weight"] / total
            )
    twins = sorted(
        (
            result
            for example in data["corpus"]
            if (result := compare(data, example)) is not None
        ),
        key=lambda item: (-item["score"], item["project_id"]),
    )
    comparable = {item["project_id"] for item in twins if item["score"] >= 0.35}
    matching = [
        example["project"]
        for example in data["corpus"]
        if example["project"]["id"] in comparable
    ]
    relevant_codes = {item["risk_code"] for item in risks}
    relevant_codes.update(
        code
        for gap in checks
        if gap["coverage"] in (0, 0.5)
        for code in gap["requirement"]["risk_codes"]
    )
    corpus = {example["project"]["id"]: example for example in data["corpus"]}
    for twin in twins[:3]:
        if twin["project_id"] not in comparable:
            continue
        for event in corpus[twin["project_id"]]["risks"]:
            code = event["risk_code"]
            if code not in relevant_codes:
                continue
            relevant_codes.remove(code)
            measure = next(
                (
                    item
                    for item in event["measures"]
                    if item["evidence_ids"]
                    and item.get("effectiveness") in {"effective", "partly_effective"}
                    and item["kind"] == "applied"
                ),
                None,
            )
            recommendations.append(
                {
                    **review_fields(identifier("rec", assessment_id, event["id"])),
                    "claim_type": "MODEL_INFERENCE",
                    "kind": "mitigate" if measure else "investigate",
                    "action": f"Rozważ działanie: {measure['description']}"
                    if measure
                    else f"Sprawdź narażenie na zdarzenie: {event['title']}",
                    "rationale": f"Zatwierdzone zdarzenie w porównywalnej inwestycji {twin['project_id']}.",
                    "confidence": confidence(
                        "low", "Analogia do zatwierdzonego przypadku historycznego."
                    ),
                    "related_to": [ref("risk", event["id"])],
                    "evidence_ids": unique(
                        event["evidence_ids"]
                        + (measure["evidence_ids"] if measure else [])
                    ),
                }
            )
    for recommendation in recommendations:
        if find(db, "recommendation", recommendation["id"]):
            continue
        put(
            db,
            "recommendation",
            recommendation,
            project_id,
            assessment_id=assessment_id,
        )
    threats = [
        risk["threat"]
        for risk in risks
        if risk.get("threat") and risk["review_status"] in ACCEPTED
    ]
    threat = (
        max(
            threats,
            key=lambda item: [
                "insufficient_evidence",
                "low",
                "moderate",
                "high",
                "critical",
            ].index(item["level"]),
        )
        if threats
        else {
            "level": "insufficient_evidence",
            "rationale": "Brak zweryfikowanej oceny prawdopodobieństwa i skutków.",
        }
    )
    assessment = {
        "id": assessment_id,
        "project_id": project_id,
        "created_at": now(),
        "snapshot": data["snapshot"],
        "threat": threat,
        "completeness": {
            "score": sum(
                item["coverage"] * item["requirement"]["weight"] for item in applicable
            )
            / total
            if total
            else None,
            "applicable_count": len(applicable),
        },
        "risks": risks,
        "recommendations": recommendations,
        "deviations": {
            dimension: deviation(matching, dimension) for dimension in ("cost", "time")
        },
        "limitations": [
            "Wzmianki tekstowe dają częściowe pokrycie. Pełne potwierdzenie wymaga zweryfikowanych ustaleń.",
            "Podobieństwo słownikowe i wagi MVP wymagają walidacji na większej próbie.",
        ],
    }
    snapshots = [
        export_row("assessment", assessment),
        export_row("project", value),
        export_row("sector_rules", data["rules"]),
    ]
    snapshots.extend(
        export_row("document_version", item["version"]) for item in data["selected"]
    )
    snapshots.extend(export_row("gap", item) for item in checks)
    snapshots.extend(
        {"record_type": "twin", "record_id": item["project_id"], "data": item}
        for item in twins
    )
    matching_ids = {item["project_id"] for item in twins}
    snapshots.extend(
        export_row("risk", risk)
        for example in data["corpus"]
        if example["project"]["id"] in matching_ids
        for risk in example["risks"]
    )
    buffer_facts = [
        item
        for item in data["facts"]
        if item["key"] == "land_access_schedule_buffer_days"
        and type(item["value"]) is int
        and item["value"] >= 0
        and item["evidence_ids"]
    ]
    snapshots.extend(export_row("fact", item) for item in buffer_facts)
    snapshots.extend(evidence_records(db, snapshots + data["selected"], actor))
    put(
        db,
        "assessment",
        assessment,
        project_id,
        twins=twins,
        gaps=checks,
        export=snapshots,
        land_access_buffer=buffer_facts,
    )
    for gap in checks:
        put(db, "gap", gap, project_id, assessment_id=assessment_id)
