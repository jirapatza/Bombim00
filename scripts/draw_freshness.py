"""Find lotteries whose latest published draw is older than their own schedule.

A source that answers with stale data looks healthy to every status check we
have, so this compares each draw against the schedule the catalogue declares.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta

THAI_WEEKDAYS = {
    "จันทร์": 0,
    "อังคาร": 1,
    "พุธ": 2,
    "พฤหัสบดี": 3,
    "ศุกร์": 4,
    "เสาร์": 5,
    "อาทิตย์": 6,
}
THAI_MONTHS = {
    "มกราคม": 1,
    "กุมภาพันธ์": 2,
    "มีนาคม": 3,
    "เมษายน": 4,
    "พฤษภาคม": 5,
    "มิถุนายน": 6,
    "กรกฎาคม": 7,
    "สิงหาคม": 8,
    "กันยายน": 9,
    "ตุลาคม": 10,
    "พฤศจิกายน": 11,
    "ธันวาคม": 12,
}
GRACE_MINUTES = 180
MIN_MISSED = 2
DEFAULT_IGNORED = "thai_gov,gsb,baac,russia"


def draw_weekdays(text):
    """Weekdays the lottery draws on, or None when the catalogue does not say."""
    text = (text or "").strip()
    if not text or "ประกาศ" in text:
        return None
    if text.startswith("ทุกวัน"):
        return set(range(7))
    names = [name for name in THAI_WEEKDAYS if name in text]
    if not names:
        return None
    if "-" in text and len(names) >= 2:
        start = THAI_WEEKDAYS[names[0]]
        end = THAI_WEEKDAYS[names[-1]]
        if start > end:
            return set(range(7))
        return set(range(start, end + 1))
    return {THAI_WEEKDAYS[name] for name in names}


def thai_date(text):
    """`20 พฤศจิกายน 2569` as a date, or None."""
    match = re.match(r"(\d{1,2})\s+(\S+)\s+(\d{4})", (text or "").strip())
    if not match:
        return None
    month = THAI_MONTHS.get(match.group(2))
    if not month:
        return None
    try:
        return date(int(match.group(3)) - 543, month, int(match.group(1)))
    except ValueError:
        return None


def close_minutes(text):
    """`16:00 น.` as minutes after midnight, or None."""
    match = re.search(r"(\d{1,2})[:.](\d{2})", text or "")
    if not match:
        return None
    return int(match.group(1)) * 60 + int(match.group(2))


def missed_draws(row, now):
    """Draws the lottery should have published since its stored draw date."""
    weekdays = draw_weekdays(row.get("drawDays"))
    stored = thai_date(row.get("date"))
    close = close_minutes(row.get("closeTimeStr"))
    if weekdays is None or stored is None or close is None:
        return 0
    count = 0
    day = stored + timedelta(days=1)
    while day <= now.date():
        if day.weekday() in weekdays:
            deadline = datetime.combine(
                day, datetime.min.time(), tzinfo=now.tzinfo
            ) + timedelta(minutes=close + GRACE_MINUTES)
            if deadline <= now:
                count += 1
        day += timedelta(days=1)
    return count


def freshness_row(rows, now, ignored=DEFAULT_IGNORED):
    """One report row naming the draws that are behind their schedule.

    A single missed draw is ordinary publication latency, so only a lottery that
    has missed two or more keeps the row out of the green state.
    """
    skip = {name.strip() for name in (ignored or "").split(",") if name.strip()}
    late = []
    for row in rows or []:
        if row.get("id") in skip:
            continue
        missed = missed_draws(row, now)
        if missed >= MIN_MISSED:
            late.append((missed, row.get("name") or row.get("id") or "?"))
    if not rows:
        return ("data freshness", "❔", "no lottery rows readable")
    if not late:
        return ("data freshness", "✅", f"{len(rows)} lotteries current")
    late.sort(reverse=True)
    shown = ", ".join(f"{name} {missed}" for missed, name in late[:5])
    if len(late) > 5:
        shown += f" +{len(late) - 5} more"
    return ("data freshness", "⚠️", f"{len(late)} behind: {shown}")
