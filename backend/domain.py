from store import ACCEPTED, entries, find, project, ref, unique, values


def evidence_ids(value):
    if isinstance(value, dict):
        for key, field in value.items():
            if key == "evidence_ids" and isinstance(field, list):
                yield from (item for item in field if isinstance(item, str))
            elif key not in {"quote", "source"}:
                yield from evidence_ids(field)
    elif isinstance(value, list):
        for item in value:
            yield from evidence_ids(item)


def project_detail(db, project_id, actor=None):
    value = project(db, project_id, actor)
    links = values(db, "link", project_id)
    attached_ids = {
        link["to"]["id"]
        for link in links
        if link["review_status"] in ACCEPTED
        and link["from"] == ref("project", project_id)
        and link["to"]["type"] == "procedure"
        and link["relation"] == "project_has_procedure"
    }
    procedures = [
        item
        for item in values(db, "procedure", project_id)
        if item["id"] in attached_ids
    ]
    timeline = []

    def date_event(day, kind, item, label):
        if day:
            timeline.append(
                {
                    "date": day[:10],
                    "target": ref(kind, item["id"]),
                    "label": label,
                    "evidence_ids": item.get("evidence_ids", []),
                }
            )

    notices = entries(db, "notice", project_id)
    notice_dates = {item["id"]: meta.get("published_on") for item, _, meta in notices}
    parts = entries(db, "part", project_id)
    contracts = entries(db, "contract", project_id)
    changes = entries(db, "contract_change", project_id)
    for procedure in procedures:
        proc_id = procedure["id"]
        procedure.update(
            {
                key: [
                    item
                    for item, _, meta in items
                    if meta.get("procedure_id") == proc_id
                ]
                for key, items in [
                    ("notices", notices),
                    ("parts", parts),
                    ("contracts", contracts),
                ]
            }
        )
        for notice in procedure["notices"]:
            date_event(
                notice.get("published_at") or notice_dates.get(notice["id"]),
                "notice",
                notice,
                notice["identifier"]["value"],
            )
        for contract in procedure["contracts"]:
            contract["changes"] = [
                item
                for item, _, meta in changes
                if meta.get("contract_id") == contract["id"]
            ]
            for milestone in contract["milestones"]:
                date_event(
                    milestone["date"],
                    "contract",
                    {**contract, **milestone},
                    milestone["kind"],
                )
            for change in contract["changes"]:
                date_event(
                    change.get("effective_on"),
                    "contract_change",
                    change,
                    change["description"],
                )
    docs = values(db, "document", project_id)
    versions = values(db, "document_version", project_id)
    for item in docs:
        item["versions"] = sorted(
            (v for v in versions if v["document_id"] == item["id"]),
            key=lambda v: v["revision"],
        )
        for version in item["versions"]:
            date_event(
                version.get("issued_on"),
                "document_version",
                {**version, "evidence_ids": []},
                item["document_type"],
            )
    risks = values(db, "risk", project_id)
    for risk in risks:
        if risk["review_status"] in ACCEPTED and risk["kind"] == "OBSERVED_EVENT":
            date_event(risk.get("occurred_on"), "risk", risk, risk["title"])
    input_state = find(db, "import_state", project_id)
    current = input_state[0]["current_input_id"] if input_state else None
    amounts = [
        item
        for item, _, meta in entries(db, "amount", project_id)
        if current is None or meta.get("input_id") in {None, current}
    ]
    return {
        **value,
        "procedures": procedures,
        "documents": docs,
        "links": links,
        "counts": {
            "procedures": len(procedures),
            "links": len(links),
            "risks": len(risks),
        },
        "timeline": sorted(
            timeline, key=lambda item: (item["date"], item["target"]["id"])
        ),
        "amounts": amounts,
        "milestones": values(db, "milestone", project_id),
    }


def active_rules(db, sector):
    return next(
        (
            item
            for item in values(db, "sector_rules")
            if item["sector_code"] == sector and item["review_status"] in ACCEPTED
        ),
        None,
    )


def export_row(kind, value):
    return {"record_type": kind, "record_id": value["id"], "data": value}


def evidence_records(db, data, actor):
    from store import record

    records = []
    origins = {}
    for record_id in sorted(set(evidence_ids(data))):
        value = record(db, "evidence", record_id, actor)[0]
        records.append(export_row("evidence", value))
        origin = value["source"]
        origins[origin["id"]] = origin
    records.extend(export_row("source", origin) for origin in origins.values())
    return records


def project_export(db, detail, actor):
    project_id = detail["id"]
    records = [export_row("project", detail)]
    for kind in ("fact", "risk", "recommendation", "decision"):
        records.extend(
            export_row(kind, value) for value in values(db, kind, project_id)
        )
    records.extend(evidence_records(db, records, actor))
    return records


def grounded_ids(items):
    return unique(eid for item in items for eid in evidence_ids(item))
