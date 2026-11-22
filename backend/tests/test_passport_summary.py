from datetime import datetime
from zoneinfo import ZoneInfo

from wodo.passport_summary import passport_summary

NOW = datetime(2026, 7, 1, 10, 30, tzinfo=ZoneInfo("Europe/Warsaw"))


def fields(**values):
    return [{"field": key, "status": "ok", "value": value} for key, value in values.items()]


def test_passport_summary_displays_seven_facts_and_ignores_future_moisture():
    summary = passport_summary(fields(
        parcel_area_ha=1.25,
        crop_type_clms="1130",
        soil_texture_class={"0-5cm": "loamy sand"},
        available_water_capacity={"0-5cm": 120, "5-15cm": 150, "15-30cm": 170},
        elevation_range_m=0,
        slope_mean_deg=0,
        forecast_soil_moisture={"soil_moisture_0_to_1cm": {
            "2026-07-01T09:00": .17, "2026-07-01T10:00": .18, "2026-07-01T11:00": .25,
        }},
    ), NOW.date(), None, now=NOW)
    assert [fact["label"] for fact in summary] == [
        "Powierzchnia działki", "Rodzaj uprawy", "Rodzaj gleby", "Zdolność gleby do zatrzymywania wody",
        "Ukształtowanie terenu", "Nachylenie terenu", "Aktualna wilgotność gleby",
    ]
    assert [fact["value"] for fact in summary] == [1.25, "Kukurydza", "Piaszczysta z domieszką gliny", 46.5, 0, 0, 18]
    assert summary[-1]["unit"] == "%" and "10:00" in summary[-1]["hint"]


def test_passport_summary_keeps_missing_facts_including_stale_moisture():
    summary = passport_summary(fields(
        crop_type_clms="3100",
        available_water_capacity={"0-5cm": 120},
        soil_moisture_0_7_cm={"2026-06-30": .24},
    ) + [{"field": "slope_mean_deg", "value": 5, "status": "error"}], NOW.date(), "unknown", now=NOW)
    assert len(summary) == 7 and all(fact["value"] is None for fact in summary)


def test_passport_summary_prefers_declared_crop_and_can_use_daily_moisture():
    summary = passport_summary(fields(
        crop_type_clms="1130", soil_moisture_0_7_cm={str(NOW.date()): 0},
    ), NOW.date(), "potato", now=NOW)
    assert summary[1]["value"] == "Ziemniak"
    assert summary[-1]["value"] == 0 and "0–7 cm" in summary[-1]["hint"]
