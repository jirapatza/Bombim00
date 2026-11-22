#!/usr/bin/env python3
"""Refresh data/all_lotteries.json with the latest verified real draw per lottery.

The catalog schema is fixed: only status/top3/bottom2/firstPrize/date/source are
updated. A lottery without corroborated evidence keeps `waiting` and records the
reason in the evidence file instead of inventing a result.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import lottery_sources as sources  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "data" / "all_lotteries.json"
EVIDENCE_PATH = ROOT / "data" / "all_lotteries_evidence.json"
REPORT_PATH = ROOT / "data" / "all_lotteries_report.json"
LOG_DIR = ROOT / "logs"

RESULT_FIELDS = ("status", "top3", "bottom2", "firstPrize", "date", "source", "threeDigits")
# Keys that only some sources publish; a stale copy must not survive a refresh.
OPTIONAL_RESULT_FIELDS = ("threeDigits", "front3", "back3")
RESULT_KEYS = ("id", "name", "category", "categoryLabel", "period", "periodLabel",
               "flag", "drawTimeStr", "closeTimeStr", "drawDays", "status", "top3",
               "bottom2", "firstPrize", "date", "source")

# What the evidence file may claim about a result's corroboration.
VERDICT_NOTE = {"agree": "ตรงกับสองแหล่ง", "single": "แหล่งเดียว", "conflict": ""}

# Regular stock lotteries published by both sources; the two must agree.
CROSS_CHECK = {
    "nikkei_morning": ("stocknikkei1", "stock", r"นิคเคอิเช้า"),
    "china_morning": ("stockchina1", "stock", r"จีนเช้า"),
    "hangseng_morning": ("stockhangseng1", "stock", r"ฮั่งเส็งเช้า"),
    "taiwan": ("stocktaiwan", "stock", r"ไต้หวัน"),
    "korea": ("stockkorea", "stock", r"เกาหลี"),
    "nikkei_afternoon": ("stocknikkei2", "stock", r"นิคเคอิบ่าย"),
    "china_afternoon": ("stockchina2", "stock", r"จีนบ่าย"),
    "hangseng_afternoon": ("stockhangseng2", "stock", r"ฮั่งเส็งบ่าย"),
    "singapore": ("stocksingapore", "stock", r"สิงคโปร์"),
    "thai_stock_evening": ("stockthai4", "stock", r"ไทยเย็น"),
    "india": ("stockindia", "stock", r"อินเดีย"),
}


def log(message: str) -> None:
    stamp = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7)))
    line = f"[{stamp.strftime('%Y-%m-%d %H:%M:%S')}] {message}"
    print(line)
    try:
        LOG_DIR.mkdir(exist_ok=True)
        with open(LOG_DIR / f"collector-{stamp.date().isoformat()}.log", "a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass


def atomic_write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temp_name = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(payload, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, path)
    except BaseException:
        Path(temp_name).unlink(missing_ok=True)
        raise


def load_catalog(path: Path = CATALOG_PATH) -> list:
    catalog = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(catalog, list):
        raise SystemExit("catalog must be a JSON array")
    ids = [item.get("id") for item in catalog if isinstance(item, dict)]
    if sorted(ids) != sorted(sources.CATALOG_SOURCES):
        raise SystemExit("catalog ids must match the source map in lottery_sources.py, "
                         f"missing={sorted(set(sources.CATALOG_SOURCES) - set(ids))} "
                         f"unknown={sorted(set(ids) - set(sources.CATALOG_SOURCES))}")
    for item in catalog:
        missing = [key for key in RESULT_KEYS if key not in item]
        if missing:
            raise SystemExit(f"catalog item {item.get('id')} lost fields: {missing}")
    return catalog


def stored_result(item: dict) -> str:
    """ISO date of the result already stored on the entry, or '' when unusable."""
    if item.get("status") != "announced":
        return ""
    if not (re.fullmatch(r"[0-9]{3}", item.get("top3") or "") and
            re.fullmatch(r"[0-9]{2}", item.get("bottom2") or "")):
        return ""
    return sources.thai_date_to_iso(str(item.get("date") or ""))


def cross_check(catalog_id: str, src: dict) -> tuple[str, str]:
    """Corroborate a result against the second source.

    Returns (verdict, detail): "agree" only when both sources published the same
    draw with the same numbers, "single" when the second source has nothing to
    compare for that draw, "conflict" when they disagree. Claiming agreement
    without a comparable second observation is what made the evidence file
    misleading: most catalog entries rest on one provider.
    """
    spec = CROSS_CHECK.get(catalog_id)
    if not spec:
        return "single", ""
    key, group, label_regex = spec
    tla = src["tla"].get(key)
    cards = [row for row in src["stocks"]
             if row.extra.get("group") == group and re.search(label_regex, row.label)]
    if not tla or not cards:
        return "single", ""
    card = max(cards, key=lambda row: row.draw_date)
    if card.draw_date != tla.draw_date:
        return "single", f"ผลหวย.com ยังไม่มีผลงวด {tla.draw_date}"
    if (card.top3, card.bottom2) != (tla.top3, tla.bottom2):
        return ("conflict", f"แหล่งข้อมูลขัดแย้งกัน: ThaiLottoAPI {tla.top3}/{tla.bottom2} "
                            f"แต่ผลหวย.com {card.top3}/{card.bottom2}")
    return "agree", ""


def apply_results(catalog: list, src: dict, today: datetime.date) -> tuple[list, list]:
    evidence = []
    for item in catalog:
        result, reason = sources.resolve_stock_with_fallback(item["id"], src)
        entry = {"id": item["id"], "name": item["name"]}
        verdict, detail = ("single", "") if not result else cross_check(item["id"], src)
        if result:
            if verdict == "conflict":
                result, reason = None, detail
            elif result["drawDate"] > today.isoformat():
                result, reason = None, f"วันที่งวด {result['drawDate']} อยู่ในอนาคต"
        if result:
            for key in RESULT_FIELDS:
                if key in result:
                    item[key] = result[key]
            for key in OPTIONAL_RESULT_FIELDS:
                if key not in result:
                    item.pop(key, None)
            item["status"] = "announced"
            entry.update({
                "status": "verified",
                "drawDate": result["drawDate"],
                "top3": result["top3"],
                "bottom2": result["bottom2"],
                "source": result["source"],
                "note": VERDICT_NOTE[verdict],
                "crossCheck": verdict,
            })
            if result.get("specialPrize"):
                entry["specialPrize"] = result["specialPrize"]
            for key in ("threeDigits",):
                if result.get(key):
                    entry[key] = result[key]
        else:
            # A failed or rejected fetch must never erase a verified result; keep
            # the stored numbers and record why they were not refreshed.
            previous = stored_result(item)
            if previous:
                entry.update({"status": "retained", "drawDate": previous, "reason": reason})
            else:
                item["status"] = "waiting"
                for key in ("top3", "bottom2", "firstPrize"):
                    item[key] = ""
                entry.update({"status": "not_found", "reason": reason})
        evidence.append(entry)
    return catalog, evidence


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--days", type=int, default=4)
    args = parser.parse_args()

    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    catalog = load_catalog()
    log(f"collecting sources for {len(catalog)} lotteries (Bangkok {today.isoformat()})")
    src, errors = sources.collect_sources(days=args.days, today=today)
    for error in errors:
        log(f"[WARN] {error}")

    catalog, evidence = apply_results(catalog, src, today)
    verified = [row for row in evidence if row["status"] == "verified"]
    retained = [row for row in evidence if row["status"] == "retained"]
    missing = [row for row in evidence if row["status"] == "not_found"]
    cross_checked = [row for row in verified if row.get("crossCheck") == "agree"]
    single_source = [row for row in verified if row.get("crossCheck") == "single"]
    report = {
        "generated_at": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).isoformat(),
        "total": len(catalog),
        "verified": len(verified),
        "retained": len(retained),
        "not_found": len(missing),
        "cross_checked": len(cross_checked),
        "single_source": len(single_source),
        "source_errors": errors,
        "missing": [{"id": row["id"], "name": row["name"], "reason": row.get("reason", "")} for row in missing],
        "retained_items": [{"id": row["id"], "name": row["name"], "drawDate": row.get("drawDate", ""),
                            "reason": row.get("reason", "")} for row in retained],
    }
    log(f"verified {len(verified)}/{len(catalog)} lotteries, {len(retained)} kept from the previous run, "
        f"{len(missing)} without evidence")
    log(f"corroborated by a second source: {len(cross_checked)}, resting on one source: {len(single_source)}")
    if args.dry_run:
        log("dry run: no files written")
        return 0
    atomic_write_json(CATALOG_PATH, catalog)
    atomic_write_json(EVIDENCE_PATH, {"generated_at": report["generated_at"], "items": evidence})
    atomic_write_json(REPORT_PATH, report)
    log(f"wrote {CATALOG_PATH.relative_to(ROOT)}, {EVIDENCE_PATH.relative_to(ROOT)}, {REPORT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
