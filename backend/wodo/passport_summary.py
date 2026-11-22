from datetime import datetime
from math import isfinite
from zoneinfo import ZoneInfo

from wodo.science import CROPS, UNKNOWN_CROP, retention
from wodo.spatial import WCS_DEPTHS

# Copernicus CLMS Croplands Product User Manual, Crop Types (CTY) legend.
CLMS_LABELS = {
    "1110": "Pszenica", "1120": "Jęczmień", "1130": "Kukurydza", "1140": "Ryż", "1150": "Inne zboża",
    "1210": "Warzywa", "1220": "Rośliny strączkowe na suche nasiona", "1310": "Ziemniaki", "1320": "Burak cukrowy",
    "1410": "Słonecznik", "1420": "Soja", "1430": "Rzepak", "1440": "Len, bawełna lub konopie",
    "2100": "Winorośl", "2200": "Oliwki", "2310": "Rośliny sadownicze", "2320": "Uprawy orzechów",
}
TEXTURE_LABELS = {
    "sand": "Piaszczysta", "loamy sand": "Piaszczysta z domieszką gliny", "sandy loam": "Gliniasto-piaszczysta",
    "loam": "Gliniasta", "silt loam": "Gliniasto-pylasta", "silt": "Pylasta", "clay loam": "Gliniasta z domieszką iłu",
    "sandy clay loam": "Gliniasto-piaszczysta z domieszką iłu", "silty clay loam": "Gliniasto-pylasta z domieszką iłu",
    "sandy clay": "Ilasta z domieszką piasku", "silty clay": "Ilasta z domieszką pyłu", "clay": "Ilasta",
}


def mapping(value):
    return value if isinstance(value, dict) else {}


def number(value):
    return value if type(value) in (int, float) and isfinite(value) else None


def soil_moisture(values, day, now, observation):
    if label := {"dry": "Sucha", "moist": "Wilgotna", "wet": "Mokra"}.get(observation):
        return label, None, "Ocena podana dla dnia paszportu."
    date_label = day.strftime("%d.%m.%Y")
    if day == now.date():
        series = mapping(mapping(values.get("forecast_soil_moisture")).get("soil_moisture_0_to_1cm"))
        cutoff = now.isoformat(timespec="minutes")[:16]
        readings = [(stamp, moisture) for stamp, value in series.items()
                    if stamp.startswith(f"{day}T") and stamp <= cutoff
                    and (moisture := number(value)) is not None and 0 <= moisture <= 1]
        if readings:
            stamp, moisture = max(readings)
            return 100 * moisture, "%", f"Szacunek modelu dla warstwy 0–1 cm z {date_label}, godz. {stamp[11:16]}."
    moisture = number(mapping(values.get("soil_moisture_0_7_cm")).get(str(day)))
    if moisture is not None and 0 <= moisture <= 1:
        return 100 * moisture, "%", f"Średnia dobowa z modelu dla warstwy 0–7 cm z {date_label}."
    return None, None, None


def passport_summary(fields, day, crop, farmer_answers=None, soil_observation=None, *, now=None):
    values = {field["field"]: field["value"] for field in fields if field["status"] == "ok"}

    crop_hint = None
    if crop in CROPS and crop != UNKNOWN_CROP:
        crop_label = CROPS[crop].label
    elif isinstance(declared := values.get("crop_type_declared"), str) and declared.strip():
        crop_label = declared.strip()
    else:
        crop_label = CLMS_LABELS.get(str(values.get("crop_type_clms")))
        if crop_label:
            crop_hint = "Przybliżony rodzaj uprawy na podstawie danych satelitarnych."

    texture_hint = None
    reported = farmer_answers.soil_texture_reported if farmer_answers else None
    if reported and reported.strip().casefold() not in ("", "nie wiem", "brak danych"):
        texture = reported.strip()
        texture_hint = "Rodzaj gleby podany przez użytkownika."
    else:
        texture_code = mapping(values.get("soil_texture_class")).get("0-5cm")
        texture = TEXTURE_LABELS.get(texture_code) if isinstance(texture_code, str) else None
        if texture:
            texture_hint = "Szacunek z mapy gleby dla warstwy 0–5 cm."

    capacity = mapping(values.get("available_water_capacity"))
    # The source already subtracts the wilting point from field capacity in each layer.
    layers = [(value, 0) if (value := number(capacity.get(depth))) is not None else None for depth in WCS_DEPTHS]
    moisture, unit, moisture_hint = soil_moisture(values, day, now or datetime.now(ZoneInfo("Europe/Warsaw")), soil_observation)

    return [
        {"label": "Powierzchnia działki", "value": number(values.get("parcel_area_ha")), "unit": "ha"},
        {"label": "Rodzaj uprawy", "value": crop_label, "hint": crop_hint},
        {"label": "Rodzaj gleby", "value": texture, "hint": texture_hint},
        {"label": "Zdolność gleby do zatrzymywania wody", "value": retention(layers, .30), "unit": "mm",
         "hint": "Ilość wody dostępnej dla roślin w górnych 30 cm gleby, według modelu."},
        {"label": "Ukształtowanie terenu", "value": number(values.get("elevation_range_m")), "unit": "m",
         "hint": "Różnica między najwyższym i najniższym punktem działki."},
        {"label": "Nachylenie terenu", "value": number(values.get("slope_mean_deg")), "unit": "°",
         "hint": "Średnie nachylenie na działce."},
        {"label": "Aktualna wilgotność gleby", "value": moisture, "unit": unit, "hint": moisture_hint},
    ]
