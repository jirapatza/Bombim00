#!/usr/bin/env python3
"""Idempotent, explicit migration of Bombim00's five legacy JSON stores.

Default mode is dry-run. Pass --apply only after the SQL migration has been
applied and the Supabase project has been configured with server-side secrets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import settings_loader as sl
SOURCES = {
    "results": ROOT / "lottery_previous_results.json",
    "catalog": ROOT / "data" / "all_lotteries.json",
    "settings": ROOT / "config" / "settings.json",
    "status": ROOT / "status" / "status.json",
    "self_healing_history": ROOT / "status" / "self_healing_history.json",
}


def load_snapshot() -> tuple[dict[str, Any], str]:
    raw: dict[str, bytes] = {}
    parsed: dict[str, Any] = {}
    for name, path in SOURCES.items():
        if not path.is_file():
            raise FileNotFoundError(f"Required legacy source is missing: {path.relative_to(ROOT)}")
        raw[name] = path.read_bytes()
        parsed[name] = json.loads(raw[name].decode("utf-8"))

    for key in ("results", "catalog", "self_healing_history"):
        if not isinstance(parsed[key], list):
            raise ValueError(f"{key} must be a JSON array")
    for key in ("settings", "status"):
        if not isinstance(parsed[key], dict):
            raise ValueError(f"{key} must be a JSON object")

    seen: set[str] = set()
    results = []
    for row in parsed["results"]:
        if not isinstance(row, dict):
            raise ValueError("Every legacy result must be a JSON object")
        fingerprint = sl.result_fingerprint(row)
        if fingerprint in seen:
            raise ValueError(f"Duplicate legacy result fingerprint found: {fingerprint}")
        seen.add(fingerprint)
        results.append({"fingerprint": fingerprint, "payload": row})

    catalog_ids: set[str] = set()
    for row in parsed["catalog"]:
        if not isinstance(row, dict) or not str(row.get("id", "")).strip():
            raise ValueError("Every catalog row must be an object with a non-empty id")
        item_id = str(row["id"])
        if item_id in catalog_ids:
            raise ValueError(f"Duplicate lottery catalog id found: {item_id}")
        catalog_ids.add(item_id)

    digest = hashlib.sha256()
    for name in sorted(raw):
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(raw[name])
        digest.update(b"\0")

    snapshot = {
        "results": results,
        "catalog": parsed["catalog"],
        "settings": parsed["settings"],
        "status": parsed["status"],
        "self_healing_history": parsed["self_healing_history"],
    }
    return snapshot, digest.hexdigest()


def import_snapshot(snapshot: dict[str, Any], source_sha256: str) -> dict[str, Any]:
    project_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    secret_key = os.environ.get("SUPABASE_SECRET_KEY", "")
    if not project_url or not secret_key:
        raise RuntimeError("Set SUPABASE_URL and SUPABASE_SECRET_KEY in the secure environment.")
    parsed_url = urllib.parse.urlparse(project_url)
    if (parsed_url.scheme != "https" or not parsed_url.netloc or parsed_url.username
            or parsed_url.password or parsed_url.path not in ("", "/")
            or parsed_url.query or parsed_url.fragment):
        raise ValueError("SUPABASE_URL must be an HTTPS project origin.")

    headers = {
        "apikey": secret_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    # Modern sb_secret keys are API keys, not JWTs. Legacy service_role JWTs
    # must also be supplied as the PostgREST Authorization bearer token.
    if not secret_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {secret_key}"

    body = json.dumps(
        {"p_snapshot": snapshot, "p_source_sha256": source_sha256},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{project_url}/rest/v1/rpc/import_bombim00_legacy_snapshot",
        data=body,
        method="POST",
        headers=headers,
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"Supabase import failed with HTTP {exc.code}: {detail}") from exc
    if not isinstance(result, dict) or result.get("status") != "imported":
        raise RuntimeError("Supabase returned an unexpected import response.")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit the validated snapshot to Supabase.")
    args = parser.parse_args()

    try:
        snapshot, digest = load_snapshot()
        summary = {
            "results": len(snapshot["results"]),
            "catalog": len(snapshot["catalog"]),
            "self_healing_history": len(snapshot["self_healing_history"]),
            "source_sha256": digest,
        }
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        if not args.apply:
            print("DRY RUN ONLY: no data was sent to Supabase. Re-run with --apply to import.")
            return 0
        result = import_snapshot(snapshot, digest)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        print(f"MIGRATION FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
