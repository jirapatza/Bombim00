"""Thai draw dates, read the same way everywhere.

Providers write the same draw date as `20 พฤศจิกายน 2569`, `20 พ.ย. 2569`,
`20.11.2569` or `2026-11-20`, and some mix Buddhist-era years into ISO strings.
Four modules used to carry their own month table, so a format one of them
understood was rejected by another. This is the single table.
"""

import datetime
import re

THAI_MONTHS = (
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
)

_SHORT_MONTHS = (
    "ม.ค", "ก.พ", "มี.ค", "เม.ย", "พ.ค", "มิ.ย",
    "ก.ค", "ส.ค", "ก.ย", "ต.ค", "พ.ย", "ธ.ค",
)

# Both `พ.ย` and `พ.ย.` are in use; the dotted spelling is stripped by callers.
THAI_MONTH_NUMBERS = {name: number for number, name in enumerate(THAI_MONTHS, start=1)}
THAI_MONTH_NUMBERS.update({name: number for number, name in enumerate(_SHORT_MONTHS, start=1)})

_ISO = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})")
_THAI = re.compile(r"^(\d{1,2})\s+(\S+)\s+(\d{4})$")
_NUMERIC = re.compile(r"^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$")


def _buddhist_to_gregorian(year):
    return year - 543 if year >= 2400 else year


def parse_thai_date(text):
    """Any of the four shapes as a date, or None when it cannot be read."""
    value = (text or "").strip()
    iso = _ISO.match(value)
    if iso:
        return _build(int(iso.group(3)), int(iso.group(2)), int(iso.group(1)))
    thai = _THAI.match(value)
    if thai:
        month = THAI_MONTH_NUMBERS.get(thai.group(2).rstrip("."))
        if month:
            return _build(int(thai.group(1)), month, int(thai.group(3)))
    numeric = _NUMERIC.match(value)
    if numeric:
        return _build(int(numeric.group(1)), int(numeric.group(2)), int(numeric.group(3)))
    return None


def _build(day, month, year):
    try:
        return datetime.date(_buddhist_to_gregorian(year), month, day)
    except ValueError:
        return None


def thai_date_to_iso(text):
    """`20 พฤศจิกายน 2569` as `2026-11-20`, or '' when unparseable."""
    parsed = parse_thai_date(text)
    return parsed.isoformat() if parsed else ""


def iso_to_thai_date(iso):
    """`2026-11-20` as `20 พฤศจิกายน 2569`, or '' when unparseable."""
    parsed = parse_thai_date(iso)
    if not parsed:
        return ""
    return f"{parsed.day} {THAI_MONTHS[parsed.month - 1]} {parsed.year + 543}"
