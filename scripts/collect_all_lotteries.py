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

RESULT_FIELDS = ("status", "top3", "bottom2", "firstPrize", "date", "source")
RESULT_KEYS = ("id", "name", "category", "categoryLabel", "period", "periodLabel",
               "flag", "drawTimeStr", "closeTimeStr", "drawDays", "status", "top3",
               "bottom2", "firstPrize", "date", "source")

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
    if not isinstance(catalog, list) or len(catalog) != 54:
        raise SystemExit(f"catalog must contain 54 items, found {len(catalog) if isinstance(catalog, list) else 'n/a'}")
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


def cross_check(catalog_id: str, src: dict) -> str:
    """Return a conflict description when the second source disagrees."""
    spec = CROSS_CHECK.get(catalog_id)
    if not spec:
        return ""
    key, group, label_regex = spec
    tla = src["tla"].get(key)
    cards = [row for row in src["stocks"]
             if row.extra.get("group") == group and re.search(label_regex, row.label)]
    if not tla or not cards:
        return ""
    card = max(cards, key=lambda row: row.draw_date)
    if card.draw_date != tla.draw_date:
        return ""
    if (card.top3, card.bottom2) != (tla.top3, tla.bottom2):
        return (f"แหล่งข้อมูลขัดแย้งกัน: ThaiLottoAPI {tla.top3}/{tla.bottom2} "
                f"แต่ผลหวย.com {card.top3}/{card.bottom2}")
    return ""


def apply_results(catalog: list, src: dict, today: datetime.date) -> tuple[list, list]:
    evidence = []
    for item in catalog:
        result, reason = sources.resolve_stock_with_fallback(item["id"], src)
        entry = {"id": item["id"], "name": item["name"]}
        if result:
            conflict = cross_check(item["id"], src)
            if conflict:
                result, reason = None, conflict
            elif result["drawDate"] > today.isoformat():
                result, reason = None, f"วันที่งวด {result['drawDate']} อยู่ในอนาคต"
        if result:
            for key in RESULT_FIELDS:
                if key in result:
                    item[key] = result[key]
            item["status"] = "announced"
            entry.update({
                "status": "verified",
                "drawDate": result["drawDate"],
                "top3": result["top3"],
                "bottom2": result["bottom2"],
                "source": result["source"],
                "note": "ตรงกับสองแหล่ง" if item["id"] in CROSS_CHECK else "",
            })
            if result.get("specialPrize"):
                entry["specialPrize"] = result["specialPrize"]
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
    report = {
        "generated_at": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).isoformat(),
        "total": len(catalog),
        "verified": len(verified),
        "retained": len(retained),
        "not_found": len(missing),
        "source_errors": errors,
        "missing": [{"id": row["id"], "name": row["name"], "reason": row.get("reason", "")} for row in missing],
        "retained_items": [{"id": row["id"], "name": row["name"], "drawDate": row.get("drawDate", ""),
                            "reason": row.get("reason", "")} for row in retained],
    }
    log(f"verified {len(verified)}/{len(catalog)} lotteries, {len(retained)} kept from the previous run, "
        f"{len(missing)} without evidence")
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
