#!/usr/bin/env python3
"""Read-only verification of the legacy JSON snapshot against Supabase."""
from __future__ import annotations

import json
import sys
import urllib.parse
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import supabase_storage as ss
from scripts.migrate_legacy_to_supabase import load_snapshot


def fetch_all(table: str, columns: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 1000
    while True:
        path = f"{urllib.parse.quote(table, safe='')}?select={columns}&limit={page_size}&offset={offset}"
        page = ss._request(path)
        if not isinstance(page, list) or any(not isinstance(row, dict) for row in page):
            raise ss.SupabaseStorageError(f"Invalid response while verifying {table}.")
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += len(page)


def compare_snapshot(
    snapshot: dict[str, Any],
    source_sha256: str,
    actual: dict[str, Any],
) -> dict[str, Any]:
    expected_results = {row["fingerprint"]: row["payload"] for row in snapshot["results"]}
    actual_result_rows = actual["results"]
    actual_results = {row["fingerprint"]: row["payload"] for row in actual_result_rows}
    expected_catalog = {str(row["id"]): row for row in snapshot["catalog"]}
    actual_catalog = {str(row["lottery_id"]): row["payload"] for row in actual["catalog"]}
    expected_suppressions = {
        row["fingerprint"]
        for row in snapshot["results"]
        if row["payload"].get("สถานะการแจ้งเตือน") == "sent"
        or row["payload"].get("notification_status") == "sent"
    }
    actual_suppressions = {row["fingerprint"] for row in actual["suppressions"]}

    errors: list[str] = []
    missing_fingerprints = set(expected_results) - set(actual_results)
    if missing_fingerprints:
        errors.append(f"{len(missing_fingerprints)} source lottery result fingerprint(s) are missing from Supabase")
    mismatched = [key for key, value in expected_results.items() if key in actual_results and actual_results[key] != value]
    if mismatched:
        errors.append(f"{len(mismatched)} lottery result payload(s) differ")

    if len(actual["catalog"]) != len(expected_catalog) or actual_catalog != expected_catalog:
        errors.append("lottery_catalog count, IDs, or payloads differ from the source snapshot")
    if actual["settings"] != snapshot["settings"]:
        errors.append("app_settings payload differs from the source snapshot")
    if actual["status"] != snapshot["status"]:
        errors.append("system_status payload differs from the source snapshot")
    if actual["history"] != snapshot["self_healing_history"]:
        errors.append("self_healing_history payload differs from the source snapshot")
    if not expected_suppressions.issubset(actual_suppressions):
        errors.append("one or more legacy sent results are missing notification suppression markers")
    matching_batches = [row for row in actual["batches"] if row.get("source_sha256") == source_sha256]
    if not matching_batches:
        errors.append("legacy_import_batches does not contain the current source SHA-256")
    elif not any(
        row.get("results_count") == len(expected_results)
        and row.get("catalog_count") == len(expected_catalog)
        and row.get("history_count") == len(snapshot["self_healing_history"])
        for row in matching_batches
    ):
        errors.append("legacy_import_batches counts differ from the current source snapshot")

    report = {
        "status": "verified" if not errors else "mismatch",
        "source_sha256": source_sha256,
        "source_counts": {
            "results": len(expected_results),
            "catalog": len(expected_catalog),
            "self_healing_history": len(snapshot["self_healing_history"]),
            "legacy_notification_suppressions": len(expected_suppressions),
        },
        "database_counts": {
            "results": len(actual_result_rows),
            "retained_extra_results": len(set(actual_results) - set(expected_results)),
            "catalog": len(actual["catalog"]),
            "self_healing_history": len(actual["history"]),
            "legacy_notification_suppressions": len(actual_suppressions),
        },
        "errors": errors,
    }
    if errors:
        raise ValueError(json.dumps(report, ensure_ascii=False))
    return report


def verify() -> dict[str, Any]:
    snapshot, digest = load_snapshot()
    actual = {
        "results": fetch_all("lottery_results", "fingerprint,payload"),
        "catalog": fetch_all("lottery_catalog", "lottery_id,payload"),
        "settings": _single("app_settings"),
        "status": _single("system_status"),
        "history": _single("self_healing_history"),
        "suppressions": fetch_all("notification_suppressions", "fingerprint"),
        "batches": fetch_all("legacy_import_batches", "source_sha256,results_count,catalog_count,history_count"),
    }
    return compare_snapshot(snapshot, digest, actual)


def _single(table: str) -> Any:
    rows = ss._request(f"{table}?select=payload&id=eq.main&limit=1")
    if not isinstance(rows, list) or len(rows) != 1:
        raise ss.SupabaseStorageError(f"Expected exactly one {table} singleton row.")
    return rows[0].get("payload")


def main() -> int:
    try:
        print(json.dumps(verify(), ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        print(f"SUPABASE VERIFICATION FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
