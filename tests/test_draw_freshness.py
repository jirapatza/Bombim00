from datetime import datetime
from zoneinfo import ZoneInfo

from scripts.draw_freshness import (
    close_minutes,
    draw_weekdays,
    freshness_row,
    missed_draws,
    thai_date,
)

BANGKOK = ZoneInfo("Asia/Bangkok")


def row(**overrides):
    base = {
        "id": "taiwan",
        "name": "ไต้หวัน",
        "date": "20 พฤศจิกายน 2569",
        "drawDays": "จันทร์ - ศุกร์",
        "closeTimeStr": "12:05 น.",
    }
    base.update(overrides)
    return base


def test_thai_date_converts_the_buddhist_year():
    assert str(thai_date("20 พฤศจิกายน 2569")) == "2026-11-20"
    assert thai_date("not a date") is None


def test_close_minutes_reads_the_thai_clock():
    assert close_minutes("16:00 น.") == 960
    assert close_minutes("no clock") is None


def test_draw_weekdays_understands_the_four_catalogue_shapes():
    assert draw_weekdays("ทุกวัน (จันทร์ - อาทิตย์)") == set(range(7))
    assert draw_weekdays("จันทร์ - ศุกร์") == {0, 1, 2, 3, 4}
    assert draw_weekdays("อังคาร - เสาร์") == {1, 2, 3, 4, 5}
    assert draw_weekdays("จันทร์, พุธ, ศุกร์") == {0, 2, 4}
    assert draw_weekdays("ตามประกาศวันงวดจริง (อาจเลื่อน)") is None


def test_missed_draws_skips_the_weekend_and_waits_for_the_grace_period():
    now = datetime(2026, 11, 25, 16, 45, tzinfo=BANGKOK)
    assert missed_draws(row(), now) == 3
    early = datetime(2026, 11, 23, 9, 0, tzinfo=BANGKOK)
    assert missed_draws(row(), early) == 0


def test_freshness_row_stays_green_when_only_todays_draw_is_pending():
    now = datetime(2026, 11, 25, 13, 0, tzinfo=BANGKOK)
    _, state, detail = freshness_row([row(date="24 พฤศจิกายน 2569")], now, "")
    assert state == "✅" and detail == "1 lotteries current"


def test_freshness_row_names_a_silent_source():
    now = datetime(2026, 11, 25, 16, 45, tzinfo=BANGKOK)
    _, state, detail = freshness_row([row()], now, "")
    assert state == "⚠️" and detail.startswith("1 behind: ไต้หวัน 3")


def test_freshness_row_honours_the_ignored_list():
    now = datetime(2026, 11, 25, 16, 45, tzinfo=BANGKOK)
    _, state, detail = freshness_row([row()], now, "taiwan")
    assert state == "✅"
