from datetime import date, timedelta

import pytest

from wodo.report_evidence import report_evidence
from wodo.science import assess

DAY = date(2024, 7, 5)


def report_with_weather(rain, days=90, soil=True):
    rows = {(DAY - timedelta(days=i)).isoformat(): [rain, 4, 20] for i in range(days)}
    profile = {"layers": [[250, 100]] * 5} if soil else None
    return {"metrics": assess(rows, profile, "potato", DAY), "sources": [], "missing": {},
            "date": DAY.isoformat(), "agricultural": True}


@pytest.mark.parametrize(("rain", "days", "risk", "reason"),
                         [(0, 90, "Podwyższone", "Nawet przy wilgotnej"), (4, 21, "Niepewne", "Tylko przy suchej"),
                          (10, 90, "Niskie w modelu", "W obu wariantach")])
def test_evidence_explains_existing_threshold_decision(rain, days, risk, reason):
    report = report_with_weather(rain, days)
    assert report["metrics"]["risk"] == risk
    evidence = report_evidence(report)
    assert reason in evidence["reason"]
    assert evidence["root_start"] == (DAY - timedelta(days=days - 1)).isoformat()
    assert "Brakuje zdjęcia" in evidence["confidence_note"]


def test_evidence_withholds_diagnosis_and_separates_history():
    report = report_with_weather(0, soil=False)
    evidence = report_evidence(report)
    assert "Nie wiadomo" in evidence["headline"]
    assert "mniej" in evidence["reason"]
    assert evidence["history_start"] == "2014-07-05" and evidence["eligible_seasons"] == 9
    assert report["metrics"]["history"]["seasons"] == []
    assert "Za mało danych" in report_evidence(report_with_weather(0, days=0))["headline"]
    report["agricultural"] = False
    assert "potwierdzić" in report_evidence(report)["headline"]


def test_report_download_is_pdf_with_saved_field_results(monkeypatch):
    from shutil import which
    from subprocess import run

    from fastapi.testclient import TestClient

    import main
    from wodo.experiments import experiment_checks, experiment_diagnosis

    report = report_with_weather(0)
    report.update(parcel={"id": "Test", "area_ha": 1, "geometry": {"type": "Polygon", "coordinates": [
        [[21, 52], [21.001, 52], [21.001, 52.001], [21, 52]]]}}, recommendations=[])
    report["metrics"]["history"].update(negative_seasons=1, seasons=[
        {"year": 2023, "rain_mm": 200, "et0_mm": 350, "balance_mm": -150, "samples": 180, "days": 183},
    ])
    report["scenario"] = {"input_mm": 10, "depletion_reduction_mm": [6, 8], "note": "Scenariusz porównawczy."}
    results = {"wilgotnosc-gleby": "moist"}
    report.update(experiments=experiment_checks(report), experiment_results=results,
                  experiment_conclusions=experiment_diagnosis(report, results))
    monkeypatch.setattr(main, "get_report", lambda _: report)
    client = TestClient(main.app)
    url = "/api/analysis/test/report"
    assert client.get(url, params={"format": "json"}).status_code == 422
    response = client.get(url)
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
    if which("pdftotext"):
        text = run(["pdftotext", "-", "-"], input=response.content, capture_output=True, check=True).stdout.decode()
        assert text.index("1. Analiza") < text.index("2. Eksperymenty") < text.index("3. Co możesz zrobić?")
        assert "Skąd pochodzą dane i czego brakuje?" not in text
        for label in ("Bilans uprawy", "Próg łatwo dostępnej wody (RAW)", "Symulacja dodatkowej wody",
                      "Porównanie sezonów od kwietnia do września", "180/183"):
            assert label in text
        assert "Wilgotno na głębokości korzeni" in text
        assert "Wniosek z próby" in text
