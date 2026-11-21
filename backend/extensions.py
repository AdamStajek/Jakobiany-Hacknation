from collections import defaultdict

from domain import grounded_ids
from store import (
    ACCEPTED,
    Problem,
    confidence,
    identifier,
    projects,
    put,
    record,
    ref,
    review_fields,
    unique,
    values,
)


def prepare_chaos(db, actor, assessment, meta, body):
    ids = body.get("risk_dna_ids")
    risk_codes = {
        code for gap in meta["gaps"] for code in gap["requirement"]["risk_codes"]
    }
    risk_codes.update(item["risk_code"] for item in assessment["risks"])
    patterns = (
        [record(db, "risk_dna", key, actor)[0] for key in ids]
        if ids
        else [
            item
            for item in values(db, "risk_dna")
            if item["review_status"] in ACCEPTED and item["risk_code"] in risk_codes
        ]
    )
    if any(item["review_status"] not in ACCEPTED for item in patterns):
        raise Problem(
            409, "risk_dna_not_approved", "Test wymaga zatwierdzonego wzorca."
        )
    if not patterns:
        raise Problem(
            422, "no_applicable_patterns", "Brak stosowalnych zatwierdzonych wzorców."
        )
    params = body.get("parameters", {})
    for key, value in params.items():
        if (
            key != "land_access_delay_days"
            or type(value) is not int
            or value < 0
            or any(p["risk_code"] != "R03" for p in patterns)
        ):
            raise Problem(
                422,
                "invalid_scenario_parameters",
                "Parametr land_access_delay_days dotyczy R03 i wymaga liczby całkowitej nieujemnej.",
            )
    for pattern in patterns:
        for evidence_id in pattern["evidence_ids"]:
            record(db, "evidence", evidence_id, actor)
    return {
        "assessment": assessment,
        "gaps": meta["gaps"],
        "patterns": patterns,
        "parameters": params,
        "land_access_buffer": meta.get("land_access_buffer", []),
    }


def run_chaos(db, job_id, payload):
    assessment, patterns = payload["assessment"], payload["patterns"]
    project_id = assessment["project_id"]
    results = []
    for pattern in patterns:
        run_id = identifier("chaos", job_id, pattern["id"])
        checks = [
            check
            for check in payload["gaps"]
            if pattern["risk_code"] in check["requirement"]["risk_codes"]
        ]
        delay = payload["parameters"].get("land_access_delay_days")
        if delay is not None:
            facts = payload["land_access_buffer"]
            known = {item["value"] for item in facts}
            buffers = grounded_ids(facts)
            if len(known) == 1:
                capacity = next(iter(known))
                state = "confirmed" if capacity >= delay else "confirmed_not_done"
                explanation = f"Zapas harmonogramu wynosi {capacity} dni przy założonym opóźnieniu {delay} dni."
            elif known:
                state = "conflicting_sources"
                explanation = (
                    "Zatwierdzone źródła wskazują różne długości zapasu harmonogramu."
                )
            else:
                state = "not_addressed"
                explanation = (
                    f"Pakiet nie dokumentuje zapasu na założone opóźnienie {delay} dni."
                )
            checks.append(
                {
                    "id": identifier("gap", run_id, "land_access_schedule_buffer_days"),
                    "requirement": {
                        "code": "land_access_schedule_buffer_days",
                        "question": "Czy harmonogram ma wystarczający zapas na opóźnienie dostępu?",
                        "rationale": "Zapas czasowy pozwala utrzymać termin robót zależnych.",
                        "weight": 1,
                        "risk_codes": ["R03", "R06"],
                    },
                    "state": state,
                    "coverage": int(state in {"confirmed", "confirmed_not_done"}),
                    "explanation": explanation,
                    "evidence_ids": buffers,
                }
            )
        applicable = [check for check in checks if check["coverage"] is not None]
        if any(
            item["state"] in {"confirmed_not_done", "conflicting_sources"}
            for item in applicable
        ):
            status = "critical_gap"
        elif applicable and all(item["coverage"] == 1 for item in applicable):
            status = "resilient"
        elif any(item["coverage"] > 0 for item in applicable):
            status = "partially_protected"
        else:
            status = "undocumented_protection"
        proofs = unique(pattern["evidence_ids"] + grounded_ids(checks))
        recs = []
        if status != "resilient":
            recs.append(
                {
                    **review_fields(identifier("rec", run_id)),
                    "kind": "mitigate",
                    "claim_type": "MODEL_INFERENCE",
                    "action": pattern["checkpoint"],
                    "rationale": "Sprawdź zabezpieczenie wskazane przez zatwierdzony wzorzec.",
                    "confidence": confidence(
                        "moderate", "Wzorzec historyczny porównany z pakietem analizy."
                    ),
                    "related_to": [ref("risk_dna", pattern["id"])],
                    "evidence_ids": proofs,
                }
            )
        result = {
            "id": run_id,
            "assessment_id": assessment["id"],
            "risk_dna_id": pattern["id"],
            "risk_dna_revision": pattern["revision"],
            "scenario": pattern["signal"],
            "parameters": payload["parameters"],
            "status": status,
            "explanation": f"{pattern['applicability']} Sprawdzono {len(applicable)} pozycji checklisty dla {pattern['risk_code']}.",
            "checks": checks,
            "recommendations": recs,
            "evidence_ids": proofs,
        }
        for recommendation in recs:
            put(
                db,
                "recommendation",
                recommendation,
                project_id,
                assessment_id=assessment["id"],
            )
        put(db, "chaos_run", result, project_id, pattern=pattern)
        results.append(result)
    return results


def risk_graph(assessment, meta, chaos):
    nodes, edges = {}, []

    def add(kind, key, label, proofs):
        nodes[key] = {
            "id": key,
            "label": label,
            "target": ref(kind, key),
            "evidence_ids": proofs,
        }

    def edge(a, b, relation, explanation, proofs):
        edges.append(
            {
                "from": a,
                "to": b,
                "relation": relation,
                "explanation": explanation,
                "evidence_ids": proofs,
            }
        )

    root = assessment["project_id"]
    add("project", root, "Projekt oceniany", [])
    for key, kind, title in [
        ("risks", "risk", "title"),
        ("recommendations", "recommendation", "action"),
    ]:
        for item in assessment[key]:
            add(kind, item["id"], item[title], item["evidence_ids"])
            for eid in item["evidence_ids"]:
                add("evidence", eid, "Dowód", [eid])
                edge(item["id"], eid, "EVIDENCED_BY", "Źródło wniosku.", [eid])
    for risk in assessment["risks"]:
        edge(
            risk["id"],
            root,
            "MAY_CAUSE",
            "Możliwy wpływ na oceniany projekt.",
            risk["evidence_ids"],
        )
    for rec in assessment["recommendations"]:
        for related in rec["related_to"]:
            if related["type"] == "risk" and related["id"] in nodes:
                edge(
                    related["id"],
                    rec["id"],
                    "MITIGATED_BY",
                    rec["rationale"],
                    rec["evidence_ids"],
                )
    for twin in meta["twins"]:
        add("project", twin["project_id"], twin["project_id"], twin["evidence_ids"])
        edge(
            root,
            twin["project_id"],
            "SIMILAR_TO",
            twin["explanation"],
            twin["evidence_ids"],
        )
    for run in chaos:
        add("chaos_run", run["id"], run["scenario"], run["evidence_ids"])
        edge(root, run["id"], "TESTED_BY", run["explanation"], run["evidence_ids"])
    return {"nodes": list(nodes.values()), "edges": edges}


def assessment_diff(assessment, meta, baseline, previous):
    older = {item["requirement"]["code"]: item for item in previous["gaps"]}
    current = {item["requirement"]["code"]: item for item in meta["gaps"]}
    changes = []
    for code in sorted(older.keys() | current.keys()):
        old, new = older.get(code), current.get(code)
        if (
            old
            and new
            and old["state"] == new["state"]
            and old["evidence_ids"] == new["evidence_ids"]
        ):
            continue
        kind = (
            "added"
            if old is None
            else "resolved"
            if new is None
            else (
                "confirmed"
                if new["coverage"] == 1 and old["coverage"] != 1
                else "changed"
            )
        )
        item = {
            "kind": kind,
            "explanation": f"{code}: {old['state'] if old else 'brak pozycji'} → {new['state'] if new else 'brak pozycji'}.",
            "evidence_ids": grounded_ids([old, new]),
        }
        if old:
            item["previous"] = ref("gap", old["id"])
        if new:
            item["current"] = ref("gap", new["id"])
        changes.append(item)
    return {
        "baseline_id": baseline["id"],
        "assessment_id": assessment["id"],
        "completeness_before": baseline["completeness"],
        "completeness_after": assessment["completeness"],
        "changes": changes,
    }


def patterns(db, actor, code, subsector):
    pool = [
        item
        for item in projects(db, actor)
        if item["kind"] == "historical"
        and item["status"] == "completed"
        and (not subsector or subsector in item.get("primary_subsector_codes", []))
    ]
    by_code, documented = defaultdict(list), set()
    for project in pool:
        for risk in values(db, "risk", project["id"]):
            if (
                risk["kind"] == "OBSERVED_EVENT"
                and risk["review_status"] in ACCEPTED
                and risk["evidence_ids"]
            ):
                documented.add(project["id"])
                if not code or risk["risk_code"] == code:
                    by_code[risk["risk_code"]].append(risk)
    candidates = []
    for risk_code, risks in by_code.items():
        pids = sorted({risk["project_id"] for risk in risks})
        if len(pids) < 2:
            continue
        key = identifier("pattern", risk_code, [risk["id"] for risk in risks])
        try:
            value = record(db, "pattern_candidate", key, actor)[0]
        except Problem as exc:
            if exc.status != 404:
                raise
            value = {
                **review_fields(key),
                "risk_codes": [risk_code],
                "event_ids": [risk["id"] for risk in risks],
                "project_ids": pids,
                "common_features": [
                    f"Zarejestrowane zdarzenie w kategorii {risk_code}."
                ],
                "differences": unique(risk["title"] for risk in risks),
                "sequence": [],
                "hypothesis": "Wspólna kategoria uzasadnia przegląd przypadków.",
                "evidence_ids": grounded_ids(risks),
            }
            put(db, "pattern_candidate", value)
        candidates.append(value)
    return {
        "status": "candidates_found"
        if candidates
        else "no_candidates"
        if len(documented) >= 2
        else "insufficient_evidence",
        "analyzed_project_count": len(pool),
        "documented_project_count": len(documented),
        "candidates": candidates,
        "limitations": [
            "Zgrupowanie według zatwierdzonego kodu wskazuje materiał do porównania sekwencji i przyczyn."
        ],
    }
