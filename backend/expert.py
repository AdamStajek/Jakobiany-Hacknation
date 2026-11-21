from contract import schema_fields, validate
from domain import active_rules, grounded_ids
from enrichment import extract_linked_notices
from store import (
    ACCEPTED,
    Problem,
    find,
    identifier,
    now,
    project,
    put,
    put_project,
    record,
    review_fields,
    revision,
    unique,
)

SCHEMAS = {
    "project": "Project",
    "procedure": "Procedure",
    "part": "ProcedurePart",
    "notice": "Notice",
    "contract": "Contract",
    "contract_change": "ContractChange",
    "document": "Document",
    "fact": "Fact",
    "link": "RecordLink",
    "risk": "Risk",
    "recommendation": "Recommendation",
    "sector_rules": "SectorRules",
    "risk_dna": "RiskDna",
    "pattern_candidate": "PatternCandidate",
}
SERVER_FIELDS = {
    "id",
    "revision",
    "review_status",
    "latest_decision_id",
    "project_id",
    "counts",
    "kind",
    "external_ids",
    "normalized",
    "source",
    "versions",
    "current_version_id",
    "procedures",
    "parts",
    "notices",
    "contracts",
    "changes",
    "based_on_id",
    "sector_code",
    "approved_at",
}


def review_item(kind, value, project_id):
    result = {
        "target_type": kind,
        "target_id": value["id"],
        "revision": value.get("revision", 1),
        "review_status": value.get("review_status", "proposed"),
        "value": value,
        "evidence_ids": grounded_ids([value]),
    }
    if project_id is not None:
        result["project_id"] = project_id
    return result


def target(db, kind, key, actor):
    if kind == "project":
        return project(db, key, actor), key, {}
    return record(db, kind, key, actor)


def editable_fields(kind):
    fields = schema_fields(SCHEMAS[kind]) - SERVER_FIELDS
    if kind in {"risk", "recommendation"}:
        fields.add("kind")
    return fields


def validate_relationships(db, actor, kind, value, project_id, approving=False):
    validate(value, SCHEMAS[kind])
    evidence_ids = grounded_ids([value])
    proofs = []
    for evidence_id in evidence_ids:
        proof, scope, _ = record(db, "evidence", evidence_id, actor)
        if scope not in {None, project_id}:
            historical = project(db, scope, actor)["kind"] == "historical"
            if not historical or kind not in {
                "recommendation",
                "risk_dna",
                "pattern_candidate",
            }:
                raise Problem(
                    422, "invalid_evidence", "Dowód nie należy do wskazanego zakresu."
                )
        proofs.append(proof)
    if (
        approving
        and kind
        in {"fact", "risk", "link", "recommendation", "risk_dna", "pattern_candidate"}
        and not proofs
    ):
        raise Problem(
            422,
            "evidence_required",
            "Zatwierdzenie wymaga wskazania weryfikowalnego dowodu.",
        )
    relations = [
        value[key] for key in ("subject", "from", "to") if key in value
    ] + value.get("related_to", [])
    for relation in relations:
        entity, key = relation["type"], relation["id"]
        scope = target(db, entity, key, actor)[1]
        if scope not in {None, project_id}:
            if (
                kind != "recommendation"
                or project(db, scope, actor)["kind"] != "historical"
            ):
                raise Problem(
                    422,
                    "invalid_relation",
                    "Powiązany rekord nie należy do wskazanego projektu.",
                )
    for fact_id in value.get("calculation", {}).get("input_fact_ids", []):
        _, scope, _ = record(db, "fact", fact_id, actor)
        if scope != project_id or fact_id == value["id"]:
            raise Problem(
                422,
                "invalid_calculation",
                "Obliczenie musi wskazywać inne fakty z projektu.",
            )
    if kind in {"risk", "risk_dna"}:
        scope = project(db, project_id, actor) if project_id else {}
        rules = active_rules(db, scope.get("sector_code", "water_and_sewerage"))
        if rules is None or value["risk_code"] not in {
            item["code"] for item in rules["risk_categories"]
        }:
            raise Problem(
                422,
                "unknown_risk_code",
                "Kod ryzyka nie należy do zatwierdzonego katalogu.",
            )
        if (
            kind == "risk"
            and value["kind"] == "OBSERVED_EVENT"
            and scope["kind"] != "historical"
        ):
            raise Problem(
                422,
                "invalid_risk_kind",
                "Zdarzenie historyczne wymaga projektu historycznego.",
            )
        if kind == "risk_dna":
            expected = dna_evidence(db, actor, value)
            if any(key not in evidence_ids for key in expected):
                raise Problem(
                    422,
                    "evidence_required",
                    "Wzorzec musi zachować dowody zdarzeń historycznych.",
                )
    if kind == "sector_rules":
        validate_rules(value)


def validate_rules(value):
    catalog = [item["code"] for item in value["risk_categories"]]
    subsectors = [item["code"] for item in value["subsectors"]]
    checks = [(item["subsector_code"], item["phase"]) for item in value["checklists"]]
    if (
        len(catalog) != len(set(catalog))
        or len(subsectors) != len(set(subsectors))
        or len(checks) != len(set(checks))
    ):
        raise Problem(
            422,
            "duplicate_rules",
            "Kody katalogu, podsektory i pary podsektor–faza muszą być unikalne.",
        )
    if not any(value["comparison_weights"].values()):
        raise Problem(
            422,
            "invalid_weights",
            "Wymagana jest co najmniej jedna dodatnia waga porównania.",
        )
    requirements = [
        item for checklist in value["checklists"] for item in checklist["requirements"]
    ]
    rules = value["rules"]
    if any(set(item["risk_codes"]) - set(catalog) for item in requirements + rules):
        raise Problem(
            422,
            "unknown_risk_code",
            "Reguły i checklisty muszą używać kodów z katalogu.",
        )
    for item in value["checklists"]:
        codes = [requirement["code"] for requirement in item["requirements"]]
        if item["subsector_code"] not in subsectors or len(codes) != len(set(codes)):
            raise Problem(
                422,
                "invalid_checklist",
                "Checklista wymaga znanego podsektora i unikalnych pozycji.",
            )
    if len({item["id"] for item in rules}) != len(rules):
        raise Problem(
            422, "duplicate_rules", "Identyfikatory reguł muszą być unikalne."
        )


def create_record(db, actor, body):
    kind, project_id = body["target_type"], body["project_id"]
    project(db, project_id, actor)
    value = body["value"]
    allowed = editable_fields(kind)
    if value.keys() - allowed:
        raise Problem(
            422, "immutable_fields", "Nie można ustawić pól nadawanych przez serwer."
        )
    value = {**value, **review_fields(identifier(kind))}
    if kind == "risk":
        value["project_id"] = project_id
    validate_relationships(db, actor, kind, value, project_id)
    if not grounded_ids([value]):
        raise Problem(422, "evidence_required", "Podaj dowód dla propozycji.")
    put(db, kind, value, project_id)
    return review_item(kind, value, project_id)


def create_rules(db, body):
    current = active_rules(db, body["sector_code"])
    if body.get("based_on_id") != (current["id"] if current else None):
        raise Problem(
            409, "stale_sector_rules", "Wskaż aktualną wersję bazową wiedzy sektorowej."
        )
    value = {key: body[key] for key in schema_fields("SectorRulesInput") if key in body}
    value.update(review_fields(identifier("rules")))
    validate_rules(value)
    return put(
        db,
        "sector_rules",
        value,
        base_revision=current["revision"] if current else None,
    )


def dna_evidence(db, actor, body):
    proofs = []
    for key in body["historical_event_ids"]:
        event, scope, _ = record(db, "risk", key, actor)
        historical = project(db, scope, actor)["kind"] == "historical"
        if (
            not historical
            or event["risk_code"] != body["risk_code"]
            or event["kind"] != "OBSERVED_EVENT"
            or event["review_status"] not in ACCEPTED
        ):
            raise Problem(
                409,
                "historical_event_required",
                "Wymagane są zatwierdzone zdarzenia historyczne z tej kategorii.",
            )
        proofs.extend(event["evidence_ids"])
    return unique(proofs)


def create_dna(db, actor, body):
    value = {key: body[key] for key in schema_fields("RiskDnaInput") if key in body}
    value.update(
        review_fields(identifier("dna")), evidence_ids=dna_evidence(db, actor, body)
    )
    validate_relationships(db, actor, "risk_dna", value, None)
    return put(db, "risk_dna", value)


def decide(db, actor, body):
    kind, key, action = body["target_type"], body["target_id"], body["action"]
    old, project_id, meta = target(db, kind, key, actor)
    before = review_item(kind, old, project_id)
    if body["expected_revision"] != before["revision"]:
        raise Problem(409, "stale_revision", "Rekord ma nowszą rewizję.")
    changes = body.get("changes", {})
    if changes.keys() - editable_fields(kind):
        raise Problem(
            422, "immutable_fields", "Korekta obejmuje pola niedostępne do edycji."
        )
    status = {
        "approve": "approved",
        "correct": "corrected",
        "reject": "rejected",
        "request_evidence": "needs_evidence",
    }[action]
    decision_id = identifier("decision")
    value = {
        **old,
        **changes,
        "revision": before["revision"] + 1,
        "review_status": status,
        "latest_decision_id": decision_id,
    }
    approved = status in ACCEPTED
    if kind == "sector_rules" and approved:
        current = active_rules(db, value["sector_code"])
        if current and current["id"] == value["id"]:
            current = None
        elif (current["id"] if current else None) != value.get("based_on_id") or (
            current and current["revision"] != meta.get("base_revision")
        ):
            raise Problem(
                409, "stale_sector_rules", "Zatwierdzona wersja bazowa uległa zmianie."
            )
        if current:
            older = find(db, kind, current["id"])[2]
            revision(db, kind, current, None)
            put(db, kind, {**current, "review_status": "superseded"}, **older)
    if kind == "risk_dna":
        if approved:
            value["approved_at"] = now()
        else:
            value.pop("approved_at", None)
    if approved or changes:
        validate_relationships(db, actor, kind, value, project_id, approved)
    revision(db, kind, {**old, "revision": before["revision"]}, project_id)
    if kind == "project":
        put_project(db, value)
    else:
        put(db, kind, value, project_id, **{**meta, "edited": True})
    if kind == "link":
        from store import values

        linked = values(db, "link", project_id)
        p = project(db, project_id)
        if (
            approved
            and value["relation"] == "project_has_procedure"
            and value["to"]["type"] == "procedure"
        ):
            extract_linked_notices(db, p, value["to"]["id"])

        p["enrichment_status"] = (
            "matched"
            if any(item["review_status"] in ACCEPTED for item in linked)
            else (
                "needs_review"
                if any(
                    item["review_status"] in {"proposed", "needs_evidence"}
                    for item in linked
                )
                else "unmatched"
            )
        )
        put_project(db, p)
    return put(
        db,
        "decision",
        {
            "id": decision_id,
            "target_type": kind,
            "target_id": key,
            "action": action,
            "reason": body["reason"],
            "actor_id": actor,
            "created_at": now(),
            "before": before,
            "after": review_item(kind, value, project_id),
        },
        project_id,
    )
