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
