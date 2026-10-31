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

try:
    import requests
except ImportError:
    requests = None
    import urllib.request
    import urllib.error

import settings_loader as sl

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

            if first_num or last2_num:
                return [{
                    "งวดวันที่": date_thai or "งวดปัจจุบัน",
                    "วันที่จัดรูปแบบ": datetime.date.today().isoformat(),
                    "รางวัลที่_1": str(first_num or "").zfill(6),
                    "เลขท้าย_2_ตัว": str(last2_num or "").zfill(2),
                    "เลขหน้า_3_ตัว": [str(x).zfill(3) for x in prizes.get("first3", {}).get("number", ["000", "000"])],
                    "เลขท้าย_3_ตัว": [str(x).zfill(3) for x in prizes.get("last3", {}).get("number", ["000", "000"])],
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
                if not key or not draw_date:
                    print(f"[WARN] Skipping ThaiLottoAPI item without key/date: {label or 'unknown'}")
                    continue

                result_value = str(item.get("result") or "").strip()
                top3 = str(item.get("top3") or "").strip()
                bottom2 = str(item.get("bottom2") or item.get("last2") or "").strip()
                first_prize = str(item.get("firstPrize") or item.get("first_prize") or "").strip()
                if not top3:
                    top3 = result_value[-3:] if len(result_value) >= 3 else ""
                if not bottom2 and len(result_value) >= 2:
                    bottom2 = result_value[-2:]

                if not top3 and not first_prize:
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
                    "วันที่จัดรูปแบบ": str(item.get("drawDate") or today)[:10],
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
            "วันที่จัดรูปแบบ": raw_date[:10] if len(raw_date) >= 10 else datetime.date.today().isoformat(),
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
        if isinstance(data, dict) and (data.get("first") or data.get("first_prize")):
            return [{
                "งวดวันที่": data.get("date", "งวดล่าสุด"),
                "วันที่จัดรูปแบบ": datetime.date.today().isoformat(),
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
    first_prize = row.get("รางวัลที่_1", "-")
    last_2 = row.get("เลขท้าย_2_ตัว", "-")
    front_3 = ", ".join(row.get("เลขหน้า_3_ตัว", [])) or "-"
    last_3 = ", ".join(row.get("เลขท้าย_3_ตัว", [])) or "-"

    app_url = "https://ais-pre-tmu6ka6jf2ftxjs55cuads-13488795999.asia-east1.run.app"
    configured_click = S.get("channels", {}).get("ntfy", {}).get("click_url") or S.get("ntfy", {}).get("click_url") or ""
    click_url = app_url if (not configured_click or "sanook" in configured_click) else configured_click

    category = _lottery_category(row)
    display_name = canonical_name
    if category not in {"government", "gov_savings"} and not display_name.startswith("หวย"):
        display_name = f"หวย{display_name}"
    title = f"📢 ผล{display_name} งวด {draw_date}"
    if category in {"government", "gov_savings"}:
        body = (
            f"🎯 หวย: {canonical_name}\n"
            f"🏆 รางวัลที่ 1: {first_prize}\n"
            f"🔢 เลขท้าย 2 ตัว: {last_2}\n"
            f"✨ เลขหน้า 3 ตัว: {front_3}\n"
            f"🌟 เลขท้าย 3 ตัว: {last_3}\n"
            f"📅 งวดวันที่: {draw_date}\n"
            f"📡 แหล่งข้อมูล: 👑เฮียฮวด พารวย"
        )
    else:
        top3 = row.get("เลขบน_3_ตัว") or row.get("top3") or first_prize or "-"
        bottom2 = row.get("เลขล่าง_2_ตัว") or row.get("เลขท้าย_2_ตัว") or row.get("bottom2") or last_2 or "-"
        body = (
            f"🎯 หวย: {canonical_name}\n"
            f"🔺 3 ตัวบน: {top3}\n"
            f"🔻 2 ตัวล่าง: {bottom2}\n"
            f"📅 งวดวันที่: {draw_date}\n"
            f"📡 แหล่งข้อมูล: 👑เฮียฮวด พารวย"
        )

    # Publish via JSON payload to prevent base64 header encoding bugs on Android
    url = f"{ntfy_server}/{topic}"
    payload = {
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
            print(f"[SUCCESS] Sent clean UTF-8 ntfy notification to topic '{topic}' via {ntfy_server}")
            return True
        else:
            print(f"[ERROR] Failed posting JSON to ntfy.")
    except Exception as e:
        print(f"[ERROR] Failed to send ntfy notification: {e}")

    return False


def send_discord_notification(row: dict) -> bool:
    """Send rich embed to Discord webhook with source attribution and app link."""
    webhook_url = os.environ.get("DISCORD_WEBHOOK_URL") or S.get("channels", {}).get("discord", {}).get("webhook_url", "")
    if not webhook_url:
        return False

    raw_lottery_name = row.get("ชื่อหวย") or row.get("หวย") or "หวยไม่ระบุชื่อ"
    if sl.is_disallowed_lottery(raw_lottery_name):
        return False

    canonical_name = sl.map_canonical_lottery_name(raw_lottery_name)
    app_url = "https://ais-pre-tmu6ka6jf2ftxjs55cuads-13488795999.asia-east1.run.app"
    category = _lottery_category(row)
    if category in {"government", "gov_savings"}:
        description = (
            f"🎯 **หวย:** {canonical_name}\n"
            f"🏆 **รางวัลที่ 1:** `{row.get('รางวัลที่_1', '-')}`\n"
            f"🔢 **เลขท้าย 2 ตัว:** `{row.get('เลขท้าย_2_ตัว', '-')}`\n"
            f"✨ **เลขหน้า 3 ตัว:** `{', '.join(row.get('เลขหน้า_3_ตัว', []))}`\n"
            f"🌟 **เลขท้าย 3 ตัว:** `{', '.join(row.get('เลขท้าย_3_ตัว', []))}`"
        )
    else:
        description = (
            f"🎯 **หวย:** {canonical_name}\n"
            f"🔺 **3 ตัวบน:** `{row.get('เลขบน_3_ตัว') or row.get('top3') or row.get('รางวัลที่_1', '-')}`\n"
            f"🔻 **2 ตัวล่าง:** `{row.get('เลขล่าง_2_ตัว') or row.get('เลขท้าย_2_ตัว') or '-'}`"
        )
    payload = {
        "username": "Lottery Alert Bot",
        "avatar_url": "https://raw.githubusercontent.com/jirapatza/Bombim00/main/public/icon-192.png",
        "embeds": [{
            "title": f"📢 ผล{canonical_name} งวดวันที่ {row.get('งวดวันที่', '')}",
            "url": app_url,
            "description": description + f"\n\n📅 **งวดวันที่:** `{row.get('งวดวันที่', '')}`\n📡 **แหล่งข้อมูล:** 👑เฮียฮวด พารวย\n🔗 [กดเปิดแอปตรวจรางวัล]({app_url})",
            "color": 16107019,
            "footer": {"text": "Lottery Alert System Pro"}
        }]
    }

    try:
        success = _http_post(webhook_url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Content-Type": "application/json"})
        if success:
            print("[SUCCESS] Sent notification to Discord Webhook.")
            return True
    except Exception as e:
        print(f"[WARN] Failed posting to Discord: {e}")
    return False


def send_telegram_notification(row: dict) -> bool:
    """Send formatted HTML to Telegram chat with source attribution and app link."""
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN") or S.get("channels", {}).get("telegram", {}).get("bot_token", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID") or S.get("channels", {}).get("telegram", {}).get("chat_id", "")
    if not bot_token or not chat_id:
        return False

    raw_lottery_name = row.get("ชื่อหวย") or row.get("หวย") or "หวยไม่ระบุชื่อ"
    if sl.is_disallowed_lottery(raw_lottery_name):
        return False

    canonical_name = sl.map_canonical_lottery_name(raw_lottery_name)
    app_url = "https://ais-pre-tmu6ka6jf2ftxjs55cuads-13488795999.asia-east1.run.app"
    category = _lottery_category(row)
    if category in {"government", "gov_savings"}:
        result_text = (
            f"🎯 <b>หวย:</b> {canonical_name}\n"
            f"🏆 <b>รางวัลที่ 1:</b> <code>{row.get('รางวัลที่_1', '-')}</code>\n"
            f"🔢 <b>เลขท้าย 2 ตัว:</b> <code>{row.get('เลขท้าย_2_ตัว', '-')}</code>\n"
            f"✨ <b>เลขหน้า 3 ตัว:</b> <code>{', '.join(row.get('เลขหน้า_3_ตัว', []))}</code>\n"
            f"🌟 <b>เลขท้าย 3 ตัว:</b> <code>{', '.join(row.get('เลขท้าย_3_ตัว', []))}</code>"
        )
    else:
        result_text = (
            f"🎯 <b>หวย:</b> {canonical_name}\n"
            f"🔺 <b>3 ตัวบน:</b> <code>{row.get('เลขบน_3_ตัว') or row.get('top3') or row.get('รางวัลที่_1', '-')}</code>\n"
            f"🔻 <b>2 ตัวล่าง:</b> <code>{row.get('เลขล่าง_2_ตัว') or row.get('เลขท้าย_2_ตัว') or '-'}</code>"
        )
    text = (
        f"📢 <b>ผล{canonical_name} งวดวันที่ {row.get('งวดวันที่', '')}</b>\n\n"
        f"{result_text}\n"
        f"📅 <b>งวดวันที่:</b> <code>{row.get('งวดวันที่', '')}</code>\n"
        f"📡 <b>แหล่งข้อมูล:</b> 👑เฮียฮวด พารวย\n\n"
        f"🔗 <a href='{app_url}'>เปิดแอปตรวจรางวัลทันที</a>"
    )

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        success = _http_post(url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Content-Type": "application/json"})
        if success:
            print("[SUCCESS] Sent notification to Telegram.")
            return True
    except Exception as e:
        print(f"[WARN] Failed posting to Telegram: {e}")
    return False


def send_all_notifications(row: dict) -> bool:
    """Dispatch alert across all active notification channels."""
    s1 = send_ntfy_notification(row)
    s2 = send_discord_notification(row)
    s3 = send_telegram_notification(row)
    return s1 or s2 or s3


def main():
    print("=" * 60)
    print("Lottery Alert Checker Started")
    print(f"Time (UTC): {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    previous_results = sl.load_previous_results()
    rows, sources_used = [], []
    lottery_target = os.environ.get("LOTTERY_TARGET", "all").strip().lower() or "all"
    government_targets = {"all", "government"}

    if sl.source_enabled(S, "thailottoapi"):
        print("[CHECK] Querying ThaiLottoAPI for all supported lottery categories...")
        api_rows = fetch_from_thailottoapi_results()
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

    grouped_rows = fetch_from_pholhuay_stock_groups()
    if grouped_rows:
        known = {row_dedup_key(r) for r in rows}
        for row in grouped_rows:
            key = row_dedup_key(row)
            if key not in known:
                rows.append(row)
                known.add(key)
        sources_used.append("ผลหวย.com stock groups")

    # Government feeds are checked independently when requested, not only when every other lottery fails.
    if lottery_target in government_targets and not any(_lottery_category(row) == "government" for row in rows):
        for source_name, fetcher, source_label in (
            ("pholhuay", fetch_from_pholhuay, "pholhuay"),
            ("glo", fetch_from_glo, "glo"),
            ("lotterychecks", fetch_from_lotterychecks, "LotteryChecks"),
            ("ranlotto", fetch_from_ranlotto, "ranlotto"),
        ):
            if not sl.source_enabled(S, source_name):
                continue
            print(f"[CHECK] Querying government fallback source: {source_name}...")
            fallback_rows = fetcher()
            if fallback_rows:
                for row in fallback_rows:
                    row.setdefault("หมวดหวย", "government")
                rows.extend(fallback_rows)
                sources_used.append(source_label)
                break

    # Remove duplicate provider rows while retaining the first complete result.
    unique_rows, seen_rows = [], set()
    for row in rows:
        identity = row_dedup_key(row)
        if identity not in seen_rows:
            seen_rows.add(identity)
            unique_rows.append(row)

    rows = filter_rows_by_target(unique_rows, lottery_target)
    source_used = " + ".join(dict.fromkeys(sources_used)) or None

    if not rows:
        print(f"[INFO] No live result available for LOTTERY_TARGET={lottery_target}; cached results will not be re-sent.")
        sl.write_status([], source_used=source_used)
        return

    force_notify = os.environ.get("FORCE_NOTIFY", "").strip().lower() == "true"
    delivered = []
    for row in rows:
        row.setdefault("ชื่อหวย", "หวยไม่ระบุชื่อ")
        row.setdefault("แหล่งข้อมูล", source_used or "unknown")
        if not sl.should_notify(S, row):
            row["สถานะการแจ้งเตือน"] = "not_eligible"
            continue
        if not force_notify and sl.was_already_notified(row, previous_results):
            row["สถานะการแจ้งเตือน"] = "sent"
            print(f"[DEDUP] Already delivered; skip {row.get('ชื่อหวย', 'unknown lottery')} / {row.get('งวดวันที่', 'unknown draw')}.")
            continue
        if send_all_notifications(row):
            row["สถานะการแจ้งเตือน"] = "sent"
            delivered.append(row)
        else:
            row["สถานะการแจ้งเตือน"] = "failed"
            print(f"[ERROR] Delivery failed for {row.get('ชื่อหวย', 'unknown lottery')}; result remains retryable.")

    merged, seen = [], set()
    for row in rows + previous_results:
        fingerprint = sl.result_fingerprint(row)
        if fingerprint not in seen:
            seen.add(fingerprint)
            merged.append(row)
    sl.save_results(merged[:500])
    sl.write_status(rows, source_used=source_used, notifications_sent=len(delivered))
    print(f"[DONE] Checked {len(rows)} live result(s) for target '{lottery_target}'; delivered {len(delivered)} notification(s).")


if __name__ == "__main__":
    main()
