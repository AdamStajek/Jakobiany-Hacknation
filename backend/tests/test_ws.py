from datetime import date

from fastapi.testclient import TestClient

import main
from wodo.analysis import SOURCE_LABELS


def test_ws_streams_progress_then_result(monkeypatch):
    def fake(request, on_progress=None):
        for i, label in enumerate(list(SOURCE_LABELS.values())[:3], 1):
            on_progress(i, 3, label)
        return {"analysis_id": "x", "day": date(2024, 1, 1)}

    monkeypatch.setattr(main, "execute_analysis", fake)
    body = {"parcel_id": "141201_1.0001.1", "crop": "wheat", "date": date.today().isoformat()}
    with TestClient(main.app).websocket_connect("/api/ws/analysis") as ws:
        ws.send_json(body)
        events = []
        while True:
            events.append(ws.receive_json())
            if events[-1]["type"] != "progress":
                break
    assert [e["done"] for e in events[:-1]] == [0, 1, 2, 3]
    assert events[-1]["type"] == "result" and events[-1]["report"]["day"] == "2024-01-01"


def test_ws_rejects_invalid_input():
    with TestClient(main.app).websocket_connect("/api/ws/analysis") as ws:
        ws.send_json({"crop": "nope", "date": "2024-01-01"})
        event = ws.receive_json()
    assert event["type"] == "error" and event["status"] == 422


def _passport_events(body, monkeypatch=None):
    with TestClient(main.app).websocket_connect("/api/ws/passport") as ws:
        ws.send_json(body)
        events = []
        while True:
            events.append(ws.receive_json())
            if events[-1]["type"] != "progress":
                return events


def test_passport_ws_streams_progress_then_summary(monkeypatch):
    def fake(parcel_id, geojson, as_of, crop, sowing, stage, irrigation_mm, **kwargs):
        for i, label in enumerate(["Pogoda", "Gleba"], 1):
            kwargs["on_progress"](i, 3, label)
        kwargs["on_progress"](3, 3, "Obliczam podsumowanie")
        return {"parcel_id": parcel_id, "analysis_as_of": date(2024, 1, 1), "fields": [{"field": "x"}],
                "summary": [], "farmer_report": {"situation": "ok", "next_check": None, "steps": []}}

    monkeypatch.setattr(main, "build_passport", fake)
    events = _passport_events({"parcel_id": "141201_1.0001.1", "crop": "wheat"})
    assert [e["label"] for e in events[:-1]] == ["Pogoda", "Gleba", "Obliczam podsumowanie"]
    passport = events[-1]["passport"]
    assert events[-1]["type"] == "result" and "fields" not in passport and "steps" not in passport["farmer_report"]
    assert passport["analysis_as_of"] == "2024-01-01"


def test_passport_ws_rejects_invalid_input():
    events = _passport_events({"parcel_id": "x" * 200})
    assert events[-1]["type"] == "error" and events[-1]["status"] == 422


def test_passport_cache_hit_has_no_progress(monkeypatch):
    main.passport_cache.clear()
    calls = []

    def fake_collect(parcel, day, crop, sowing, stage, irrigation_mm, on_progress=None):
        calls.append(day)
        on_progress(1, 1, "Pogoda")
        return {"parcel_id": parcel["id"], "analysis_as_of": day, "fields": []}

    monkeypatch.setattr(main, "collect", fake_collect)
    monkeypatch.setattr(main, "lookup", lambda pid: [{"id": pid, "geometry": {}}])
    monkeypatch.setattr(main, "matches", lambda items: {"parcels": items})
    monkeypatch.setattr(main, "passport_summary", lambda *a, **k: [])
    monkeypatch.setattr(main, "analyze_field", lambda *a, **k: {"farmer_report": {"situation": "s", "next_check": None}})
    body = {"parcel_id": "141201_1.0001.1", "as_of": date.today().isoformat()}
    first = _passport_events(body)
    second = _passport_events(body)
    assert [e["type"] for e in first] == ["progress", "progress", "result"]
    assert [e["type"] for e in second] == ["result"]
    assert len(calls) == 1
    main.passport_cache.clear()


def test_passport_summary_view_drops_fields():
    full = {"parcel_id": "p", "analysis_as_of": "2024-01-01", "fields": [1], "summary": [{"label": "a"}],
            "farmer_report": {"situation": "s", "next_check": "n", "steps": [1]}}
    assert main.passport_view(full, "full") is full
    assert main.passport_view(full, "summary") == {
        "parcel_id": "p", "analysis_as_of": "2024-01-01", "summary": [{"label": "a"}],
        "farmer_report": {"situation": "s", "next_check": "n"}}
