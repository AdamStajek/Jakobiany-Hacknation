import csv
import json
import os
import unittest
from io import BytesIO, StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from time import monotonic, sleep
from unittest.mock import patch
from zipfile import ZipFile

from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from contract import SPEC, resolve, validate
from intake import DOCX, mock_seed
from main import app
from store import API, ROOT, connect, new_database

AUTH = {"Authorization": "Bearer demo"}
OTHER = {"Authorization": "Bearer demo-analyst"}


def docx(text):
    data = BytesIO()
    with ZipFile(data, "w") as archive:
        archive.writestr(
            "[Content_Types].xml",
            """<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>""",
        )
        archive.writestr(
            "word/document.xml",
            f"""<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>""",
        )
    return data.getvalue()


def pdf(text):
    writer = PdfWriter()
    page = writer.add_blank_page(300, 200)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
    )
    stream = DecodedStreamObject()
    stream.set_data(f"BT /F1 12 Tf 10 100 Td ({text}) Tj ET".encode())
    page[NameObject("/Contents")] = stream
    data = BytesIO()
    writer.write(data)
    return data.getvalue()


class BackendTest(unittest.TestCase):
    def setUp(self):
        temporary = self.enterContext(TemporaryDirectory())
        self.path = Path(temporary) / "risk-miner.db"
        self.enterContext(
            patch.dict(
                os.environ,
                {
                    "RISK_MINER_DB_PATH": str(self.path),
                    "RISK_MINER_OFFLINE": "1",
                    "RISK_MINER_MODEL_URL": "",
                    "RISK_MINER_MODEL": "",
                    "RISK_MINER_TOKENS": "",
                },
            )
        )

    def assert_wire(self, method, spec_path, response):
        operation = SPEC["paths"][spec_path][method]
        item = resolve(
            operation["responses"].get(
                str(response.status_code), operation["responses"].get("default")
            )
        )
        if schema := item.get("content", {}).get("application/json", {}).get("schema"):
            validate(response.json(), schema)
        if response.status_code == 202:
            self.assertEqual(
                response.headers["Location"], f"{API}/jobs/{response.json()['id']}"
            )

    def job(self, client, response, expected="succeeded"):
        self.assertEqual(response.status_code, 202, response.text)
        path = response.headers["Location"]
        deadline = monotonic() + 12
        while monotonic() < deadline:
            result = client.get(path)
            self.assert_wire("get", "/jobs/{job_id}", result)
            job = result.json()
            if job["status"] in {"succeeded", "partial", "failed"}:
                self.assertEqual(job["status"], expected, job)
                return job
            sleep(0.06)
        self.fail("The job did not finish in time")

    def create(self, client, title="Budowa sieci wodociągowej", **fields):
        response = client.post(API + "/projects", json={"title": title, **fields})
        self.assertEqual(response.status_code, 201, response.text)
        self.assert_wire("post", "/projects", response)
        return response.json()["id"]

    def test_contract_routes_and_workbook_replay(self):
        routes = {
            (route.path.removeprefix(API), method.lower())
            for route in app.routes
            if route.path.startswith(API + "/")
            for method in route.methods
        }
        self.assertEqual(
            routes,
            {
                (path, method)
                for path, methods in SPEC["paths"].items()
                for method in ("get", "post", "put")
                if method in methods
            },
        )
        file = ROOT / "docs/Risk_Miner_dane_projekty.xlsx"
        with TestClient(app, headers=AUTH) as client:
            self.assertEqual(
                client.get(
                    API + "/projects", headers={"Authorization": ""}
                ).status_code,
                401,
            )
            self.assertEqual(
                client.post(
                    API + "/projects",
                    headers={"Authorization": "Bearer demo-expert"},
                    json={"title": "Test"},
                ).status_code,
                403,
            )
            endpoint = API + "/imports"
            workbook = {"file": (file.name, file.read_bytes())}
            key = {"Idempotency-Key": "competition"}
            first = client.post(endpoint, files=workbook, headers=key)
            self.assert_wire("post", "/imports", first)
            self.assertEqual(
                first.json(), client.post(endpoint, files=workbook, headers=key).json()
            )
            self.assertEqual(len(self.job(client, first)["results"]), 22)
            self.job(client, client.post(endpoint, files=workbook))
            listed = client.get(API + "/projects?kind=historical")
            self.assert_wire("get", "/projects", listed)
            imported = [
                p for p in listed.json()["items"] if p["id"].startswith("RM-2026-")
            ]
            self.assertEqual(len(imported), 22)
            self.assertEqual(
                sum(item["seed_scope"]["level"] == "part" for item in imported), 2
            )
            self.assertEqual(
                sum(
                    any(x["scheme"] == "bzp" for x in item["external_ids"])
                    for item in imported
                ),
                15,
            )
            self.assertTrue(all(item["revision"] == 1 for item in imported))

            content = (
                "Identyfikator rekordu,Nazwa przedsięwzięcia,Rodzaj identyfikatora publicznego,Identyfikator publiczny\n"
                "sample,Przebudowa sieci wodociągowej,BZP,2024/BZP 00000001/01\n"
                ",Brak klucza,KPO,x\n"
            )
            files = {"file": ("test.csv", content.encode())}
            self.assertEqual(
                client.post(endpoint, files=files, headers=key).status_code, 409
            )
            partial = self.job(client, client.post(endpoint, files=files), "partial")
            self.assertTrue(
                any(
                    row.get("row") == 3 and row["status"] == "error"
                    for row in partial["report"]
                )
            )
            self.assertEqual(client.get(API + "/projects?limit=0").status_code, 422)

    def test_assessment_documents_access_and_snapshot(self):
        with TestClient(app, headers=AUTH) as client:
            pid = self.create(client, primary_subsector_codes=["water_network"])
            url = f"{API}/projects/{pid}"
            inadequate = client.post(API + "/assessments", json={"project_id": pid})
            self.assertEqual(inadequate.status_code, 422)
            self.assert_wire("post", "/assessments", inadequate)

            original = docx(
                "Siec ma 2 km. Stwierdzono brak zgody właściciela na dostęp do terenu."
            )
            upload = client.post(
                url + "/documents", files={"file": ("concept.docx", original)}
            )
            uploaded = self.job(client, upload)["results"][0]
            file_location = uploaded["href"]
            response = client.get(file_location)
            self.assert_wire(
                "get", "/documents/{document_id}/versions/{version_id}", response
            )
            version1 = response.json()
            self.assertEqual(version1["media_type"], DOCX)
            self.assertEqual(client.get(version1["content_url"]).content, original)
            self.assertEqual(
                client.get(version1["content_url"], headers=OTHER).status_code, 404
            )
            links = client.get(url + "/evidence").json()["items"]
            proof = client.get(API + "/evidence/" + links[0]["evidence_ids"][0])
            self.assert_wire("get", "/evidence/{evidence_id}", proof)
            self.assertEqual(
                proof.json()["quote"],
                "Siec ma 2 km. Stwierdzono brak zgody właściciela na dostęp do terenu.",
            )
            offsets = proof.json()["char_offsets"]
            self.assertEqual(offsets, {"start": 0, "end": len(proof.json()["quote"])})
            self.assertEqual(
                client.get(
                    f"{API}/evidence/{proof.json()['id']}", headers=OTHER
                ).status_code,
                404,
            )

            request = client.post(API + "/assessments", json={"project_id": pid})
            location = self.job(client, request)["results"][0]["href"]
            response = client.get(location)
            self.assert_wire("get", "/assessments/{assessment_id}", response)
            assessment = response.json()
            self.assertEqual(
                assessment["snapshot"]["document_version_ids"], [version1["id"]]
            )
            self.assertEqual(assessment["completeness"]["applicable_count"], 9)
            self.assertTrue(assessment["risks"])
            for suffix in ("twins", "gaps", "graph", "export"):
                extra = client.get(f"{location}/{suffix}")
                self.assert_wire(
                    "get", f"/assessments/{{assessment_id}}/{suffix}", extra
                )
                self.assertEqual(extra.status_code, 200, extra.text)
            older = client.get(location + "/export").json()["records"]
            self.assertEqual(
                client.get(location + "/export", headers=OTHER).status_code, 404
            )
            self.assertEqual(
                client.get(url + "/export", headers=OTHER).status_code, 404
            )
            self.assertEqual(
                client.post(
                    API + "/assessments",
                    json={"project_id": pid, "document_version_ids": []},
                ).status_code,
                422,
            )

            payload = pdf("The diagram shows 3 km.")
            new_upload = client.post(
                url + "/documents",
                files={"file": ("concept.pdf", payload)},
                data={"document_id": version1["document_id"]},
            )
            new_location = self.job(client, new_upload)["results"][0]["href"]
            version2 = client.get(new_location).json()
            self.assertEqual(version2["supersedes_version_ids"], [version1["id"]])
            duplicate = client.post(
                url + "/documents",
                files={"file": ("concept.pdf", payload)},
                data={"document_id": version1["document_id"]},
            )
            self.assertEqual(
                self.job(client, duplicate)["results"][0]["href"], new_location
            )
            updated = self.job(
                client, client.post(API + "/assessments", json={"project_id": pid})
            )["results"][0]["href"]
            self.assertEqual(
                client.get(updated).json()["snapshot"]["document_version_ids"],
                [version2["id"]],
            )
            self.assertEqual(client.get(location + "/export").json()["records"], older)
            self.assert_wire(
                "get",
                "/assessments/{assessment_id}/diff",
                client.get(updated + "/diff", params={"baseline_id": assessment["id"]}),
            )
            export = client.get(location + "/export?format=csv")
            rows = list(csv.reader(StringIO(export.text)))
            self.assertTrue(export.headers["Content-Disposition"].endswith('.csv"'))
            self.assertEqual(rows[0], ["record_type", "record_id", "data_json"])
            self.assertEqual(rows[1][0], "export_metadata")
            self.assertEqual(json.loads(rows[1][2])["schema_version"], "1")

    def test_failed_extraction_and_verified_check(self):
        with TestClient(app, headers=AUTH) as client:
            pid = self.create(
                client,
                description="Dla sieci wodociągowej nie uzyskano zgody właściciela na dostęp do gruntu.",
            )
            url = f"{API}/projects/{pid}"
            blob = b"%PDF-1.7\ninvalid"
            failed = self.job(
                client,
                client.post(url + "/documents", files={"file": ("invalid.pdf", blob)}),
                "failed",
            )
            self.assertEqual(
                client.get(failed["results"][0]["href"]).json()["extraction_status"],
                "failed",
            )
            self.assertEqual(
                client.post(API + "/assessments", json={"project_id": pid}).status_code,
                409,
            )
            evidence_id = client.get(url).json()["evidence_ids"][0]
            review = client.post(
                API + "/expert/records",
                json={
                    "target_type": "fact",
                    "project_id": pid,
                    "value": {
                        "subject": {"type": "project", "id": pid},
                        "key": "check.land_access",
                        "value": {"state": "confirmed_not_done"},
                        "claim_type": "SOURCE_FACT",
                        "confidence": {"level": "high", "rationale": "Wprost z opisu"},
                        "evidence_ids": [evidence_id],
                    },
                },
            )
            self.assertEqual(review.status_code, 201, review.text)
            decision = client.post(
                API + "/expert/decisions",
                json={
                    "target_type": "fact",
                    "target_id": review.json()["target_id"],
                    "expected_revision": 1,
                    "action": "approve",
                    "reason": "Sprawdzono opis",
                },
            )
            self.assertEqual(decision.status_code, 201, decision.text)
            job = self.job(
                client,
                client.post(
                    API + "/assessments",
                    json={"project_id": pid, "document_version_ids": []},
                ),
            )
            href = job["results"][0]["href"]
            checks = client.get(href + "/gaps?state=confirmed_not_done").json()
            self.assertEqual(len(checks), 1)
            self.assertEqual(checks[0]["coverage"], 1)
            self.assertEqual(checks[0]["evidence_ids"], [evidence_id])

    def test_decisions_restart_sector_rules_and_chaos(self):
        with TestClient(app, headers=AUTH) as client:
            response = client.get(API + "/expert/reviews?target_type=risk")
            self.assert_wire("get", "/expert/reviews", response)
            risk = next(
                item
                for item in response.json()["items"]
                if item["value"]["kind"] == "OBSERVED_EVENT"
                and item["value"]["risk_code"] == "R03"
            )
            body = {
                "target_type": "risk",
                "target_id": risk["target_id"],
                "expected_revision": 1,
                "action": "correct",
                "reason": "Zweryfikowano opis",
                "changes": {"title": "Brak zgody na grunt"},
            }
            endpoint = API + "/expert/decisions"
            decision = client.post(endpoint, json=body)
            self.assertEqual(decision.status_code, 201, decision.text)
            self.assert_wire("post", "/expert/decisions", decision)
            self.assertEqual(decision.json()["actor_id"], "demo")
            self.assertEqual(client.post(endpoint, json=body).status_code, 409)
            target_id = risk["target_id"]

            sector_route = API + "/sector-rules"
            rules = client.get(sector_route).json()[0]
            proposal = {
                key: value
                for key, value in rules.items()
                if key not in ("id", "revision", "review_status")
            }
            proposal["based_on_id"] = rules["id"]
            proposal["description"] += " Aktualizacja."
            proposals = [client.post(sector_route, json=proposal) for _ in range(2)]
            self.assertEqual([r.status_code for r in proposals], [201, 201])
            for response, code in zip(proposals, [201, 409], strict=True):
                result = client.post(
                    endpoint,
                    json={
                        "target_type": "sector_rules",
                        "target_id": response.json()["id"],
                        "expected_revision": 1,
                        "action": "approve",
                        "reason": "Weryfikacja",
                    },
                )
                self.assertEqual(result.status_code, code, result.text)

            dna = client.post(
                API + "/risk-dna",
                json={
                    "risk_code": "R03",
                    "title": "Dostęp do gruntu",
                    "historical_event_ids": [target_id],
                    "signal": "Odmowa dostępu do gruntu",
                    "checkpoint": "Sprawdź służebności",
                    "applicability": "Sieć wodociągowa",
                    "expected_evidence": ["Mapa nieruchomości"],
                },
            )
            self.assertEqual(dna.status_code, 201, dna.text)
            self.assert_wire("post", "/risk-dna", dna)
            approved = client.post(
                endpoint,
                json={
                    "target_type": "risk_dna",
                    "target_id": dna.json()["id"],
                    "expected_revision": 1,
                    "action": "approve",
                    "reason": "Porównano przypadki",
                },
            )
            self.assertEqual(approved.status_code, 201, approved.text)
            pid = self.create(
                client,
                description="Planowana sieć wodociągowa o 2 km. Zapas harmonogramu to 35 dni.",
            )
            proof = client.get(f"{API}/projects/{pid}").json()["evidence_ids"][0]
            buffer = client.post(
                API + "/expert/records",
                json={
                    "target_type": "fact",
                    "project_id": pid,
                    "value": {
                        "subject": {"type": "project", "id": pid},
                        "key": "land_access_schedule_buffer_days",
                        "value": 35,
                        "unit": "days",
                        "claim_type": "SOURCE_FACT",
                        "confidence": {
                            "level": "high",
                            "rationale": "Zapas zapisany w opisie",
                        },
                        "evidence_ids": [proof],
                    },
                },
            )
            self.assertEqual(buffer.status_code, 201, buffer.text)
            result = client.post(
                endpoint,
                json={
                    "target_type": "fact",
                    "target_id": buffer.json()["target_id"],
                    "expected_revision": 1,
                    "action": "approve",
                    "reason": "Sprawdzono zapas",
                },
            )
            self.assertEqual(result.status_code, 201, result.text)
            href = self.job(
                client, client.post(API + "/assessments", json={"project_id": pid})
            )["results"][0]["href"]
            self.assertEqual(
                client.post(
                    href + "/chaos", json={"parameters": {"land_access_delay_days": -1}}
                ).status_code,
                422,
            )
            run = self.job(
                client,
                client.post(
                    href + "/chaos", json={"parameters": {"land_access_delay_days": 90}}
                ),
            )
            response = client.get(run["results"][0]["href"])
            self.assert_wire(
                "get", "/assessments/{assessment_id}/chaos/{run_id}", response
            )
            self.assertEqual(response.json()["risk_dna_revision"], 2)
            self.assertEqual(response.json()["status"], "critical_gap")
            self.assertIn("35 dni", response.json()["checks"][-1]["explanation"])

        with TestClient(app, headers=AUTH) as client:
            history = client.get(
                endpoint, params={"target_type": "risk", "target_id": target_id}
            )
            self.assert_wire("get", "/expert/decisions", history)
            self.assertEqual(
                history.json()["items"][0]["after"]["value"]["title"],
                "Brak zgody na grunt",
            )
            self.assertEqual(client.get(href).status_code, 200)

    def test_database_selection(self):
        with TestClient(app, headers=AUTH):
            self.assertEqual(app.state.path.name, "risk-miner.mock.db")
        with new_database(self.path) as staging, connect(staging, write=True) as db:
            mock_seed(db)
        with patch.dict(
            os.environ,
            {
                "RISK_MINER_TOKENS": json.dumps(
                    {"real": {"id": "real", "roles": ["analyst"]}}
                )
            },
        ):
            with TestClient(app) as client:
                self.assertEqual(app.state.path, self.path)
                self.assertEqual(
                    client.get(API + "/projects", headers=AUTH).status_code, 401
                )
                self.assertEqual(
                    client.get(
                        API + "/projects", headers={"Authorization": "Bearer real"}
                    ).status_code,
                    200,
                )
        wrong = self.path.with_name("empty.db")
        wrong.touch()
        with (
            patch.dict(os.environ, {"RISK_MINER_DB_PATH": str(wrong)}),
            self.assertRaisesRegex(RuntimeError, "empty.db"),
        ):
            with TestClient(app):
                pass


if __name__ == "__main__":
    unittest.main()
