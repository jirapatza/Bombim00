"""One table for Thai draw dates: every provider spelling must parse the same."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

import thai_calendar as cal  # noqa: E402
import settings_loader as sl  # noqa: E402


def test_every_spelling_of_one_date_parses():
    for text in ("20 พฤศจิกายน 2569", "20 พ.ย. 2569", "20 พ.ย 2569",
                 "20.11.2569", "20/11/2569", "2026-11-20", "2569-11-20"):
        assert cal.thai_date_to_iso(text) == "2026-11-20", text


def test_short_months_cover_the_whole_year():
    assert cal.thai_date_to_iso("1 ม.ค. 2569") == "2026-01-01"
    assert cal.thai_date_to_iso("31 ธ.ค. 2569") == "2026-12-31"


def test_impossible_dates_are_rejected_not_guessed():
    assert cal.thai_date_to_iso("31 กุมภาพันธ์ 2569") == ""
    assert cal.thai_date_to_iso("ไม่ระบุ") == ""


def test_round_trip():
    assert cal.iso_to_thai_date("2026-11-20") == "20 พฤศจิกายน 2569"
    assert cal.thai_date_to_iso(cal.iso_to_thai_date("2026-11-20")) == "2026-11-20"


def test_the_checker_and_the_collector_read_a_date_the_same_way():
    row = {"งวดวันที่": "20 พ.ย. 2569"}
    assert sl._parse_draw_date(row).isoformat() == "2026-11-20"
    assert cal.thai_date_to_iso(row["งวดวันที่"]) == "2026-11-20"
