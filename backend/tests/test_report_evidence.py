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
