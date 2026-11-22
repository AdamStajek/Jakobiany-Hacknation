import re

import pytest
from fastapi.testclient import TestClient

import main
from wodo.notify import templates

XHR = {"X-Requested-With": "test"}


@pytest.fixture
def client():
    main.buckets.clear()
    with TestClient(main.app, headers=XHR) as c:
        yield c


def describe(client, text):
    response = client.post("/api/describe-field", json={"text": text})
    assert response.status_code == 200
    return response.json()


CASES = [
    ("Pole jest na skarpie, ziemia lekka, po ulewach woda spływa, nie mam pieniędzy na drenaż",
     ("sandy", "sloped", "runoff", "low_budget")),
    ("POLE NA STOKU, GLEBA PIASZCZYSTA, SUSZA, BRAK SPRZĘTU", ("sandy", "sloped", "drought", "no_equipment")),
    ("pole na skarpie ziemia lekka woda splywa nie mam pieniedzy", ("sandy", "sloped", "runoff", "low_budget")),
    ("Ciężka ziemia, podmokłe miejsca, chcę tanio", ("clay", None, "ponding", "low_budget")),
    ("Gleba gliniasta, duży spadek, erozja, brak czasu", ("clay", "sloped", "erosion", "no_time")),
    ("płaskie pole, torf, zastoiska wody", ("organic", "flat", "ponding", "no")),
    ("Dzierżawię, pole przesusza się latem", (None, None, "drought", "leased")),
    ("Wody ściekają ze wzgórza", (None, "sloped", "runoff", None)),
]


@pytest.mark.parametrize("text,expected", CASES)
def test_attributes(client, text, expected):
    body = describe(client, text)
    got = tuple(body[key]["value"] for key in ("soil", "terrain", "problem", "constraint"))
    expected = tuple(None if v == "no" else v for v in expected)
    if expected[3] == "no":
        expected = expected[:3] + (None,)
    assert got == tuple(expected)
    for key in ("soil", "terrain", "problem", "constraint"):
        item = body[key]
        assert (item["value"] is None) == (item["label"] is None) == (item["matched"] is None)


def test_matched_fragment_is_original_text(client):
    body = describe(client, "Pole na SKARPIE, Nie mam pieniędzy")
    assert body["terrain"]["matched"] == "SKARPIE"
    assert body["constraint"]["matched"] == "Nie mam pieniędzy"
    assert body["terrain"]["label"] == "nachylony"


@pytest.mark.parametrize("text", [
    "", "Mam pole pod pszenicę", "Spadek plonów w zeszłym roku", "Na polu nie ma spływu ani zastoisk", "Ciężki sprzęt stoi w garażu",
])
def test_negative_not_guessed(client, text):
    body = describe(client, text)
    assert all(body[k]["value"] is None for k in ("soil", "terrain", "problem", "constraint")), body
    assert body["observation_keys"] == []


def test_observation_keys_exist_in_catalog(client):
    from wodo.recommendation_catalog import OBSERVATIONS

    body = describe(client, "woda spływa, a w dole podmokło")
    assert body["observation_keys"] and set(body["observation_keys"]) <= set(OBSERVATIONS)
    assert body["options"]["soil"][0]["value"] == "sandy"


def test_text_limit(client):
    assert client.post("/api/describe-field", json={"text": "a" * 1001}).status_code == 422


DEFAULT_RAIN = {
    "subject": "Nadchodzą intensywne opady — zadbaj o zatrzymanie wody na swoim polu",
    "happening": "Prognozowane są intensywne opady deszczu. Twoje pole jest nachylone, a jego piaszczysta gleba ma ograniczoną zdolność magazynowania wody. Istnieje podwyższone ryzyko, że część wody spłynie w dół działki, zamiast wsiąknąć w glebę.",
    "why": "Spowolnienie odpływu może zwiększyć ilość wody zatrzymywanej w glebie i ograniczyć jej straty podczas ulewnych deszczy.",
}


def test_rain_default_exact():
    mail = templates.demo("rain")
    assert mail["subject"] == DEFAULT_RAIN["subject"]
    assert mail["sections"]["happening"] == DEFAULT_RAIN["happening"]
    assert mail["sections"]["why"] == DEFAULT_RAIN["why"]
    assert mail["sections"]["actions"][2] == "Po opadach sprawdź dolną część pola, aby zidentyfikować miejsca największego spływu."


def test_residue_default_exact():
    mail = templates.demo("residue")
    s = mail["sections"]
    assert mail["subject"] == "Zbiory kukurydzy za tydzień — pozostaw resztki pożniwne na wskazanej części pola"
    assert s["happening"].startswith("Zbliżają się zbiory kukurydzy.")
    assert "Wyniki wcześniejszego eksperymentu na Twoim polu wskazały, że gleba" in s["happening"]
    assert s["actions"][0] == "Na górnej, piaszczystej części pola po zbiorach pozostaw równomiernie rozdrobnione resztki kukurydzy na powierzchni gleby."
    assert s["why"].endswith("bez konieczności inwestowania w dodatkowy sprzęt.")


@pytest.mark.parametrize("kind", ["rain", "residue"])
@pytest.mark.parametrize("kwargs", [{}, {"field_name": "Łąka <1>", "soil": "clay", "terrain": "flat"}])
def test_templates_fully_substituted(kind, kwargs):
    mail = templates.demo(kind, **kwargs)
    for part in (mail["subject"], mail["text"], mail["html"]):
        assert part.strip() and not re.search(r"\{|\}|None|\bnull\b", part)
    assert all(x.strip() for x in mail["sections"]["actions"]) and len(mail["sections"]["actions"]) == 3
    for heading in ("Co się dzieje?", "Co warto zrobić?", "Dlaczego?"):
        assert heading in mail["text"] and heading in mail["html"]
    if kwargs:
        assert "&lt;1&gt;" in mail["html"] and "<1>" not in mail["html"]
        assert "gliniast" in mail["text"]


@pytest.mark.parametrize("kind", ["rain", "residue"])
def test_demo_endpoint(client, kind):
    response = client.get(f"/api/notifications/demo/{kind}", params={"field_name": "Za stodołą"})
    assert response.status_code == 200
    body = response.json()
    assert body["demo"] is True and body["sent"] is False
    assert set(body) >= {"subject", "html", "text"} and "Za stodołą" in body["text"]


def test_demo_endpoint_rejects_unknown(client):
    assert client.get("/api/notifications/demo/snow").status_code == 422
    assert client.get("/api/notifications/demo/rain", params={"soil": "x"}).status_code == 422
