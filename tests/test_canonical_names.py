"""One lottery, one name: the archive is relabelled from the catalogue."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import settings_loader as sl  # noqa: E402

CATALOG = [
    {"id": "china_morning", "name": "จีนเช้า"},
    {"id": "nikkei_morning", "name": "นิเคอิเช้า"},
]


def row(name, date="2026-11-26", lottery_id=None):
    return {"หวย": lottery_id or name, "ชื่อหวย": name, "งวดวันที่": date,
            "เลขบน_3_ตัว": "123", "เลขท้าย_2_ตัว": "45"}


def test_a_legacy_label_is_rewritten_to_the_catalogue_name():
    fixed = sl.with_canonical_name(row("หวยหุ้นจีนเช้า"), sl.canonical_lottery_names(CATALOG))
    assert fixed["ชื่อหวย"] == "จีนเช้า"
    assert fixed["หวย"] == "จีนเช้า"


def test_a_stored_id_survives_so_catalogue_lookups_still_work():
    fixed = sl.with_canonical_name(row("หวยหุ้นนิคเคอิเช้า", lottery_id="nikkei_morning"),
                                   sl.canonical_lottery_names(CATALOG))
    assert fixed["ชื่อหวย"] == "นิเคอิเช้า"
    assert fixed["หวย"] == "nikkei_morning"


def test_an_unknown_lottery_is_left_alone():
    original = row("หวยอะไรสักอย่าง")
    assert sl.with_canonical_name(original, sl.canonical_lottery_names(CATALOG)) is original


def test_the_whole_archive_collapses_three_labels_into_one_name(tmp_path):
    rows = [row("หวยหุ้นจีนเช้า", "2026-11-24"), row("จีนรอบเช้า", "2026-11-25"), row("จีนเช้า", "2026-11-26")]
    target = tmp_path / "results.json"
    sl.save_results(sl.canonicalize_results(rows, CATALOG), str(target))
    saved = json.loads(target.read_text(encoding="utf-8"))
    assert [item["ชื่อหวย"] for item in saved] == ["จีนเช้า"] * 3


def test_no_catalogue_means_no_rewriting():
    rows = [row("หวยหุ้นจีนเช้า")]
    assert sl.canonicalize_results(rows, None) is rows
