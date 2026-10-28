"""
settings_loader.py - Helper module for loading settings and writing status.
Lottery Alert System (ระบบแจ้งเตือนผลหวย)
"""

import json
import os
import datetime
from typing import Dict, Any, List, Optional

DEFAULT_SETTINGS_PATH = "config/settings.json"
DEFAULT_STATUS_PATH = "status/status.json"
DEFAULT_RESULTS_PATH = "lottery_previous_results.json"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "version": "1.0.0",
    "sources": {
        "pholhuay": {"enabled": True, "name": "pholhuay", "priority": 1},
        "glo": {"enabled": True, "name": "glo", "priority": 2},
        "sanook": {"enabled": False, "name": "sanook", "priority": 3}
    },
    "notifications": {
        "enabled": True,
        "notify_on_new_draw": True,
        "notify_on_prize_match": True,
        "notify_prizes": {
            "first_prize": True,
            "last_2": True,
            "front_3": True,
            "last_3": True
        },
        "custom_watched_numbers": []
    },
    "ntfy": {
        "server": "https://ntfy.sh",
        "default_priority": "high",
        "tags": ["moneybag", "dart"]
    }
}


def load(path: str = DEFAULT_SETTINGS_PATH) -> Dict[str, Any]:
    """Load settings from config/settings.json or fallback to defaults."""
    if not os.path.exists(path):
        return DEFAULT_SETTINGS.copy()
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data
    except Exception as e:
        print(f"[WARN] Failed to load settings from {path}: {e}. Using defaults.")
        return DEFAULT_SETTINGS.copy()


def source_enabled(S: Dict[str, Any], source_name: str) -> bool:
    """Check if a specific lottery source is enabled in settings."""
    sources = S.get("sources", {})
    source_cfg = sources.get(source_name)
    if isinstance(source_cfg, dict):
        return bool(source_cfg.get("enabled", False))
    return False


def should_notify(S: Dict[str, Any], row: Dict[str, Any]) -> bool:
    """
    Determine if a lottery draw row should be notified via ntfy.
    Row contains Thai keys: งวดวันที่, รางวัลที่_1, เลขท้าย_2_ตัว, etc.
    """
    notifications = S.get("notifications", {})
    if not notifications.get("enabled", True):
        return False

    # Check if notification was already sent
    if row.get("สถานะการแจ้งเตือน") == "sent":
        return False

    # If configured to notify on any new draw with first prize
    if notifications.get("notify_on_new_draw", True):
        if row.get("รางวัลที่_1") or row.get("เลขท้าย_2_ตัว"):
            return True

    # Check custom watched numbers
    watched = [str(w).strip() for w in notifications.get("custom_watched_numbers", []) if str(w).strip()]
    if watched:
        all_numbers = []
        if row.get("รางวัลที่_1"):
            all_numbers.append(str(row["รางวัลที่_1"]))
        if row.get("เลขท้าย_2_ตัว"):
            all_numbers.append(str(row["เลขท้าย_2_ตัว"]))
        if isinstance(row.get("เลขหน้า_3_ตัว"), list):
            all_numbers.extend([str(x) for x in row["เลขหน้า_3_ตัว"]])
        if isinstance(row.get("เลขท้าย_3_ตัว"), list):
            all_numbers.extend([str(x) for x in row["เลขท้าย_3_ตัว"]])
        
        for w in watched:
            if any(w in num for num in all_numbers):
                return True

    return True


def write_status(
    rows: List[Dict[str, Any]], 
    status_path: str = DEFAULT_STATUS_PATH,
    error: Optional[str] = None,
    source_used: Optional[str] = None
) -> Dict[str, Any]:
    """
    Write status.json after execution.
    rows contains Thai-keyed lottery result records.
    """
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7)))
    iso_time = now.isoformat()
    thai_time = now.strftime("%d/%m/%Y %H:%M:%S น.")

    os.makedirs(os.path.dirname(status_path) if os.path.dirname(status_path) else ".", exist_ok=True)

    # Read existing status to preserve counters and logs
    existing: Dict[str, Any] = {}
    if os.path.exists(status_path):
        try:
            with open(status_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {}

    total_checks = existing.get("total_checks", 0) + 1
    recent_logs = existing.get("recent_logs", [])

    if error:
        system_status = "error"
        status_message = f"เกิดข้อผิดพลาดในการตรวจสอบ: {error}"
        recent_logs.insert(0, {
            "timestamp": iso_time,
            "level": "ERROR",
            "message": status_message
        })
    else:
        system_status = "healthy"
        latest_draw = rows[0].get("งวดวันที่", "ไม่ระบุ") if rows else "ไม่พบข้อมูล"
        status_message = f"ตรวจสอบผลสลากสำเร็จ (งวด {latest_draw}) ผ่านแหล่ง {source_used or 'auto'}"
        recent_logs.insert(0, {
            "timestamp": iso_time,
            "level": "INFO",
            "message": status_message
        })

    # Keep only 20 latest logs
    recent_logs = recent_logs[:20]

    status_data = {
        "system_status": system_status,
        "last_run_timestamp": iso_time,
        "last_run_date_thai": thai_time,
        "total_checks": total_checks,
        "last_source_used": source_used or existing.get("last_source_used", "glo"),
        "status_message": status_message,
        "active_sources_count": len([r for r in rows if r]) if rows else existing.get("active_sources_count", 2),
        "latest_draw_detected": rows[0].get("งวดวันที่", "") if rows else existing.get("latest_draw_detected", ""),
        "notifications_sent_today": existing.get("notifications_sent_today", 0) + (1 if not error and rows else 0),
        "recent_logs": recent_logs
    }

    try:
        with open(status_path, "w", encoding="utf-8") as f:
            json.dump(status_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[ERROR] Failed to write status to {status_path}: {e}")

    return status_data


def load_previous_results(path: str = DEFAULT_RESULTS_PATH) -> List[Dict[str, Any]]:
    """Load previously saved lottery results with Thai keys."""
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Failed to load previous results: {e}")
        return []


def save_results(rows: List[Dict[str, Any]], path: str = DEFAULT_RESULTS_PATH) -> None:
    """Save lottery results to lottery_previous_results.json."""
    os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[ERROR] Failed to save results to {path}: {e}")
