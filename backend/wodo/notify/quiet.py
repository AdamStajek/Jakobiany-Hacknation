"""Godziny ciszy: powiadomienia czekają do następnego sprawdzenia, aż cisza się skończy."""

import re
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

TIME = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
DEFAULT_TIMEZONE = "Europe/Warsaw"


def valid_timezone(name):
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        return False
    return True


def minutes(value):
    hours, mins = value.split(":")
    return int(hours) * 60 + int(mins)


def is_quiet(moment, timezone, start, end):
    """Czy chwila `moment` (znacznik czasu) mieści się w ciszy [start, end) w strefie użytkownika."""
    local = datetime.fromtimestamp(moment, ZoneInfo(timezone))
    now = local.hour * 60 + local.minute
    first, last = minutes(start), minutes(end)
    if first == last:
        return False
    if first < last:
        return first <= now < last
    return now >= first or now < last


def quiet_now(db, user_id, moment):
    row = db.execute(
        "SELECT quiet_enabled, quiet_start, quiet_end, timezone FROM notification_settings "
        "WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if row is None or not row["quiet_enabled"] or not valid_timezone(row["timezone"]):
        return False
    return is_quiet(moment, row["timezone"], row["quiet_start"], row["quiet_end"])
