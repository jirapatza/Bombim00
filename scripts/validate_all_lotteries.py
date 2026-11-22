#!/usr/bin/env python3
"""Validate data/all_lotteries.json against the catalog contract.

Exit code 1 means the file must not be published: a schema break, a duplicate
id, an `announced` row without real numbers, or a future draw date.
"""

from __future__ import annotations

import argparse
import datetime
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lottery_sources import CATALOG_SOURCES, thai_date_to_iso  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "data" / "all_lotteries.json"
EVIDENCE_PATH = ROOT / "data" / "all_lotteries_evidence.json"

EXPECTED_KEYS = ["id", "name", "category", "categoryLabel", "period", "periodLabel",
                 "flag", "drawTimeStr", "closeTimeStr", "drawDays", "status", "top3",
                 "bottom2", "firstPrize", "date", "source"]
# Official three-digit prizes, present only when the source publishes them.
OPTIONAL_KEYS = ("threeDigits",)
# The source map is the contract: a lottery exists only once it has a source, so
# the expected id set is derived from it instead of a magic count that has to be
# edited in three files whenever a lottery is added.
EXPECTED_IDS = tuple(CATALOG_SOURCES)
VALID_STATUS = {"announced", "waiting"}


def validate_catalog(catalog, today: datetime.date | None = None) -> list:
    today = today or datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    errors = []
    if not isinstance(catalog, list):
        return ["catalog root must be a JSON array"]
    seen = set()
    catalog_ids = [item.get("id") for item in catalog if isinstance(item, dict)]
    missing = [item_id for item_id in EXPECTED_IDS if item_id not in catalog_ids]
    unknown = [item_id for item_id in catalog_ids if item_id not in CATALOG_SOURCES]
    if missing:
        errors.append(f"catalog lost {len(missing)} mapped lotteries: {missing}")
    if unknown:
        errors.append(f"catalog has {len(unknown)} lotteries without a source mapping: {unknown}")
    for index, item in enumerate(catalog):
        where = f"item[{index}] {item.get('id', '?') if isinstance(item, dict) else '?'}"
        if not isinstance(item, dict):
            errors.append(f"{where}: not an object")
            continue
        if [key for key in item if key not in OPTIONAL_KEYS] != EXPECTED_KEYS:
            errors.append(f"{where}: schema changed, keys={list(item.keys())}")
        for key in OPTIONAL_KEYS:
            if key not in item:
                continue
            value = item[key]
            if not (isinstance(value, list) and value and all(
                    isinstance(n, str) and re.fullmatch(r"[0-9]{3}", n) for n in value)):
                errors.append(f"{where}: {key} must be a non-empty list of 3-digit strings")
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id:
            errors.append(f"{where}: missing id")
        elif item_id in seen:
            errors.append(f"{where}: duplicate id {item_id}")
        else:
            seen.add(item_id)
        status = item.get("status")
        if status not in VALID_STATUS:
            errors.append(f"{where}: status {status!r} not in {sorted(VALID_STATUS)}")
        top3, bottom2 = item.get("top3"), item.get("bottom2")
        if status == "announced":
            if not (isinstance(top3, str) and re.fullmatch(r"[0-9]{3}", top3)):
                errors.append(f"{where}: announced without a 3-digit top3")
            if not (isinstance(bottom2, str) and re.fullmatch(r"[0-9]{2}", bottom2)):
                errors.append(f"{where}: announced without a 2-digit bottom2")
            first = item.get("firstPrize")
            if not (isinstance(first, str) and re.fullmatch(r"[0-9]{3}|[0-9]{6}", first)):
                errors.append(f"{where}: announced without a 3 or 6 digit firstPrize")
            iso = thai_date_to_iso(str(item.get("date") or ""))
            if not iso:
                errors.append(f"{where}: announced without a parseable draw date")
            elif iso > today.isoformat():
                errors.append(f"{where}: draw date {iso} is in the future")
            if not str(item.get("source") or "").strip():
                errors.append(f"{where}: announced without a source")
        elif status == "waiting":
            for field in ("top3", "bottom2", "firstPrize"):
                if item.get(field):
                    errors.append(f"{where}: waiting but {field} is filled")
    return errors


def validate_evidence(evidence: dict, catalog: list) -> list:
    errors = []
    items = evidence.get("items")
    if not isinstance(items, list):
        return ["evidence file has no items array"]
    ids = {row.get("id") for row in items}
    catalog_ids = {item.get("id") for item in catalog}
    if ids != catalog_ids:
        errors.append(f"evidence ids differ from catalog ids: missing={sorted(catalog_ids - ids)} extra={sorted(ids - catalog_ids)}")
    by_id = {item.get("id"): item for item in catalog}
    for row in items:
        item = by_id.get(row.get("id"))
        if item is None:
            continue
        if row.get("status") == "verified":
            if item.get("status") != "announced":
                errors.append(f"evidence says {row.get('id')} verified but catalog is {item.get('status')}")
            if (row.get("top3"), row.get("bottom2")) != (item.get("top3"), item.get("bottom2")):
                errors.append(f"evidence numbers for {row.get('id')} do not match the catalog")
        elif row.get("status") == "retained":
            if item.get("status") != "announced":
                errors.append(f"evidence says {row.get('id')} retained but catalog is {item.get('status')}")
            if row.get("drawDate") != thai_date_to_iso(str(item.get("date") or "")):
                errors.append(f"retained evidence date for {row.get('id')} does not match the catalog")
        elif not str(row.get("reason") or "").strip():
            errors.append(f"evidence for {row.get('id')} is not_found without a reason")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default=str(CATALOG_PATH))
    parser.add_argument("--evidence", default=str(EVIDENCE_PATH))
    parser.add_argument("--allow-missing-evidence", action="store_true")
    args = parser.parse_args()

    try:
        catalog = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
    except Exception as error:  # noqa: BLE001
        print(f"FAIL cannot read catalog: {error}")
        return 1

    errors = validate_catalog(catalog)
    evidence_path = Path(args.evidence)
    if evidence_path.exists():
        try:
            evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
        except Exception as error:  # noqa: BLE001
            errors.append(f"cannot read evidence: {error}")
        else:
            errors.extend(validate_evidence(evidence, catalog))
    elif not args.allow_missing_evidence:
        errors.append(f"missing evidence file {evidence_path}")

    announced = sum(1 for item in catalog if item.get("status") == "announced")
    print(f"catalog: {len(catalog)} items, announced {announced}, waiting {len(catalog) - announced}")
    for error in errors:
        print(f"FAIL {error}")
    print("PASS" if not errors else f"FAILED with {len(errors)} problem(s)")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
