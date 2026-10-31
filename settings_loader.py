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


def is_disallowed_lottery(name: str) -> bool:
    """Return True if lottery is an unauthorized or rogue lottery like LIW, Pingpong, or Yeekee."""
    s = str(name or "").upper()
    disallowed = ["LIW", "ปิงปอง", "PINGPONG", "ยี่กี", "YEEKEE"]
    return any(k in s for k in disallowed)


def map_canonical_lottery_name(name: str) -> str:
    """Transform raw provider lottery names into official standard Thai names."""
    s = str(name or "").strip()
    if not s:
        return "หวยไม่ระบุชื่อ"
    
    # Hanoi specific round mappings (e.g. 17:30 is ฮานอยพิเศษ)
    lower = s.lower()
    if "ฮานอย" in s or "hanoi" in lower:
        if "17:30" in s or "17.30" in s or "พิเศษ" in s:
            return "ฮานอยพิเศษ"
        if "18:30" in s or "18.30" in s or ("ปกติ" in s and "vip" not in lower):
            return "ฮานอยปกติ"
        if "19:30" in s or "19.30" in s or "vip" in lower or "วีไอพี" in s:
            return "ฮานอย VIP"
        if "16:30" in s or "16.30" in s or "เฉพาะกิจ" in s:
            return "ฮานอยเฉพาะกิจ"
        if "11:30" in s or "11.30" in s or "กาชาด" in s:
            return "ฮานอยกาชาด"
            
    # Lao mappings
    if "ลาว" in s or "lao" in lower:
        if "20:30" in s or "20.30" in s or "พัฒนา" in s:
            return "หวยลาวพัฒนา"
        if "21:30" in s or "21.30" in s or "vip" in lower or "วีไอพี" in s:
            return "หวยลาว VIP"
        if "สตาร์" in s or "star" in lower:
            return "หวยลาวสตาร์"
        if "สามัคคี" in s:
            return "หวยลาวสามัคคี"

    # Thai Government & Savings
    if any(k in s for k in ("สลากกินแบ่งรัฐบาล", "หวยรัฐบาล", "รัฐบาลไทย")):
        return "สลากกินแบ่งรัฐบาล"
    if "ออมสิน" in s:
        return "หวยออมสิน"
    if "ธ.ก.ส" in s or "ธกส" in s:
        return "หวย ธ.ก.ส."

    return s


def normalize_lottery_name(name: str) -> str:
    """Normalize lottery name to ensure consistent matching across different sources."""
    canon = map_canonical_lottery_name(name)
    s = str(canon or "").strip().lower()
    # Normalize synonyms and spelling variations
    s = s.replace("นิคเคอิ", "นิเคอิ")
    s = s.replace("สลากกินแบ่งรัฐบาล (ไทย)", "สลากกินแบ่งรัฐบาล")
    s = s.replace("หวยรัฐบาลไทย", "สลากกินแบ่งรัฐบาล")
    s = s.replace("หวยรัฐบาล", "สลากกินแบ่งรัฐบาล")
    s = s.replace("หวยธกส.", "หวย ธ.ก.ส.")
    s = s.replace("ธ.ก.ส.", "หวย ธ.ก.ส.")
    s = s.replace("หวยหวย", "หวย")
    return " ".join(s.split())



def _parse_draw_date(row: Dict[str, Any]) -> datetime.date:
    """Parse supported ISO, dotted, slash, and Thai Buddhist-era draw dates."""
    thai_months = {
        "มกราคม": 1, "ม.ค": 1, "กุมภาพันธ์": 2, "ก.พ": 2,
        "มีนาคม": 3, "มี.ค": 3, "เมษายน": 4, "เม.ย": 4,
        "พฤษภาคม": 5, "พ.ค": 5, "มิถุนายน": 6, "มิ.ย": 6,
        "กรกฎาคม": 7, "ก.ค": 7, "สิงหาคม": 8, "ส.ค": 8,
        "กันยายน": 9, "ก.ย": 9, "ตุลาคม": 10, "ต.ค": 10,
        "พฤศจิกายน": 11, "พ.ย": 11, "ธันวาคม": 12, "ธ.ค": 12,
    }
    for candidate in (row.get("วันที่จัดรูปแบบ"), row.get("งวดวันที่"), row.get("date"), row.get("draw_date")):
        value = str(candidate or "").strip()
        if not value:
            continue
        for date_format in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                parsed = datetime.datetime.strptime(value[:10], date_format).date()
                return parsed.replace(year=parsed.year - 543) if parsed.year >= 2400 else parsed
            except ValueError:
                pass
        parts = value.replace(",", "").split()
        if len(parts) >= 3:
            try:
                day = int(parts[0])
                month = thai_months.get(parts[1].rstrip("."))
                year = int(parts[2])
                if month:
                    if year >= 2400:
                        year -= 543
                    return datetime.date(year, month, day)
            except (ValueError, TypeError):
                pass
    return datetime.date.min


def result_fingerprint(row: Dict[str, Any]) -> str:
    """Stable identity for one lottery draw, invariant to category and provider tags."""
    raw_name = row.get("ชื่อหวย") or row.get("lottery_name") or row.get("หวย") or row.get("id") or "หวยไม่ระบุชื่อ"
    lottery_name = normalize_lottery_name(raw_name)
    
    parsed_date = _parse_draw_date(row)
    date_str = parsed_date.isoformat() if parsed_date != datetime.date.min else str(row.get("งวดวันที่") or row.get("วันที่จัดรูปแบบ") or "").strip()
    
    top3 = str(row.get("เลขบน_3_ตัว") or row.get("top3") or "").strip()
    first = str(row.get("รางวัลที่_1") or row.get("firstPrize") or row.get("first") or "").strip()
    if not top3 and first:
        top3 = first[-3:] if len(first) >= 3 else first
        
    last2 = str(row.get("เลขท้าย_2_ตัว") or row.get("เลขล่าง_2_ตัว") or row.get("bottom2") or row.get("last2") or "").strip()

    category = str(row.get("หมวดหวย") or row.get("category") or "").strip().lower()
    category_aliases = {
        "stock_vip": "vip",
        "stock_special": "stock_special",
        "stock_visa": "stock_visa",
    }
    category = category_aliases.get(category, category)

    identity = {
        "lottery": lottery_name,
        "category": category,
        "draw_date": date_str,
        "top3": top3,
        "last2": last2,
    }
    return json.dumps(identity, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def was_already_notified(row: Dict[str, Any], previous: List[Dict[str, Any]]) -> bool:
    fingerprint = result_fingerprint(row)
    for old in previous:
        if old.get("สถานะการแจ้งเตือน") != "sent":
            continue
        if result_fingerprint(old) == fingerprint:
            return True
        # Loose match guard: same normalized name + same date + matching winning numbers
        raw_name = row.get("ชื่อหวย") or row.get("lottery_name") or row.get("หวย") or ""
        old_name = old.get("ชื่อหวย") or old.get("lottery_name") or old.get("หวย") or ""
        row_category = str(row.get("หมวดหวย") or row.get("category") or "").strip().lower()
        old_category = str(old.get("หมวดหวย") or old.get("category") or "").strip().lower()
        if row_category and old_category and row_category != old_category:
            continue
        if normalize_lottery_name(raw_name) == normalize_lottery_name(old_name):
            d1 = _parse_draw_date(row)
            d2 = _parse_draw_date(old)
            if d1 != datetime.date.min and d1 == d2:
                top_now = str(row.get("เลขบน_3_ตัว") or row.get("top3") or "").strip()
                top_old = str(old.get("เลขบน_3_ตัว") or old.get("top3") or "").strip()
                bot_now = str(row.get("เลขท้าย_2_ตัว") or row.get("เลขล่าง_2_ตัว") or row.get("bottom2") or "").strip()
                bot_old = str(old.get("เลขท้าย_2_ตัว") or old.get("เลขล่าง_2_ตัว") or old.get("bottom2") or "").strip()
                if (top_now and top_now == top_old) and (bot_now and bot_now == bot_old):
                    return True
    return False


def should_notify(S: Dict[str, Any], row: Dict[str, Any]) -> bool:
    """
    Determine if a lottery draw row should be notified via ntfy.
    Row contains Thai keys: งวดวันที่, รางวัลที่_1, เลขท้าย_2_ตัว, etc.
    """
    notifications = S.get("notifications", {})
    if not notifications.get("enabled", True):
        return False

    # Disallow unauthorized rogue lotteries like LIW, pingpong, or yeekee
    raw_name = row.get("ชื่อหวย") or row.get("lottery_name") or row.get("หวย") or ""
    if is_disallowed_lottery(raw_name):
        return False

    # Check if notification was already sent
    if row.get("สถานะการแจ้งเตือน") == "sent":
        return False

    has_result = any(str(row.get(k, "")).strip() for k in ("รางวัลที่_1", "เลขท้าย_2_ตัว", "top3", "bottom2"))
    if not has_result:
        return False
    if notifications.get("notify_on_new_draw", True):
        return True
    watched = [str(w).strip() for w in notifications.get("custom_watched_numbers", []) if str(w).strip()]
    numbers = []
    for key in ("รางวัลที่_1", "เลขท้าย_2_ตัว", "top3", "bottom2"):
        value = row.get(key)
        if value not in (None, ""):
            numbers.append(str(value).replace(",", "").strip())
    for key in ("เลขหน้า_3_ตัว", "เลขท้าย_3_ตัว"):
        value = row.get(key, [])
        if isinstance(value, list):
            numbers.extend(str(x).strip() for x in value)
    return any(w in number for w in watched for number in numbers) if watched else False

def write_status(
    rows: List[Dict[str, Any]], 
    status_path: str = DEFAULT_STATUS_PATH,
    error: Optional[str] = None,
    source_used: Optional[str] = None,
    notifications_sent: Optional[int] = None
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
    elif not rows:
        # No live result is not the same as a healthy result check.
        system_status = "degraded"
        status_message = "ไม่พบผลหวยสดจากแหล่งข้อมูลที่เปิดใช้งาน รอบนี้จึงไม่มีการส่งผลหวย"
        recent_logs.insert(0, {
            "timestamp": iso_time,
            "level": "WARNING",
            "message": status_message
        })
    else:
        system_status = "healthy"
        latest_row = max(rows, key=_parse_draw_date)
        latest_draw = latest_row.get("งวดวันที่") or latest_row.get("วันที่จัดรูปแบบ") or "ไม่ระบุ"
        status_message = f"ตรวจพบผลสดงวดล่าสุด {latest_draw} ผ่านแหล่ง {source_used or 'auto'}"
        recent_logs.insert(0, {
            "timestamp": iso_time,
            "level": "INFO",
            "message": status_message
        })

    # Keep only 20 latest logs
    recent_logs = recent_logs[:20]

    previous_day = str(existing.get("last_run_date_thai", "")).split(" ")[0]
    current_day = now.strftime("%d/%m/%Y")
    previous_sent = existing.get("notifications_sent_today", 0) if previous_day == current_day else 0
    sent_now = notifications_sent if notifications_sent is not None else sum(1 for row in rows if row.get("สถานะการแจ้งเตือน") == "sent")

    status_data = {
        "system_status": system_status,
        "last_run_timestamp": iso_time,
        "last_run_date_thai": thai_time,
        "total_checks": total_checks,
        "last_source_used": source_used or existing.get("last_source_used", "glo"),
        "status_message": status_message,
        # Prefer the explicit provider list; fall back to provider labels on result rows.
        "active_sources_count": len(
            {part.strip() for part in str(source_used or "").split(" + ") if part.strip()}
            or {
                str(row.get("แหล่งข้อมูล") or "").strip()
                for row in rows
                if str(row.get("แหล่งข้อมูล") or "").strip()
            }
        ),
        "latest_draw_detected": (latest_row.get("งวดวันที่") or latest_row.get("วันที่จัดรูปแบบ") or "") if rows else existing.get("latest_draw_detected", ""),
        "notifications_sent_today": previous_sent + sent_now,
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
