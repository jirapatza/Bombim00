#!/usr/bin/env python3
"""
lottery_checker.py - Main lottery checker and alert dispatch script.
Lottery Alert System: สคริปต์ตรวจสอบผลสลากกินแบ่งรัฐบาลและส่งแจ้งเตือนผ่าน ntfy
"""

import os
import sys
import json
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
        from bs4 import BeautifulSoup
        html = _http_get_text(url, timeout=15)
        if not html:
            print("[WARN] Stock group page returned empty HTML.")
            return []
        soup = BeautifulSoup(html, "html.parser")
        rows = []
        group = ""
        group_map = {
            "หวยหุ้นต่างประเทศ": "stock",
            "หวยหุ้น VIP": "stock_vip",
            "หวยหุ้นพิเศษ": "stock_special",
            "หวยหุ้น VISA": "stock_visa",
        }
        headings = soup.find_all(["h2", "h3"])
        for heading in headings:
            label = heading.get_text(" ", strip=True)
            if heading.name == "h2":
                for key, value in group_map.items():
                    if key in label:
                        group = value
                        break
                continue
            if heading.name != "h3" or not group:
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
            date_match = re.search(r"งวด\s*วันที่?\s*(\d{1,2}\s+[^\s]+\s+\d{4})", card_text)
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


def fetch_from_thailottoapi_stock() -> list:
    """Fetch published stock/VIP lottery results, the system's primary target."""
    cfg = S.get("sources", {}).get("thailottoapi", {})
    base = cfg.get("url", "https://thailottoapi.com/api/results")
    timeout = cfg.get("timeout_sec", 12)
    # Use Thailand local date; request a fresh sync so the endpoint doesn't stay on yesterday's cache.
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date().isoformat()
    url = f"{base}?date={today}&sync=1"
    try:
        data = _http_get_json(url, timeout=timeout, headers={
            "User-Agent": "LotteryAlert/1.0 (+https://github.com/jirapatza/Bombim00)",
            "Accept": "application/json"
        })
        if not isinstance(data, dict) or data.get("ok") is not True:
            print("[WARN] ThaiLottoAPI returned no successful response.")
            return []
        categories = data.get("categories") or {}
        stock = categories.get("stock") or {}
        items = stock.get("items") or []
        rows = []
        for item in items:
            if not isinstance(item, dict) or str(item.get("status", "")).lower() != "success":
                continue
            top3 = str(item.get("top3") or "").strip()
            bottom2 = str(item.get("bottom2") or "").strip()
            draw_date = str(item.get("drawDateDisplay") or item.get("drawDate") or "").strip()
            if not top3 or not bottom2 or not draw_date:
                print(f"[WARN] Skipping incomplete stock result: {item.get('key', 'unknown')}")
                continue
            rows.append({
                "ชื่อหวย": str(item.get("label") or item.get("key") or "หวยหุ้น"),
                "หวย": str(item.get("key") or ""),
                "หมวดหวย": "stock",
                "งวดวันที่": draw_date,
                "วันที่จัดรูปแบบ": str(item.get("drawDate") or today)[:10],
                "รางวัลที่_1": top3.zfill(3),
                "เลขท้าย_2_ตัว": bottom2.zfill(2),
                "เลขบน_3_ตัว": top3.zfill(3),
                "เลขล่าง_2_ตัว": bottom2.zfill(2),
                "เลขหน้า_3_ตัว": [],
                "เลขท้าย_3_ตัว": [],
                "รางวัลข้างเคียงรางวัลที่_1": [],
                "แหล่งข้อมูล": "ThaiLottoAPI",
                "เวลาที่ตรวจพบ": datetime.datetime.now().isoformat(),
                "สถานะการแจ้งเตือน": "pending"
            })
        print(f"[INFO] ThaiLottoAPI stock category: {len(rows)} published result(s) for {today}.")
        return rows
    except Exception as e:
        print(f"[WARN] Failed fetching stock results from ThaiLottoAPI: {e}")
        return []


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
    """Send lottery results to ntfy server using configuration in settings.json."""
    ntfy_server = S.get("ntfy", {}).get("server", "https://ntfy.sh").rstrip("/")
    topic = NTFY_TOPIC or S.get("channels", {}).get("ntfy", {}).get("topic", "")
    
    if not S.get("channels", {}).get("ntfy", {}).get("enabled", True):
        print("[INFO] ntfy channel is disabled in config/settings.json.")
        return False
    if not topic:
        print("[ERROR] NTFY_TOPIC is empty; cannot deliver push notification.")
        return False

    url = f"{ntfy_server}/{topic}"
    
    draw_date = row.get("งวดวันที่", "สลากกินแบ่งรัฐบาล")
    first_prize = row.get("รางวัลที่_1", "-")
    last_2 = row.get("เลขท้าย_2_ตัว", "-")
    front_3 = ", ".join(row.get("เลขหน้า_3_ตัว", [])) or "-"
    last_3 = ", ".join(row.get("เลขท้าย_3_ตัว", [])) or "-"

    tmpl = S.get("message_template", {})
    title_pattern = tmpl.get("title", "📢 ผล{lottery_name} งวด {draw_date}")
    body_pattern = tmpl.get("body", "🎯 รางวัลที่ 1: {first_prize}\n🔢 เลขท้าย 2 ตัว: {last_2}\n✨ เลขหน้า 3 ตัว: {front_3}\n🌟 เลขท้าย 3 ตัว: {last_3}\n📡 แหล่งข้อมูล: {source}")

    template_vars = {
        "lottery_name": row.get("ชื่อหวย", "สลากกินแบ่งรัฐบาล"),
        "draw_date": draw_date,
        "first_prize": first_prize,
        "last_2": last_2,
        "front_3": front_3,
        "last_3": last_3,
        "source": row.get('แหล่งข้อมูล', 'official'),
        "next_closing": "หวยฮานอยพิเศษ (17:00 น.)"
    }

    try:
        title = title_pattern.format(**template_vars)
        if str(row.get("หมวดหวย", "")).startswith("stock"):
            body = (
                f"{title}\n\n"
                f"📈 ตลาด: {row.get('ชื่อหวย', 'หวยหุ้น')}\n"
                f"🔺 3 ตัวบน: {row.get('เลขบน_3_ตัว', row.get('รางวัลที่_1', '-'))}\n"
                f"🔻 2 ตัวล่าง: {row.get('เลขล่าง_2_ตัว', row.get('เลขท้าย_2_ตัว', '-'))}\n"
                f"📅 งวด: {draw_date}\n"
                f"📡 แหล่งข้อมูล: {row.get('แหล่งข้อมูล', 'unknown')}"
            )
        else:
            body = f"{title}\n\n" + body_pattern.format(**template_vars)
    except Exception:
        title = f"📢 ผลสลากกินแบ่งรัฐบาล งวด {draw_date}"
        body = f"{title}\n\n🎯 รางวัลที่ 1: {first_prize}\n🔢 เลขท้าย 2 ตัว: {last_2}\n✨ เลขหน้า 3 ตัว: {front_3}\n🌟 เลขท้าย 3 ตัว: {last_3}\n📡 แหล่งข้อมูล: {row.get('แหล่งข้อมูล', 'official')}"

    priority = S.get("ntfy", {}).get("default_priority", "high")
    tags = ",".join(S.get("ntfy", {}).get("tags", ["moneybag", "dart"]))
    click_url = S.get("ntfy", {}).get("click_url", "")

    headers = {
        "Title": "Lottery result alert",
        "Priority": priority,
        "Tags": tags,
    }
    if click_url:
        headers["Click"] = click_url

    try:
        success = _http_post(url, data=body.encode("utf-8"), headers=headers, timeout=10)
        if success:
            print(f"[SUCCESS] Sent ntfy notification to topic '{topic}' via {ntfy_server}")
            return True
        else:
            print(f"[ERROR] Failed posting to ntfy.")
    except Exception as e:
        print(f"[ERROR] Failed to send ntfy notification: {e}")

    return False


def send_discord_notification(row: dict) -> bool:
    """Send rich embed to Discord webhook if configured."""
    webhook_url = os.environ.get("DISCORD_WEBHOOK_URL") or S.get("channels", {}).get("discord", {}).get("webhook_url", "")
    if not webhook_url:
        return False

    payload = {
        "username": "Lottery Alert Bot",
        "embeds": [{
            "title": f"📢 ผลสลากกินแบ่งรัฐบาล งวดวันที่ {row.get('งวดวันที่', '')}",
            "description": f"🎯 **รางวัลที่ 1:** `{row.get('รางวัลที่_1', '-')}`\n🔢 **เลขท้าย 2 ตัว:** `{row.get('เลขท้าย_2_ตัว', '-')}`\n✨ **เลขหน้า 3 ตัว:** `{', '.join(row.get('เลขหน้า_3_ตัว', []))}`\n🌟 **เลขท้าย 3 ตัว:** `{', '.join(row.get('เลขท้าย_3_ตัว', []))}`\n⏰ **ปิดรอบถัดไป:** หวยฮานอยพิเศษ (17:00 น.)",
            "color": 16107019,
            "footer": {"text": "Lottery Alert System Pro"}
        }]
    }

    try:
        success = _http_post(webhook_url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
        if success:
            print("[SUCCESS] Sent notification to Discord Webhook.")
            return True
    except Exception as e:
        print(f"[WARN] Failed posting to Discord: {e}")
    return False


def send_telegram_notification(row: dict) -> bool:
    """Send formatted HTML to Telegram chat if configured."""
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN") or S.get("channels", {}).get("telegram", {}).get("bot_token", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID") or S.get("channels", {}).get("telegram", {}).get("chat_id", "")
    if not bot_token or not chat_id:
        return False

    text = (
        f"📢 <b>ผลสลากกินแบ่งรัฐบาล งวดวันที่ {row.get('งวดวันที่', '')}</b>\n\n"
        f"🎯 <b>รางวัลที่ 1:</b> <code>{row.get('รางวัลที่_1', '-')}</code>\n"
        f"🔢 <b>เลขท้าย 2 ตัว:</b> <code>{row.get('เลขท้าย_2_ตัว', '-')}</code>\n"
        f"✨ <b>เลขหน้า 3 ตัว:</b> <code>{', '.join(row.get('เลขหน้า_3_ตัว', []))}</code>\n"
        f"🌟 <b>เลขท้าย 3 ตัว:</b> <code>{', '.join(row.get('เลขท้าย_3_ตัว', []))}</code>\n"
        f"⏰ <b>ปิดรอบถัดไป:</b> หวยฮานอยพิเศษ (17:00 น.)"
    )

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        success = _http_post(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
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
    rows, source_used = [], None

    # Priority 1: merge regular stock API results with the site's explicitly separated VIP/special/VISA groups.
    if sl.source_enabled(S, "thailottoapi"):
        print("[CHECK] Querying primary regular stock source: thailottoapi...")
        regular_rows = fetch_from_thailottoapi_stock()
        rows.extend(regular_rows)
        if regular_rows:
            source_used = "ThaiLottoAPI + stock group scraper"

    print("[CHECK] Querying separated regular/VIP/special/VISA stock results...")
    grouped_rows = fetch_from_pholhuay_stock_groups()
    if grouped_rows:
        known = {(r.get("ชื่อหวย"), r.get("งวดวันที่"), r.get("เลขบน_3_ตัว"), r.get("เลขล่าง_2_ตัว")) for r in rows}
        for row in grouped_rows:
            key = (row.get("ชื่อหวย"), row.get("งวดวันที่"), row.get("เลขบน_3_ตัว"), row.get("เลขล่าง_2_ตัว"))
            if key not in known:
                rows.append(row)
                known.add(key)
        source_used = source_used or "ผลหวย.com stock groups"

    # Government results remain a fallback only when no live stock result is available.
    # Never treat cached history as a fresh result.
    if not rows and sl.source_enabled(S, "pholhuay"):
        print("[CHECK] Querying source: pholhuay...")
        rows = fetch_from_pholhuay()
        if rows:
            source_used = "pholhuay"
    if not rows and sl.source_enabled(S, "glo"):
        print("[CHECK] Querying source: glo...")
        rows = fetch_from_glo()
        if rows:
            source_used = "glo"
    if not rows and sl.source_enabled(S, "lotterychecks"):
        print("[CHECK] Querying fallback source: lotterychecks...")
        rows = fetch_from_lotterychecks()
        if rows:
            source_used = "LotteryChecks"
    if not rows and sl.source_enabled(S, "ranlotto"):
        print("[CHECK] Querying fallback source: ranlotto...")
        rows = fetch_from_ranlotto()
        if rows:
            source_used = "ranlotto"

    if not rows:
        print("[INFO] No live result available; cached results will not be re-sent.")
        sl.write_status([], source_used=source_used)
        return

    force_notify = os.environ.get("FORCE_NOTIFY", "").strip().lower() == "true"
    delivered = []
    for row in rows:
        row.setdefault("ชื่อหวย", "สลากกินแบ่งรัฐบาล")
        row.setdefault("แหล่งข้อมูล", source_used or "unknown")
        if not sl.should_notify(S, row):
            row["สถานะการแจ้งเตือน"] = "not_eligible"
            continue
        if not force_notify and sl.was_already_notified(row, previous_results):
            row["สถานะการแจ้งเตือน"] = "sent"
            print(f"[DEDUP] Already delivered; skip {row.get('งวดวันที่', 'unknown draw')}.")
            continue
        if send_all_notifications(row):
            row["สถานะการแจ้งเตือน"] = "sent"
            delivered.append(row)
        else:
            row["สถานะการแจ้งเตือน"] = "failed"
            print("[ERROR] All configured notification channels failed; result remains retryable.")

    merged, seen = [], set()
    for row in rows + previous_results:
        fingerprint = sl.result_fingerprint(row)
        if fingerprint not in seen:
            seen.add(fingerprint)
            merged.append(row)
    sl.save_results(merged[:200])
    sl.write_status(rows, source_used=source_used, notifications_sent=len(delivered))
    print(f"[DONE] Checked {len(rows)} live result(s); delivered {len(delivered)} notification(s).")


if __name__ == "__main__":
    main()
