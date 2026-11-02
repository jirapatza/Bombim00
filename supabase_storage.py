"""Server-side Supabase REST adapter for the GitHub Actions lottery checker.

Opt-in only: set SUPABASE_CHECKER_ENABLED=true after the SQL migrations and
legacy snapshot import have been validated. No silent fallback is allowed in
enabled mode, so a database failure cannot accidentally send duplicate alerts.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

TABLES = {
    "results": "lottery_results",
    "catalog": "lottery_catalog",
    "settings": "app_settings",
    "status": "system_status",
    "history": "self_healing_history",
}


class SupabaseStorageError(RuntimeError):
    pass


def enabled() -> bool:
    return os.environ.get("SUPABASE_CHECKER_ENABLED", "").strip().lower() == "true"


def _config() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    if not url or not key:
        raise SupabaseStorageError("Supabase checker mode requires SUPABASE_URL and SUPABASE_SECRET_KEY.")
    parsed = urllib.parse.urlparse(url)
    if (parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        raise SupabaseStorageError("SUPABASE_URL must be an HTTPS project origin.")
    return url, key


def _request(path: str, method: str = "GET", body: Any = None, prefer: str | None = None) -> Any:
    url, key = _config()
    headers = {
        "apikey": key,
        "Accept": "application/json",
        "User-Agent": "Bombim00-LotteryChecker/1.0",
    }
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    request = urllib.request.Request(f"{url}/rest/v1/{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8")) if raw else None
    except urllib.error.HTTPError as exc:
        # Do not include response bodies: upstream errors can contain sensitive values.
        raise SupabaseStorageError(f"Supabase request failed with HTTP {exc.code}.") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SupabaseStorageError("Supabase request failed or timed out.") from exc


def _rows(table: str) -> list[dict[str, Any]]:
    encoded = urllib.parse.quote(table, safe="")
    ordering = "&order=updated_at.desc,id.asc" if table == TABLES["results"] else ""
    collected: list[dict[str, Any]] = []
    offset = 0
    page_size = 1000
    while True:
        data = _request(f"{encoded}?select=payload&limit={page_size}&offset={offset}{ordering}")
        if not isinstance(data, list) or any(not isinstance(row, dict) or "payload" not in row for row in data):
            raise SupabaseStorageError(f"Supabase returned an invalid {table} payload.")
        collected.extend(data)
        if len(data) < page_size:
            break
        offset += len(data)
    return [row["payload"] for row in collected]


def load_results() -> list[dict[str, Any]]:
    return _rows(TABLES["results"])


def load_catalog() -> list[dict[str, Any]]:
    return _rows(TABLES["catalog"])


def _singleton(table: str, empty: Any = None) -> Any:
    data = _request(f"{table}?select=payload&id=eq.main&limit=1")
    if not isinstance(data, list):
        raise SupabaseStorageError(f"Supabase returned an invalid {table} response.")
    if not data:
        if empty is not None:
            return empty
        raise SupabaseStorageError(f"Supabase {table} record is missing.")
    return data[0].get("payload")


def load_settings() -> dict[str, Any]:
    value = _singleton(TABLES["settings"])
    if not isinstance(value, dict):
        raise SupabaseStorageError("Supabase settings payload is not an object.")
    return value


def load_status() -> dict[str, Any]:
    value = _singleton(TABLES["status"])
    if not isinstance(value, dict):
        raise SupabaseStorageError("Supabase status payload is not an object.")
    return value


def save_results(rows: list[dict[str, Any]]) -> None:
    records = []
    for row in rows:
        if not isinstance(row, dict):
            raise SupabaseStorageError("Every result must be an object.")
        import settings_loader as sl
        fingerprint = sl.result_fingerprint(row)
        if not isinstance(fingerprint, str) or not fingerprint:
            raise SupabaseStorageError("Result is missing its canonical fingerprint.")
        payload = dict(row)
        records.append({
            "fingerprint": fingerprint,
            "lottery_name": payload.get("ชื่อหวย") or payload.get("หวย") or payload.get("lottery_name"),
            "category": payload.get("หมวดหวย") or payload.get("category"),
            "draw_date": payload.get("งวดวันที่") or payload.get("วันที่จัดรูปแบบ") or payload.get("draw_date"),
            "notification_status": payload.get("สถานะการแจ้งเตือน"),
            "payload": payload,
        })
    if records:
        _request("lottery_results?on_conflict=fingerprint", "POST", records, "resolution=merge-duplicates,return=minimal")
        shadow_mode = (
            os.environ.get("SUPABASE_SHADOW_WRITE", "").strip().lower() == "true"
            and os.environ.get("SUPABASE_CHECKER_ENABLED", "").strip().lower() != "true"
        )
        if shadow_mode and any(row.get("สถานะการแจ้งเตือน") == "sent" for row in rows):
            _request("rpc/sync_bombim00_legacy_suppressions", "POST", {})


def save_catalog(rows: list[dict[str, Any]]) -> None:
    records = []
    for row in rows:
        if not isinstance(row, dict) or not str(row.get("id", "")).strip():
            raise SupabaseStorageError("Every catalog item must have a non-empty id.")
        records.append({"lottery_id": str(row["id"]), "payload": row})
    if records:
        _request("lottery_catalog?on_conflict=lottery_id", "POST", records, "resolution=merge-duplicates,return=minimal")


def save_singleton(table: str, payload: dict[str, Any] | list[Any]) -> None:
    _request(f"{table}?on_conflict=id", "POST", [{"id": "main", "payload": payload}], "resolution=merge-duplicates,return=minimal")


def claim_notification(fingerprint: str, channel: str, payload: dict[str, Any], force: bool = False) -> bool:
    result = _request("rpc/claim_bombim00_notification", "POST", {
        "p_fingerprint": fingerprint,
        "p_channel": channel,
        "p_payload": payload,
        "p_force": bool(force),
    })
    return result is True


def complete_notification(fingerprint: str, channel: str, success: bool, provider_reference: str | None = None) -> bool:
    result = _request("rpc/complete_bombim00_notification", "POST", {
        "p_fingerprint": fingerprint,
        "p_channel": channel,
        "p_success": bool(success),
        "p_provider_reference": provider_reference,
    })
    return result is True
