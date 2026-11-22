from datetime import date, timedelta

from wodo.science import assess, dates, wheat_period_signal


def test_period_signal_uses_last_complete_period_and_requires_every_day():
    start, end = date(2024, 4, 21), date(2024, 6, 20)
    rows = {str(day): [0, 2, 17] for day in dates(start, end)}
    rows[str(end)] = [2, 2, 17]
    selected = end + timedelta(days=5)
    rows[str(selected)] = [150, 0, 17]
    signal = assess(rows, None, "wheat", selected)["period_drought"]
    assert signal == {"start": str(start), "end": str(end), "balance_mm": -120, "threshold_mm": -120, "alarm": True}
    assert assess(rows, None, "maize", selected)["period_drought"] is None
    rows[str(start)][0] = 1
    assert not wheat_period_signal(rows, selected)["alarm"]
    del rows[str(start)]
    assert wheat_period_signal(rows, selected) is None
    assert wheat_period_signal(rows, date(2024, 8, 1)) is None
