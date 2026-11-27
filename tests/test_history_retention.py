"""The archive must stop growing; both writers keep the newest 60 draws of a lottery."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import settings_loader as sl  # noqa: E402


def row(name, date, top3="123"):
    return {"ชื่อหวย": name, "หวย": name, "งวดวันที่": date, "วันที่จัดรูปแบบ": date,
            "เลขบน_3_ตัว": top3, "เลขล่าง_2_ตัว": "45", "หมวดหวย": "stock"}


def test_a_lottery_keeps_its_newest_sixty_draws():
    rows = [row("จีนเช้า", f"2026-09-{day:02d}") for day in range(1, 31)]
    rows += [row("จีนเช้า", f"2026-10-{day:02d}") for day in range(1, 31)]
    rows += [row("จีนเช้า", f"2026-11-{day:02d}") for day in range(1, 16)]
    kept = sl.trim_results(rows)
    assert len(kept) == 60
    assert kept[0]["งวดวันที่"] == "2026-09-16", "the oldest draws go first"
    assert kept[-1]["งวดวันที่"] == "2026-11-15", "the newest draw survives"


def test_a_legacy_label_shares_the_budget_of_its_lottery():
    rows = [row("จีนเช้า", f"2026-11-{day:02d}") for day in range(1, 21)]
    rows += [row("จีนเช้า", f"2026-10-{day:02d}") for day in range(1, 21)]
    rows += [row("หวยหุ้นจีนเช้า", f"2026-09-{day:02d}") for day in range(1, 21)]
    rows += [row("หวยหุ้นจีนเช้า", f"2026-08-{day:02d}") for day in range(1, 21)]
    kept = sl.trim_results(rows)
    assert len(kept) == 60, "80 rows of one lottery trim to 60, not 60 per label"
    assert not any(item["งวดวันที่"].startswith("2026-08") for item in kept), "the oldest rows go first"


def test_other_lotteries_are_untouched():
    rows = [row("จีนเช้า", f"2026-11-{day:02d}") for day in range(1, 31)]
    rows += [row("ลาว TV", f"2026-11-{day:02d}") for day in range(1, 31)]
    assert len(sl.trim_results(rows)) == 60


def test_save_results_writes_the_trimmed_history(tmp_path):
    target = tmp_path / "history.json"
    rows = [row("จีนเช้า", f"2026-09-{day:02d}") for day in range(1, 31)]
    rows += [row("จีนเช้า", f"2026-10-{day:02d}") for day in range(1, 31)]
    rows += [row("จีนเช้า", f"2026-11-{day:02d}") for day in range(1, 31)]
    sl.save_results(rows, str(target))
    saved = sl.load_previous_results(str(target))
    assert len(saved) == 60
    assert saved[-1]["งวดวันที่"] == "2026-11-30"
