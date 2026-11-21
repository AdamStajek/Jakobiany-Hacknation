import pytest
from pydantic import ValidationError

import main

PARCEL = {
    "id": "301103_2.0009.549/7",
    "geometry": {"type": "Polygon", "coordinates": [[[16, 52], [17, 52], [17, 53], [16, 52]]]},
}
ZONE = {
    "geometry": {"type": "Point", "coordinates": [16.8, 52.2]},
    "type": "Zastoiska",
    "date": "2024-06-11",
    "description": "",
}


def test_farmer_answers_cover_csv_and_are_stored_with_report(monkeypatch):
    optional = {item["field"] for item in main.farmer_questions()} - {"current_crop", "sowing_date", "growth_stage"}
    assert len(optional) == 12
    answers = dict.fromkeys(optional, "Nie wiem")
    answers.update(
        problem_zones=[ZONE],
        irrigation_water_source=["Studnia"],
        irrigation_events=[{"date": "2024-06-20", "dose_mm": None}],
    )
    monkeypatch.setattr(main, "lookup", lambda _id: [PARCEL])
    monkeypatch.setattr(main, "run", lambda *_: {"agricultural": False, "sources": [], "missing": {}})
    monkeypatch.setattr(main, "report_message", lambda _: "")
    saved = {}
    monkeypatch.setattr(main, "write", lambda key, value: saved.update({key: value}))

    request = main.AnalysisRequest(parcel_id=PARCEL["id"], date="2024-07-05", farmer_answers=answers)
    report = main.execute_analysis(request)

    assert saved[f"report:{report['analysis_id']}"]["farmer_answers"] == answers


def test_farmer_answers_reject_future_dates_and_points_outside_field():
    with pytest.raises(ValidationError, match="nie może wykraczać"):
        main.AnalysisRequest(parcel_id=PARCEL["id"], date="2024-06-10", farmer_answers={"problem_zones": [ZONE]})

    answers = main.FarmerAnswers(problem_zones=[{**ZONE, "geometry": {"type": "Point", "coordinates": [18, 53]}}])
    with pytest.raises(ValueError, match="wewnątrz granicy"):
        answers.validate_zones(PARCEL["geometry"])
