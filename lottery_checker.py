#!/usr/bin/env python3
"""
lottery_checker.py - Main lottery checker and alert dispatch script.
Lottery Alert System: สคริปต์ตรวจสอบผลสลากกินแบ่งรัฐบาลและส่งแจ้งเตือนผ่าน ntfy
"""

import os
import sys
import base64
import json
import re
import datetime
from concurrent.futures import ThreadPoolExecutor
from html import unescape

try:
    import requests
except ImportError:
    requests = None
    import urllib.request
    import urllib.error

import settings_loader as sl
from draw_schedule import load_catalog, scheduled_result, schedule_name

# Load configuration at startup
S = sl.load()

# Read environment variables
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "").strip()


def _http_get_json(url: str, timeout: int = 10, headers: dict = None) -> dict:
    """Helper to perform HTTP GET returning parsed JSON with fallback."""
    headers = headers or {"User-Agent": "LotteryAlert/1.0", "Accept": "application/json"}
    if requests:
        res = requests.get(url, headers=headers, timeout=timeout)
        if res.status_code == 200:
            try:
                return res.json()
            except ValueError as e:
                print(f"[WARN] Invalid JSON from {url}: {e}")
                return {}
        print(f"[WARN] GET {url} returned HTTP {res.status_code}")
        return {}
    else:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status == 200:
                return json.loads(response.read().decode("utf-8"))
        return {}


def _http_post(url: str, data: bytes, headers: dict = None, timeout: int = 10) -> bool:
    """Helper to perform HTTP POST with fallback."""
    headers = headers or {}
    if requests:
        res = requests.post(url, data=data, headers=headers, timeout=timeout)
        return res.status_code == 200
    else:
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status == 200


def fetch_from_glo() -> list:
    """Fetch latest Thai Government Lottery results from GLO API."""
    url = S.get("sources", {}).get("glo", {}).get("url", "https://www.glo.or.th/api/lottery/getLatestLottery")
    timeout = S.get("sources", {}).get("glo", {}).get("timeout_sec", 12)
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }

    try:
        data = _http_get_json(url, timeout=timeout, headers=headers)
        if data:
            response_data = data.get("response", {}) or data.get("data", {}) or data
            date_thai = response_data.get("date") or response_data.get("drawDate")
            
            prizes = response_data.get("data", {}) or response_data
            first = prizes.get("first", {}).get("number", []) if isinstance(prizes.get("first"), dict) else []
            first_num = first[0] if first else response_data.get("firstPrize")
            
            last2 = prizes.get("last2", {}).get("number", []) if isinstance(prizes.get("last2"), dict) else []
            last2_num = last2[0] if last2 else response_data.get("last2")

            if sl.result_numbers({"รางวัลที่_1": first_num, "เลขท้าย_2_ตัว": last2_num})[0] and sl.result_numbers({"รางวัลที่_1": first_num, "เลขท้าย_2_ตัว": last2_num})[1] and sl._parse_draw_date({"งวดวันที่": date_thai}) != datetime.date.min:
                return [{
                    "งวดวันที่": date_thai or "งวดปัจจุบัน",
                    "วันที่จัดรูปแบบ": sl._parse_draw_date({"งวดวันที่": date_thai}).isoformat(),
                    "รางวัลที่_1": str(first_num or "").zfill(6),
                    "เลขท้าย_2_ตัว": str(last2_num or "").zfill(2),
                    "เลขหน้า_3_ตัว": [str(x).zfill(3) for x in (prizes.get("first3") or {}).get("number", [])],
                    "เลขท้าย_3_ตัว": [str(x).zfill(3) for x in (prizes.get("last3") or {}).get("number", [])],
                    "รางวัลข้างเคียงรางวัลที่_1": [],
                    "แหล่งข้อมูล": "glo",
                    "เวลาที่ตรวจพบ": datetime.datetime.now().isoformat(),
                    "สถานะการแจ้งเตือน": "pending"
                }]
    except Exception as e:
        print(f"[WARN] Failed fetching from GLO: {e}")
    
    return []


def fetch_from_pholhuay_stock_groups() -> list:
    """Scrape the public results index that explicitly separates regular, VIP, special and VISA stocks."""
    url = "https://xn--t3cmiit.com/stock-lottery"
    try:
        html = _http_get_text(url, timeout=15)
        if not html:
            print("[WARN] Stock group page returned empty HTML.")
            return []

        group_map = {
            "หวยหุ้นต่างประเทศ": "stock",
            "หวยหุ้น VIP": "stock_vip",
            "หวยหุ้นพิเศษ": "stock_special",
            "หวยหุ้น VISA": "stock_visa",
        }
        rows = []

        # Try BeautifulSoup if available, else use zero-dependency regex parser
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            group = ""
            headings = soup.find_all(["h2", "h3"])
            for heading in headings:
                label = heading.get_text(" ", strip=True)
                if heading.name == "h2":
                    group = ""
                    for key, value in group_map.items():
                        if key in label:
                            group = value
                            break
                    continue
                if heading.name != "h3" or not group:
                    continue
                if not label.startswith("หวยหุ้น") or any(q in label for q in ("ในหน้านี้", "อัปเดตเมื่อไร", "ออกวันไหน", "ดูย้อนหลัง")):
                    continue
                # Find the smallest nearby card/container that contains both result fields.
                node = heading
                card_text = ""
                for _ in range(7):
                    node = getattr(node, "parent", None)
                    if node is None:
                        break
                    candidate = node.get_text(" ", strip=True)
                    if "3 ตัวบน" in candidate and "2 ตัวล่าง" in candidate and "งวด" in candidate:
                        card_text = candidate
                        break
                if not card_text:
                    continue
                date_match = re.search(r"งวด\s*(?:วันที่\s*)?(\d{1,2}\s+[^\s]+\s+\d{4})", card_text)
                top_match = re.search(r"3 ตัวบน\s*(\d{3})", card_text)
                bottom_match = re.search(r"2 ตัวล่าง\s*(\d{2})", card_text)
                if not (date_match and top_match and bottom_match):
                    continue
                date_display = date_match.group(1)
                rows.append({
                    "ชื่อหวย": label,
                    "หวย": label,
                    "หมวดหวย": group,
                    "งวดวันที่": date_display,
                    "วันที่จัดรูปแบบ": date_display,
                    "รางวัลที่_1": top_match.group(1),
                    "เลขท้าย_2_ตัว": bottom_match.group(1),
                    "เลขบน_3_ตัว": top_match.group(1),
                    "เลขล่าง_2_ตัว": bottom_match.group(1),
                    "เลขหน้า_3_ตัว": [],
                    "เลขท้าย_3_ตัว": [],
                    "รางวัลข้างเคียงรางวัลที่_1": [],
                    "แหล่งข้อมูล": "ผลหวย.com (หน้าหุ้นแยกหมวด)",
                    "เวลาที่ตรวจพบ": datetime.datetime.now().isoformat(),
                    "สถานะการแจ้งเตือน": "pending"
                })
        except ImportError:
            # Built-in regex extraction fallback (works with zero external dependencies)
            current_group = "stock"
            blocks = re.findall(r'<h([23])[^>]*>(.*?)</h\1>(.*?)(?=<h[23]|$)', html, re.DOTALL | re.IGNORECASE)
            for level, heading_html, content_html in blocks:
                heading_text = re.sub(r'<[^>]+>', '', heading_html).strip()
                if level == '2':
                    for key, value in group_map.items():
                        if key in heading_text:
                            current_group = value
                            break
                    continue
                if level == '3' and current_group:
                    if not heading_text.startswith("หวยหุ้น") or any(q in heading_text for q in ("ในหน้านี้", "อัปเดตเมื่อไร", "ออกวันไหน", "ดูย้อนหลัง")):
                        continue
                    clean_content = re.sub(r'<[^>]+>', ' ', content_html)
                    top_match = re.search(r"3 ตัวบน\s*(\d{3})", clean_content)
                    bottom_match = re.search(r"2 ตัวล่าง\s*(\d{2})", clean_content)
                    date_match = re.search(r"งวด\s*(?:วันที่\s*)?(\d{1,2}\s+[^\s]+\s+\d{4})", clean_content)
                    if top_match and bottom_match and date_match:
                        date_display = date_match.group(1)
                        rows.append({
                            "ชื่อหวย": heading_text,
                            "หวย": heading_text,
                            "หมวดหวย": current_group,
                            "งวดวันที่": date_display,
                            "วันที่จัดรูปแบบ": date_display,
                            "รางวัลที่_1": top_match.group(1),
                            "เลขท้าย_2_ตัว": bottom_match.group(1),
                            "เลขบน_3_ตัว": top_match.group(1),
                            "เลขล่าง_2_ตัว": bottom_match.group(1),
                            "เลขหน้า_3_ตัว": [],
                            "เลขท้าย_3_ตัว": [],
                            "รางวัลข้างเคียงรางวัลที่_1": [],
                            "แหล่งข้อมูล": "ผลหวย.com (หน้าหุ้นแยกหมวด)",
                            "เวลาที่ตรวจพบ": datetime.datetime.now().isoformat(),
                            "สถานะการแจ้งเตือน": "pending"
                        })
        # Avoid duplicate cards when markup nesting makes a heading repeat.
        unique, seen = [], set()
        for row in rows:
            key = (row["หมวดหวย"], row["ชื่อหวย"], row["งวดวันที่"], row["เลขบน_3_ตัว"], row["เลขล่าง_2_ตัว"])
            if key not in seen:
                seen.add(key)
                unique.append(row)
        counts = {g: sum(1 for row in unique if row["หมวดหวย"] == g) for g in group_map.values()}
        print(f"[INFO] Stock group scraper found {len(unique)} results: {counts}")
        return unique
    except Exception as e:
        print(f"[WARN] Failed fetching separated stock groups: {e}")
        return []


def parse_lao_extra_history(html: str, today: datetime.date = None) -> list:
    """Read explicit prize columns only from the dedicated Lao EXTRA page."""
    today = today or datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    def text(value):
        return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]*>", " ", value))).strip()
    headings = re.findall(r"<h1\b[^>]*>(.*?)</h1>", html, re.I | re.S)
    if not any(re.search(r"ลาว\s*extra", text(h), re.I) for h in headings):
        return []
    rows, seen = [], set()
    for table in re.findall(r"<table\b[^>]*>(.*?)</table>", html, re.I | re.S):
        table_rows = re.findall(r"<tr\b[^>]*>(.*?)</tr>", table, re.I | re.S)
        headers = None
        for tr in table_rows:
            cells = [text(c) for c in re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", tr, re.I | re.S)]
            if headers is None:
                if cells == ["งวดวันที่", "รางวัลพิเศษ", "3 ตัวบน", "2 ตัวล่าง"]:
                    headers = cells
                continue
            if len(cells) != 4:
                continue
            date_label, full, top3, bottom2 = cells
            date_label = re.sub(r"^งวด(?:วันที่)?\s*", "", date_label)
            date = sl._parse_draw_date({"งวดวันที่": date_label})
            if date == datetime.date.min or date > today or date in seen:
                continue
            if not (re.fullmatch(r"[0-9]{5}", full) and re.fullmatch(r"[0-9]{3}", top3)
                    and re.fullmatch(r"[0-9]{2}", bottom2) and full[-3:] == top3):
                continue
            seen.add(date)
            rows.append({
                "ชื่อหวย": "ลาว EXTRA", "หวย": "lao_extra", "หมวดหวย": "lao",
                "งวดวันที่": date_label, "วันที่จัดรูปแบบ": date.isoformat(),
                "รางวัลที่_1": top3, "เลขบน_3_ตัว": top3,
                "เลขท้าย_2_ตัว": bottom2, "เลขล่าง_2_ตัว": bottom2,
                "แหล่งข้อมูล": "ผลหวย.com (ลาว EXTRA)",
                "เวลาที่ตรวจพบ": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "สถานะการแจ้งเตือน": "pending",
            })
    return sorted(rows, key=lambda row: row["วันที่จัดรูปแบบ"], reverse=True)[:15]


def fetch_from_pholhuay_lao_extra() -> list:
    try:
        rows = parse_lao_extra_history(_http_get_text("https://xn--t3cmiit.com/lao-lottery/extra", timeout=15))
        print(f"[INFO] Lao EXTRA dedicated feed returned {len(rows)} validated draw(s).")
        if not rows:
            print("[WARN] Lao EXTRA page has no valid prize table; no result will be invented.")
        return rows
    except Exception as error:
        print(f"[WARN] Lao EXTRA source unavailable: {type(error).__name__}")
        return []


def _http_get_text(url: str, timeout: int = 10) -> str:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; LotteryAlert/1.0)", "Accept": "text/html"}
    if requests:
        response = requests.get(url, headers=headers, timeout=timeout)
        if response.status_code != 200:
            print(f"[WARN] GET {url} returned HTTP {response.status_code}")
            return ""
        return response.text
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_from_thailottoapi_results() -> list:
    """Fetch every published, supported category from ThaiLottoAPI (excluding removed Mekong draws)."""
    cfg = S.get("sources", {}).get("thailottoapi", {})
    base = cfg.get("url", "https://thailottoapi.com/api/results")
    timeout = cfg.get("timeout_sec", 12)
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date().isoformat()
    url = f"{base}?date={today}&sync=1"

    category_by_key = {
        "thailotto": "government",
        "gsblotto": "government",
        "baaclotto": "government",
        "lpp": "lao",
        "laoslotto": "lao",
        "malaylotto": "malay",
        "hanoylottospecial": "hanoi",
        "hanoylotto": "hanoi",
        "hanoylottovip": "hanoi",
    }

    try:
        data = _http_get_json(url, timeout=timeout, headers={
            "User-Agent": "LotteryAlert/1.0 (+https://github.com/jirapatza/Bombim00)",
            "Accept": "application/json"
        })
        if not isinstance(data, dict) or data.get("ok") is not True:
            print("[WARN] ThaiLottoAPI returned no successful response.")
            return []

        categories = data.get("categories") or {}
        if not isinstance(categories, dict):
            print("[WARN] ThaiLottoAPI categories field is not an object.")
            return []

        rows = []
        disallowed_categories = {"liw", "maekhong", "pingpong", "yeekee"}

        for raw_category, category_data in categories.items():
            raw_cat_lower = str(raw_category).strip().lower()
            if raw_cat_lower in disallowed_categories:
                continue
            if not isinstance(category_data, dict):
                continue

            items = category_data.get("items") or []
            if not isinstance(items, list):
                continue

            for item in items:
                if not isinstance(item, dict) or str(item.get("status", "")).lower() != "success":
                    continue

                key = str(item.get("key") or "").strip()
                label = str(item.get("label") or key or "หวย").strip()
                key_lower = key.lower()
                label_lower = label.casefold()

                # Strictly discard LIW, pingpong, yeekee or unrequested draws
                if any(bad in key_lower or bad in label_lower for bad in ("liw", "ปิงปอง", "ยี่กี", "หวยปิงปอง", "หวยยี่กี")):
                    continue

                draw_date = str(item.get("drawDateDisplay") or item.get("drawDate") or "").strip()
                parsed_draw_date = sl._parse_draw_date({"งวดวันที่": draw_date, "วันที่จัดรูปแบบ": item.get("drawDate")})
                if not key or parsed_draw_date == datetime.date.min:
                    print(f"[WARN] Skipping ThaiLottoAPI item without key/date: {label or 'unknown'}")
                    continue

                result_value = str(item.get("result") or "").strip()
                top3 = str(item.get("top3") or "").strip()
                bottom2 = str(item.get("bottom2") or item.get("last2") or "").strip()
                first_prize = str(item.get("firstPrize") or item.get("first_prize") or "").strip()
                # Do not mistake the tail of an upper/first prize for a lower result.
                combined = re.fullmatch(r"(\d{3})\s*[-/]\s*(\d{2})", result_value)
                top3, bottom2 = sl.result_numbers({
                    "top3": top3 or (combined.group(1) if combined else ""),
                    "bottom2": bottom2 or (combined.group(2) if combined else ""),
                    "firstPrize": first_prize or (result_value if result_value.isdigit() else ""),
                })

                if not top3:
                    print(f"[WARN] Skipping incomplete ThaiLottoAPI result: {key}")
                    continue
                if not bottom2:
                    print(f"[WARN] Skipping result without 2-digit lower number: {key}")
                    continue

                if key_lower in category_by_key:
                    lottery_category = category_by_key[key_lower]
                elif raw_cat_lower == "stock":
                    if "vip" in label_lower or "พิเศษ" in label_lower or "visa" in label_lower:
                        lottery_category = "vip"
                    elif "ไทย" in label:
                        lottery_category = "thai_stock"
                    else:
                        lottery_category = "foreign_stock"
                elif raw_cat_lower == "lottoforeign":
                    if "malay" in key_lower or "มาเลย์" in label:
                        lottery_category = "malay"
                    elif "hanoy" in key_lower or "hanoi" in key_lower or "ฮานอย" in label:
                        lottery_category = "hanoi"
                    elif "lao" in key_lower or "ลาว" in label:
                        lottery_category = "lao"
                    else:
                        lottery_category = "foreign_stock"
                else:
                    lottery_category = raw_cat_lower

                front3 = item.get("front3") or item.get("front3Digits") or []
                bottom3 = item.get("bottom3") or item.get("last3") or []
                if isinstance(front3, str):
                    front3 = [front3] if front3 else []
                if isinstance(bottom3, str):
                    bottom3 = [bottom3] if bottom3 else []
                if not isinstance(front3, list):
                    front3 = []
                if not isinstance(bottom3, list):
                    bottom3 = []

                canonical_label = sl.map_canonical_lottery_name(label)
                if sl.is_disallowed_lottery(canonical_label) or sl.is_disallowed_lottery(key):
                    continue

                rows.append({
                    "ชื่อหวย": canonical_label,
                    "หวย": key,
                    "หมวดหวย": lottery_category,
                    "งวดวันที่": draw_date,
                    "วันที่จัดรูปแบบ": parsed_draw_date.isoformat(),
                    "รางวัลที่_1": first_prize or top3,
                    "เลขท้าย_2_ตัว": bottom2.zfill(2),
                    "เลขบน_3_ตัว": top3.zfill(3),
                    "เลขล่าง_2_ตัว": bottom2.zfill(2),
                    "เลขหน้า_3_ตัว": [str(x).zfill(3) for x in front3 if str(x).strip()],
                    "เลขท้าย_3_ตัว": [str(x).zfill(3) for x in bottom3 if str(x).strip()],
                    "รางวัลข้างเคียงรางวัลที่_1": [],
                    "แหล่งข้อมูล": "👑เฮียฮวด พารวย",
                    "เวลาที่ตรวจพบ": datetime.datetime.now().isoformat(),
                    "สถานะการแจ้งเตือน": "pending"
                })

        print(f"[INFO] ThaiLottoAPI returned {len(rows)} published result(s) across supported categories for {today}.")
        return rows
    except Exception as e:
        print(f"[WARN] Failed fetching all supported results from ThaiLottoAPI: {e}")
        return []


def _lottery_category(row: dict) -> str:
    category = str(row.get("หมวดหวย") or "").strip().lower()
    if category:
        if category in {"stock_vip", "stock_special", "stock_visa"}:
            return "vip"
        if category == "stock":
            return "thai_stock" if "ไทย" in str(row.get("ชื่อหวย", "")) else "foreign_stock"
        return category

    key = str(row.get("หวย") or "").strip().lower()
    name = str(row.get("ชื่อหวย") or "")
    if key in {"thailotto", "gsblotto", "baaclotto"} or any(word in name for word in ("รัฐบาล", "ออมสิน", "ธ.ก.ส.")):
        return "government"
    return "unknown"


def filter_rows_by_target(rows: list, target: str = "all") -> list:
    """Apply the selected lottery category without silently falling back to Thai-only results."""
    target = str(target or "all").strip().lower()
    if target in {"", "all"}:
        return rows

    allowed = {
        "vip": {"vip"},
        "foreign_stock": {"foreign_stock"},
        "hanoi": {"hanoi"},
        "lao": {"lao"},
        "thai_stock": {"thai_stock"},
        "government": {"government", "gov_savings"},
        "malay": {"malay"},
        "liw": {"liw"},
    }
    if target not in allowed:
        print(f"[WARN] Unknown LOTTERY_TARGET '{target}'; refusing to send notifications.")
        return []

    filtered = [row for row in rows if _lottery_category(row) in allowed[target]]
    print(f"[FILTER] LOTTERY_TARGET={target}: kept {len(filtered)} of {len(rows)} result(s).")
    return filtered

LOTTERYCHECKS_ROUNDS = {
    "lao-union": ("lao_samakki", "ลาวสามัคคี", "lao"),
    "hanoi-develop": ("hanoi_patthana", "ฮานอยพัฒนา", "hanoi"),
    "hanoi-asean": ("hanoi_asean", "ฮานอยอาเซียน", "hanoi"),
    "hanoi-hd": ("hanoi_hd", "ฮานอย HD", "hanoi"),
    "hanoi-star": ("hanoi_star", "ฮานอย STAR", "hanoi"),
    "hanoi-tv": ("hanoi_tv", "ฮานอย TV", "hanoi"),
    "lao-tv": ("lao_tv", "ลาว TV", "lao"),
    "lao-hd": ("lao_hd", "ลาว HD", "lao"),
    "lao-star": ("lao_star", "ลาว STAR", "lao"),
}


def parse_lotterychecks_round(data: dict, slug: str, today: datetime.date) -> list:
    """Fail closed unless the requested round explicitly supplies today's upper/lower prizes."""
    if slug not in LOTTERYCHECKS_ROUNDS or not isinstance(data, dict) or data.get("success") is not True:
        return []
    records = data.get("data")
    if not isinstance(records, list):
        return []
    lottery_id, name, category = LOTTERYCHECKS_ROUNDS[slug]
    valid = []
    for record in records:
        if not isinstance(record, dict) or record.get("lottery") != slug or record.get("status") != "complete":
            continue
        if record.get("drawDate") != today.isoformat() or record.get("pendingPrizes"):
            continue
        prizes = record.get("prizes")
        if not isinstance(prizes, list):
            continue
        # Read explicit named prize columns; never derive the lower prize from the full number.
        found = {"3ตัวบน": set(), "2ตัวล่าง": set()}
        for prize in prizes:
            if not isinstance(prize, dict):
                continue
            label = re.sub(r"\s+", "", str(prize.get("name") or ""))
            if label not in found:
                continue
            numbers = prize.get("numbers")
            size = 3 if label == "3ตัวบน" else 2
            if not isinstance(numbers, list) or len(numbers) != 1 or not isinstance(numbers[0], str) or not re.fullmatch(r"[0-9]{%d}" % size, numbers[0]):
                return []
            found[label].add(numbers[0])
        if any(len(values) != 1 for values in found.values()):
            continue
        top, bottom = next(iter(found["3ตัวบน"])), next(iter(found["2ตัวล่าง"]))
        valid.append({
            "หวย": lottery_id, "ชื่อหวย": name, "หมวดหวย": category,
            "งวดวันที่": today.isoformat(), "วันที่จัดรูปแบบ": today.isoformat(),
            "เลขบน_3_ตัว": top, "เลขล่าง_2_ตัว": bottom,
            "รางวัลที่_1": top, "เลขท้าย_2_ตัว": bottom,
            "แหล่งข้อมูล": "LotteryChecks (https://lotterychecks.com)",
            "เวลาที่ตรวจพบ": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "สถานะการแจ้งเตือน": "pending",
        })
    # Conflicting records for one draw must not produce two different alerts.
    if len({sl.result_numbers(row) for row in valid}) > 1:
        return []
    return valid[:1]


def fetch_missing_lotterychecks_rounds(existing: list, target: str = "all") -> list:
    """Query missing supported rounds independently, with at most four concurrent requests."""
    if not sl.source_enabled(S, "lotterychecks") or target not in {"all", "lao", "hanoi"}:
        return []
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    complete = [row for row in existing if sl._parse_draw_date(row) == today and all(sl.result_numbers(row))]
    supported_ids = {entry[0] for entry in LOTTERYCHECKS_ROUNDS.values()}
    known_ids = {row.get("หวย") for row in complete if row.get("หวย") in supported_ids}
    known_names = {schedule_name(row.get("ชื่อหวย") or "") for row in complete
                   if row.get("หวย") not in supported_ids}
    missing = [slug for slug, (lottery_id, name, category) in LOTTERYCHECKS_ROUNDS.items()
               if target in {"all", category} and lottery_id not in known_ids
               and schedule_name(name) not in known_names]
    if not missing:
        return []
    def fetch_round(slug):
        url = f"https://lotterychecks.com/api/public/results?lottery={slug}&date={today.isoformat()}&limit=1"
        try:
            rows = parse_lotterychecks_round(_http_get_json(url, timeout=10), slug, today)
            if not rows:
                print(f"[WARN] LotteryChecks {slug}: no complete, valid result for {today}; retaining missing status.")
            return rows
        except Exception as error:
            print(f"[WARN] LotteryChecks {slug} unavailable: {type(error).__name__}")
            return []
    with ThreadPoolExecutor(max_workers=4) as pool:
        return [row for batch in pool.map(fetch_round, missing) for row in batch]


def fetch_from_lotterychecks() -> list:
    """Fetch latest Thai government lottery results from LotteryChecks public API."""
    source = S.get("sources", {}).get("lotterychecks", {})
    url = source.get("url", "https://lotterychecks.com/api/public/results?lottery=thai-government&limit=1")
    timeout = source.get("timeout_sec", 10)
    try:
        data = _http_get_json(url, timeout=timeout)
        if not isinstance(data, dict) or data.get("success") is not True:
            print("[WARN] LotteryChecks returned no successful result envelope.")
            return []
        records = data.get("data") or []
        if not isinstance(records, list) or not records:
            print("[WARN] LotteryChecks returned an empty result list.")
            return []
        record = records[0]
        prizes = record.get("prizes") or []
        by_slug = {str(p.get("slug", "")).lower(): p.get("numbers") or [] for p in prizes if isinstance(p, dict)}
        first = (by_slug.get("first-prize") or [None])[0]
        last2 = (by_slug.get("last-two-digit") or [None])[0]
        # Accept only a record with the two essential prize types; never synthesize missing digits.
        if first is None or last2 is None:
            print("[WARN] LotteryChecks result is missing first-prize or last-two-digit fields.")
            return []
        draw_date = str(record.get("drawDate") or "").strip()
        display_date = str(record.get("displayName") or draw_date or "งวดล่าสุด")
        if not draw_date:
            print("[WARN] LotteryChecks result has no draw date; skipping to avoid misdated alerts.")
            return []
        def numbers(slug):
            return [str(x).zfill(3) for x in by_slug.get(slug, [])]
        return [{
            "ชื่อหวย": record.get("lotteryName") or "สลากกินแบ่งรัฐบาล",
            "งวดวันที่": display_date,
            "วันที่จัดรูปแบบ": draw_date[:10],
            "รางวัลที่_1": str(first).zfill(6),
            "เลขท้าย_2_ตัว": str(last2).zfill(2),
            "เลขหน้า_3_ตัว": numbers("first-three-digit"),
            "เลขท้าย_3_ตัว": numbers("last-three-digit"),
            "รางวัลข้างเคียงรางวัลที่_1": [],
            "แหล่งข้อมูล": "LotteryChecks",
            "เวลาที่ตรวจพบ": datetime.datetime.now().isoformat(),
            "สถานะการแจ้งเตือน": "pending"
        }]
    except Exception as e:
        print(f"[WARN] Failed fetching from LotteryChecks: {e}")
        return []


def fetch_from_ranlotto() -> list:
    """Fallback for Thai government lottery results via the public RANLOTTO API."""
    url = S.get("sources", {}).get("ranlotto", {}).get(
        "url", "https://api.ranlotto.com/api/public/v1/lottery/result/latest"
    )
    timeout = S.get("sources", {}).get("ranlotto", {}).get("timeout_sec", 10)
    try:
        data = _http_get_json(url, timeout=timeout)
        if not isinstance(data, dict) or data.get("success") is False:
            return []
        payload = data.get("data") or {}
        result = payload.get("result") or {}
        state = str(payload.get("state") or "").strip().lower()
        # Do not notify for drafts, scheduled draws, or incomplete results.
        if state and state not in {"published", "complete", "completed"}:
            print(f"[INFO] RANLOTTO result state is '{state}', not published; skipping.")
            return []
        first_num = result.get("first_prize") or result.get("firstPrize") or payload.get("first_prize")
        last2_num = result.get("last_two") or result.get("last2") or result.get("last_two_digits") or payload.get("last_two")
        if not first_num or not last2_num:
            print("[WARN] RANLOTTO response did not contain both first prize and last two digits.")
            return []
        raw_date = str(payload.get("date") or data.get("facts", {}).get("date") or "").strip()
        if sl._parse_draw_date({"งวดวันที่": raw_date}) == datetime.date.min:
            print("[WARN] RANLOTTO result has no valid draw date; skipping.")
            return []
        draw_date = raw_date
        try:
            parsed = datetime.date.fromisoformat(raw_date[:10])
            thai_months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
                           "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
            draw_date = f"{parsed.day} {thai_months[parsed.month - 1]} {parsed.year + 543}"
        except (ValueError, TypeError):
            pass
        return [{
            "ชื่อหวย": "สลากกินแบ่งรัฐบาล",
            "งวดวันที่": draw_date or "งวดล่าสุด",
            "วันที่จัดรูปแบบ": sl._parse_draw_date({"งวดวันที่": raw_date}).isoformat(),
            "รางวัลที่_1": str(first_num).zfill(6),
            "เลขท้าย_2_ตัว": str(last2_num).zfill(2),
            "เลขหน้า_3_ตัว": [str(x).zfill(3) for x in (result.get("front_three") or result.get("front3") or [])],
            "เลขท้าย_3_ตัว": [str(x).zfill(3) for x in (result.get("last_three") or result.get("last3") or [])],
            "รางวัลข้างเคียงรางวัลที่_1": [],
            "แหล่งข้อมูล": "ranlotto",
            "เวลาที่ตรวจพบ": datetime.datetime.now().isoformat(),
            "สถานะการแจ้งเตือน": "pending"
        }]
    except Exception as e:
        print(f"[WARN] Failed fetching from RANLOTTO: {e}")
        return []


def fetch_from_pholhuay() -> list:
    """Fetch latest lottery results from Pholhuay source."""
    url = S.get("sources", {}).get("pholhuay", {}).get("url", "https://api.pholhuay.com/v1/lottery/latest")
    timeout = S.get("sources", {}).get("pholhuay", {}).get("timeout_sec", 10)
    
    headers = {"User-Agent": "LotteryAlert/1.0", "Accept": "application/json"}
    try:
        data = _http_get_json(url, timeout=timeout, headers=headers)
        if isinstance(data, dict) and all(sl.result_numbers({"รางวัลที่_1": data.get("first") or data.get("first_prize"), "เลขท้าย_2_ตัว": data.get("last2") or data.get("two_digits")})) and sl._parse_draw_date({"งวดวันที่": data.get("date")}) != datetime.date.min:
            return [{
                "งวดวันที่": data.get("date", "งวดล่าสุด"),
                "วันที่จัดรูปแบบ": sl._parse_draw_date({"งวดวันที่": data.get("date")}).isoformat(),
                "รางวัลที่_1": str(data.get("first") or data.get("first_prize", "")).zfill(6),
                "เลขท้าย_2_ตัว": str(data.get("last2") or data.get("two_digits", "")).zfill(2),
                "เลขหน้า_3_ตัว": [str(x).zfill(3) for x in data.get("front3", [])],
                "เลขท้าย_3_ตัว": [str(x).zfill(3) for x in data.get("rear3", [])],
                "รางวัลข้างเคียงรางวัลที่_1": [],
                "แหล่งข้อมูล": "pholhuay",
                "เวลาที่ตรวจพบ": datetime.datetime.now().isoformat(),
                "สถานะการแจ้งเตือน": "pending"
            }]
    except Exception as e:
        print(f"[WARN] Failed fetching from Pholhuay: {e}")
    
    return []


def send_ntfy_notification(row: dict) -> bool:
    """Send lottery results to ntfy server using JSON payload, native UTF-8 titles, and app click URL."""
    ntfy_server = (S.get("channels", {}).get("ntfy", {}).get("server") or S.get("ntfy", {}).get("server", "https://ntfy.sh")).rstrip("/")
    topic = NTFY_TOPIC or S.get("channels", {}).get("ntfy", {}).get("topic", "") or S.get("ntfy", {}).get("topic", "")
    
    if not S.get("channels", {}).get("ntfy", {}).get("enabled", True):
        print("[INFO] ntfy channel is disabled in config/settings.json.")
        return False

    if not topic.strip():
        print("[ERROR] ntfy topic is not configured; refusing to publish to an implicit public topic.")
        return False
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", topic.strip()):
        print("[ERROR] ntfy topic contains unsupported characters.")
        return False
    topic = topic.strip()

    raw_lottery_name = row.get("ชื่อหวย") or row.get("หวย") or "หวยไม่ระบุชื่อ"
    if sl.is_disallowed_lottery(raw_lottery_name):
        print(f"[SKIP] Disallowed lottery {raw_lottery_name} skipped from ntfy alert.")
        return False

    canonical_name = sl.map_canonical_lottery_name(raw_lottery_name)
    draw_date = row.get("งวดวันที่") or row.get("วันที่จัดรูปแบบ") or "ไม่ระบุวันที่"
    top3, bottom2 = sl.result_numbers(row)
    if not top3 or not bottom2:
        return False

    app_url = os.environ.get("APP_URL") or "https://bombim00.pages.dev"
    configured_click = S.get("channels", {}).get("ntfy", {}).get("click_url") or S.get("ntfy", {}).get("click_url") or ""
    click_url = app_url if (not configured_click or "sanook" in configured_click or "bombim00.onrender.com" in configured_click) else configured_click
    display_name = canonical_name
    if _lottery_category(row) not in {"government", "gov_savings"} and not display_name.startswith("หวย"):
        display_name = f"หวย{display_name}"
    title = f"📢 ผล{display_name} งวด {draw_date}"
    body = f"{canonical_name}\nงวด {draw_date}\n{top3} - {bottom2}"

    # Publish via JSON payload to prevent base64 header encoding bugs on Android
    url = f"{ntfy_server}/"
    payload = {
        "topic": topic,
        "title": title,
        "message": body,
        "priority": 4,
        "tags": ["loudspeaker", "dart"],
        "click": click_url,
    }

    try:
        data_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers = {"Content-Type": "application/json; charset=utf-8"}
        success = _http_post(url, data=data_bytes, headers=headers, timeout=10)
        if success:
            print("[SUCCESS] ntfy accepted a structured UTF-8 notification.")
            return True
        else:
            print(f"[ERROR] Failed posting JSON to ntfy.")
    except Exception as e:
        print(f"[ERROR] Failed to send ntfy notification: {e}")

    return False


def active_notification_channels() -> list[str]:
    channels = S.get("channels", {})
    return ["ntfy"] if channels.get("ntfy", {}).get("enabled", True) else []


def send_all_notifications(row: dict) -> bool:
    """Retry only incomplete enabled channels; one success must not hide another failure."""
    active = active_notification_channels()
    statuses = dict(row.get("notification_channels") or {})
    senders = {"ntfy": send_ntfy_notification}
    for name in active:
        if statuses.get(name) == "sent":
            continue
        statuses[name] = "sent" if senders[name](row) else "failed"
    row["notification_channels"] = statuses
    return bool(active) and all(statuses.get(name) == "sent" for name in active)


def main():
    print("=" * 60)
    print("Lottery Alert Checker Started")
    print(f"Time (UTC): {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    previous_results = sl.load_previous_results()
    catalog = load_catalog()
    rows, sources_used = [], []
    lottery_target = os.environ.get("LOTTERY_TARGET", "all").strip().lower() or "all"
    government_targets = {"all", "government"}

    # Independent sources run together; a slow government fallback must not add
    # its timeout after every stock/Lao request has already completed.
    jobs = {"stocks": fetch_from_pholhuay_stock_groups}
    if sl.source_enabled(S, "thailottoapi"):
        jobs["api"] = fetch_from_thailottoapi_results
    if lottery_target in {"all", "lao"}:
        jobs["extra"] = fetch_from_pholhuay_lao_extra
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {key: pool.submit(fetcher) for key, fetcher in jobs.items()}
        fetched = {}
        for key, future in futures.items():
            try:
                fetched[key] = future.result()
            except Exception as error:
                print(f"[WARN] Source {key} failed: {type(error).__name__}")
                fetched[key] = []
    api_rows = fetched.get("api", [])
    rows.extend(api_rows)
    if api_rows:
        sources_used.append("ThaiLottoAPI")

    print("[CHECK] Querying separated regular/VIP/special/VISA stock results...")
    def row_dedup_key(r):
        name = sl.normalize_lottery_name(r.get("ชื่อหวย") or r.get("หวย") or "")
        d = sl._parse_draw_date(r)
        date_str = d.isoformat() if d != datetime.date.min else str(r.get("งวดวันที่") or r.get("วันที่จัดรูปแบบ") or "").strip()
        top = str(r.get("เลขบน_3_ตัว") or r.get("top3") or r.get("รางวัลที่_1") or "").strip()
        bot = str(r.get("เลขล่าง_2_ตัว") or r.get("bottom2") or r.get("เลขท้าย_2_ตัว") or "").strip()
        return (name, date_str, top[-3:] if len(top) >= 3 else top, bot[-2:] if len(bot) >= 2 else bot)

    grouped_rows = fetched["stocks"]
    if grouped_rows:
        known = {row_dedup_key(r) for r in rows}
        for row in grouped_rows:
            key = row_dedup_key(row)
            if key not in known:
                rows.append(row)
                known.add(key)
        sources_used.append("ผลหวย.com stock groups")

    # This round is absent from the general API/stock feed. Read its dedicated history.
    if lottery_target in {"all", "lao"}:
        extra_rows = fetched["extra"]
        extra_dates = {sl._parse_draw_date(row) for row in rows
                       if sl.normalize_lottery_name(row.get("ชื่อหวย", "")) == sl.normalize_lottery_name("ลาว EXTRA")}
        # Existing archived rows keep their original delivery history unchanged.
        extra_dates.update(sl._parse_draw_date(row) for row in previous_results
                           if sl.normalize_lottery_name(row.get("ชื่อหวย", "")) == sl.normalize_lottery_name("ลาว EXTRA")
                           and sl._parse_draw_date(row) < today)
        rows.extend(row for row in extra_rows if sl._parse_draw_date(row) not in extra_dates)
        if extra_rows:
            sources_used.append("ผลหวย.com Lao EXTRA")

    supplementary_rows = fetch_missing_lotterychecks_rounds(rows, lottery_target)
    if supplementary_rows:
        rows.extend(supplementary_rows)
        sources_used.append("LotteryChecks Lao/Hanoi")

    # Old government rows and savings draws must not suppress the current government fallback.
    if lottery_target in government_targets and not any(
        (row.get("หวย") == "thailotto" or
         sl.normalize_lottery_name(row.get("ชื่อหวย") or "") == "สลากกินแบ่งรัฐบาล")
        and sl._parse_draw_date(row) == today
        and re.fullmatch(r"[0-9]{6}", str(row.get("รางวัลที่_1") or ""))
        for row in rows
    ):
        government_sources = [
            ("pholhuay", fetch_from_pholhuay, "pholhuay"),
            ("glo", fetch_from_glo, "glo"),
            ("lotterychecks", fetch_from_lotterychecks, "LotteryChecks"),
            ("ranlotto", fetch_from_ranlotto, "ranlotto"),
        ]
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = {name: pool.submit(fetcher) for name, fetcher, _ in government_sources if sl.source_enabled(S, name)}
            fallback_results = {}
            for name, future in futures.items():
                try:
                    fallback_results[name] = future.result()
                except Exception as error:
                    print(f"[WARN] Government source {name} failed: {type(error).__name__}")
                    fallback_results[name] = []
        for source_name, _, source_label in government_sources:
            fallback_rows = fallback_results.get(source_name, [])
            current = [row for row in fallback_rows
                       if sl._parse_draw_date(row) == today and all(sl.result_numbers(row))
                       and re.fullmatch(r"[0-9]{6}", str(row.get("รางวัลที่_1") or ""))]
            if current:
                for row in current:
                    row["ชื่อหวย"] = "สลากกินแบ่งรัฐบาล"
                    row["หวย"] = "thailotto"
                    row["หมวดหวย"] = "government"
                rows = current + rows
                sources_used.append(source_label)
                break

    # Remove duplicate provider rows while retaining the first complete result.
    unique_rows, seen_rows = [], set()
    for row in rows:
        identity = row_dedup_key(row)
        if identity not in seen_rows:
            seen_rows.add(identity)
            unique_rows.append(row)

    live_rows = filter_rows_by_target(
        [row for row in unique_rows if datetime.date.min < sl._parse_draw_date(row) <= today],
        lottery_target,
    )
    live_draws = {row_dedup_key(row)[:2] for row in live_rows}
    pending = [
        dict(row) for row in previous_results
        if row.get("สถานะการแจ้งเตือน") in {"failed", "partial"}
        and sl._parse_draw_date(row) == today
        and row_dedup_key(row)[:2] not in live_draws
    ]
    rows = live_rows + filter_rows_by_target(pending, lottery_target)
    for row in rows:
        row["เลขบน_3_ตัว"], row["เลขล่าง_2_ตัว"] = sl.result_numbers(row)
    source_used = " + ".join(dict.fromkeys(sources_used)) or None

    if not rows:
        print(f"[INFO] No live result available for LOTTERY_TARGET={lottery_target}; cached results will not be re-sent.")
        sl.write_status([], source_used=source_used)
        return

    force_notify = os.environ.get("FORCE_NOTIFY", "").strip().lower() == "true"
    delivered = []
    live_ids = {id(row) for row in live_rows}
    for row in rows:
        row.setdefault("ชื่อหวย", "หวยไม่ระบุชื่อ")
        row.setdefault("แหล่งข้อมูล", source_used or "unknown")
        active_channels = active_notification_channels()
        # Preserve delivery history even while notifications/channels are disabled.
        row["notification_channels"] = sl.previous_notification_channels(
            row, previous_results, active_channels or ["ntfy"]
        )
        # Retain historical results without publishing them as new alerts (even with force).
        if sl._parse_draw_date(row) < today:
            row["สถานะการแจ้งเตือน"] = "history_only"
            continue
        if not scheduled_result(row, catalog, today):
            row["สถานะการแจ้งเตือน"] = "sent" if any(value == "sent" for value in row["notification_channels"].values()) else "not_scheduled"
            continue
        if not sl.should_notify(S, row):
            row["สถานะการแจ้งเตือน"] = "not_eligible"
            continue
        if not active_channels:
            row["สถานะการแจ้งเตือน"] = "disabled"
            continue
        if force_notify and id(row) in live_ids:
            row["notification_channels"] = {}
        if all(row["notification_channels"].get(name) == "sent" for name in active_channels):
            row["สถานะการแจ้งเตือน"] = "sent"
            print(f"[DEDUP] Already delivered; skip {row.get('ชื่อหวย', 'unknown lottery')} / {row.get('งวดวันที่', 'unknown draw')}.")
            continue
        previously_sent = set(name for name, state in row["notification_channels"].items() if state == "sent")
        complete = send_all_notifications(row)
        newly_sent = any(state == "sent" and name not in previously_sent for name, state in row["notification_channels"].items())
        if newly_sent:
            delivered.append(row)
        if complete:
            row["สถานะการแจ้งเตือน"] = "sent"
        else:
            row["สถานะการแจ้งเตือน"] = "partial" if any(state == "sent" for state in row["notification_channels"].values()) else "failed"
            print(f"[ERROR] Delivery incomplete for {row.get('ชื่อหวย', 'unknown lottery')}; failed channels remain retryable.")

    merged, seen = [], set()
    # Historical provider backfills must not replace persisted delivery records.
    current_rows = [row for row in rows if sl._parse_draw_date(row) == today]
    historical_rows = [row for row in rows if sl._parse_draw_date(row) < today]
    for row in current_rows + previous_results + historical_rows:
        fingerprint = sl.result_fingerprint(row)
        if fingerprint not in seen:
            seen.add(fingerprint)
            merged.append(row)
    sl.save_results(merged)
    sl.write_status(rows, source_used=source_used, notifications_sent=len(delivered),
                    live_results=any(scheduled_result(row, catalog, today) for row in live_rows))
    print(f"[DONE] Checked {len(live_rows)} live result(s) for target '{lottery_target}'; delivered {len(delivered)} notification(s).")


if __name__ == "__main__":
    main()
