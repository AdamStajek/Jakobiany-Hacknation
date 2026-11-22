"""Opis pola własnymi słowami -> cztery atrybuty (gleba, teren, problem, ograniczenie).

Słownik polskich słów kluczowych, bez zewnętrznych usług. Brak rozpoznania zwraca null (nic nie zgadujemy).
"""

import re
import unicodedata

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from wodo.recommendation_catalog import OBSERVATIONS

router = APIRouter(prefix="/api", tags=["opis pola"])

# atrybut -> wartość -> (etykieta, wzorce na tekście bez diakrytyków, małymi literami)
VOCAB = {
    "soil": {
        "sandy": ("piaszczysta", [r"\bpiask\w*", r"\bpiaszcz\w*", r"\blekk(?!o)\w*"]),
        "clay": ("gliniasta", [r"\bglin\w*", r"\bilast\w*", r"\bciezk\w*\s+(?:ziem|gleb|grunt)\w*",
                               r"\b(?:ziem|gleb|grunt)\w*\s+ciezk\w*", r"\bzwart\w*"]),
        "silty": ("pylasta", [r"\bpyl\w*", r"\blessow\w*"]),
        "organic": ("torfowa", [r"\btorf\w*", r"\bmursz\w*", r"\borganiczn\w*\s+(?:ziem|gleb)\w*"]),
    },
    "terrain": {
        "sloped": ("nachylony", [r"\bskarp\w*", r"\bstok\w*", r"\bspad(?:ek|k\w*)(?!\s+(?:plon|cen|dochod|przychod))",
                                 r"\bnachyl\w*", r"\bspadzist\w*", r"\bpochyl\w*", r"\bpagork\w*", r"\bwzgorz\w*", r"\bgorzyst\w*"]),
        "flat": ("płaski", [r"\bplask\w*", r"\browni(?:n|e)\w*"]),
        "depression": ("zagłębiony", [r"\bnizin\w*", r"\bzaglebi\w*", r"\bobnizen\w*", r"\bkotlin\w*", r"\bniecka\b|\bniecki\b"]),
    },
    "problem": {
        "runoff": ("spływ powierzchniowy", [r"\bsplyw\w*", r"\bsplyn\w*", r"\bsciek\w*", r"\bsplukuj\w*", r"\bucieka\w*\s+woda|\bwoda\s+ucieka\w*"]),
        "drought": ("przesuszenie", [r"\bprzesusz\w*", r"\bsusz\w*", r"\bsuch(?:a|o|e|y)\b", r"\bwysycha\w*", r"\bprzesych\w*"]),
        "ponding": ("zastoiska wody", [r"\bzastoi\w*", r"\bpodmok\w*", r"\bpodtop\w*", r"\bzalew\w*", r"\bwoda\s+stoi\b", r"\bstoi\s+woda\b", r"\bmokr(?:o|a|e)\b"]),
        "erosion": ("erozja", [r"\berozj\w*", r"\brozmyw\w*", r"\bwymyw\w*", r"\bzmywa\w*"]),
    },
    "constraint": {
        "low_budget": ("niski budżet", [r"\bnie\s+mam\s+(?:\w+\s+)?(?:pieniedzy|pieniadzy|kasy|srodkow|funduszy)",
                                        r"\bbrak\s+(?:\w+\s+)?(?:pieniedzy|pieniadzy|kasy|srodkow|funduszy)",
                                        r"\bniski\w*\s+budzet\w*", r"\bmaly\s+budzet\w*", r"\bmalo\s+pieniedzy",
                                        r"\btanio\b", r"\btani\w*\b", r"\bnie\s+stac\b", r"\bbez\s+kosztow\w*", r"\bniskim\s+kosztem"]),
        "no_equipment": ("brak sprzętu", [r"\bbrak\s+(?:\w+\s+)?(?:sprzetu|maszyn|ciagnika\w*)",
                                          r"\bnie\s+mam\s+(?:\w+\s+)?(?:sprzetu|maszyn|ciagnika\w*)", r"\bbez\s+(?:sprzetu|maszyn)"]),
        "no_time": ("brak czasu", [r"\bbrak\s+czasu", r"\bnie\s+mam\s+czasu", r"\bmalo\s+czasu"]),
        "leased": ("dzierżawa", [r"\bdzierzaw\w*"]),
    },
}
LABELS = {"soil": "Gleba", "terrain": "Teren", "problem": "Problem", "constraint": "Ograniczenie"}
NEGATION = re.compile(r"(?:\bnie\s+ma|\bnie\s+mam|\bnie\s+wystepuje|\bbrak|\bbez)\s+(?:\w+\s+){0,2}$")
# pasujące do kluczy z recommendation_catalog.OBSERVATIONS (pomijane, gdy klucza brak w katalogu)
OBSERVATION_KEYS = {("problem", "runoff"): ["buffer_site"], ("problem", "ponding"): ["waterlogged"]}
FARMER_ANSWERS = {("problem", "runoff"): {"surface_runoff_frequency": "Czasami"},
                  ("problem", "ponding"): {"ponding_frequency": "Czasami"}}


def normalize(text):
    """Małe litery i brak diakrytyków; długość zachowana, więc indeksy pasują do oryginału."""
    out = []
    for char in text:
        char = char.lower()
        base = "l" if char == "ł" else unicodedata.normalize("NFD", char)[0]
        out.append(base if len(base) == 1 else char)
    return "".join(out)


def find(attribute, normalized):
    best = None
    for value, (_label, patterns) in VOCAB[attribute].items():
        for pattern in patterns:
            for match in re.finditer(pattern, normalized):
                if attribute != "constraint" and NEGATION.search(normalized[: match.start()]):
                    continue
                if best is None or match.start() < best[0]:
                    best = (match.start(), match.end(), value)
                break
    return best


def describe(text):
    normalized = normalize(text)
    result = {}
    for attribute in VOCAB:
        hit = find(attribute, normalized)
        if hit is None:
            result[attribute] = {"value": None, "label": None, "matched": None}
        else:
            start, end, value = hit
            result[attribute] = {"value": value, "label": VOCAB[attribute][value][0], "matched": text[start:end]}
    return result


def observation_keys(attributes):
    keys = []
    for attribute, item in attributes.items():
        for key in OBSERVATION_KEYS.get((attribute, item["value"]), []):
            if key in OBSERVATIONS and key not in keys:
                keys.append(key)
    return keys


def farmer_answers_hint(attributes):
    hint = {}
    for attribute, item in attributes.items():
        hint |= FARMER_ANSWERS.get((attribute, item["value"]), {})
    return hint


def options():
    return {a: [{"value": v, "label": label} for v, (label, _p) in values.items()] for a, values in VOCAB.items()}


class DescribeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(max_length=1000)


@router.post("/describe-field")
def describe_field(request: DescribeRequest):
    attributes = describe(request.text)
    return {
        **attributes,
        "observation_keys": observation_keys(attributes),
        "farmer_answers": farmer_answers_hint(attributes),
        "options": options(),
        "attribute_labels": LABELS,
    }
