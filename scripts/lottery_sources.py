"""Public result sources for the 54-lottery catalog.

Every adapter returns plain dicts and never raises on network failure: a failed
fetch yields an empty result plus a recorded reason, so the collector can keep
going through the rest of the catalog.
"""

from __future__ import annotations

import datetime
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

import requests

THAI_MONTHS = (
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
)

THAILOTTOAPI_URL = "https://thailottoapi.com/api/results"
PHOLHUAY_BASE = "https://xn--t3cmiit.com"
USER_AGENT = "Mozilla/5.0 (compatible; Bombim00Collector/2.0)"


def thai_date_to_iso(text: str) -> str:
    """Convert a Thai or ISO draw date to YYYY-MM-DD, or '' when unparseable."""
    value = (text or "").strip()
    iso = re.match(r"^(\d{4})-(\d{2})-(\d{2})", value)
    if iso:
        year = int(iso.group(1))
        return f"{year - 543 if year >= 2400 else year:04d}-{iso.group(2)}-{iso.group(3)}"
    thai = re.match(r"^(\d{1,2})\s+(\S+)\s+(\d{4})$", value)
    if thai and thai.group(2) in THAI_MONTHS:
        month = THAI_MONTHS.index(thai.group(2)) + 1
        year = int(thai.group(3))
        return f"{year - 543 if year >= 2400 else year:04d}-{month:02d}-{int(thai.group(1)):02d}"
    numeric = re.match(r"^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$", value)
    if numeric:
        year = int(numeric.group(3))
        return f"{year - 543 if year >= 2400 else year:04d}-{int(numeric.group(2)):02d}-{int(numeric.group(1)):02d}"
    return ""


def iso_to_thai_date(iso: str) -> str:
    """Render YYYY-MM-DD as the Buddhist-era label used by the catalog."""
    try:
        day = datetime.date.fromisoformat(iso)
    except (TypeError, ValueError):
        return ""
    return f"{day.day} {THAI_MONTHS[day.month - 1]} {day.year + 543}"


def digits(value, width: int) -> str:
    """Keep leading zeros by treating every number as text."""
    text = str(value if value is not None else "").strip()
    return text if re.fullmatch(rf"[0-9]{{{width}}}", text) else ""


@dataclass
class SourceError(Exception):
    reason: str

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.reason


@dataclass
class Record:
    top3: str
    bottom2: str
    draw_date: str
    source: str
    first_prize: str = ""
    label: str = ""
    extra: dict = field(default_factory=dict)

    def as_result(self) -> dict:
        # firstPrize carries a 3 or 6 digit prize only; a 5-digit Lao/Hanoi
        # "รางวัลพิเศษ" is kept in the evidence file instead of the catalog.
        special = self.first_prize if re.fullmatch(r"[0-9]{5}", self.first_prize or "") else ""
        first = self.first_prize if re.fullmatch(r"[0-9]{3}|[0-9]{6}", self.first_prize or "") else self.top3
        result = {
            "top3": self.top3,
            "bottom2": self.bottom2,
            "firstPrize": first,
            "date": iso_to_thai_date(self.draw_date),
            "drawDate": self.draw_date,
            "source": self.source,
            "label": self.label,
        }
        if special:
            result["specialPrize"] = special
        return result


def http_get(url: str, timeout: float = 15.0, retries: int = 3, session=None) -> str:
    """GET with bounded retries and exponential backoff."""
    caller = session or requests
    last = "unknown"
    for attempt in range(retries):
        try:
            response = caller.get(url, timeout=timeout, headers={"User-Agent": USER_AGENT})
            if response.status_code == 200:
                return response.text
            last = f"http_{response.status_code}"
        except Exception as error:  # noqa: BLE001 - network errors are expected
            last = type(error).__name__
        if attempt + 1 < retries:
            time.sleep(min(2 ** attempt, 4))
    raise SourceError(f"{last} for {url}")


def strip_markup(html: str) -> str:
    text = re.sub(r"<script.*?</script>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text)


# --- ThaiLottoAPI -----------------------------------------------------------

TLA_LABELS = {
    "thailotto": "หวยรัฐบาลไทย",
    "gsblotto": "หวยออมสิน",
    "baaclotto": "หวยธกส.",
    "laoslotto": "ลาวพัฒนา",
    "hanoylottospecial": "ฮานอยพิเศษ",
    "hanoylotto": "ฮานอยปกติ",
    "hanoylottovip": "ฮานอย VIP",
    "stocknikkei1": "นิเคอิเช้า",
    "stocknikkei2": "นิเคอิบ่าย",
    "stockchina1": "จีนเช้า",
    "stockchina2": "จีนบ่าย",
    "stockhangseng1": "ฮั่งเส็งเช้า",
    "stockhangseng2": "ฮั่งเส็งบ่าย",
    "stocktaiwan": "ไต้หวัน",
    "stockkorea": "เกาหลี",
    "stocksingapore": "สิงคโปร์",
    "stockindia": "อินเดีย",
    "stockthai4": "ไทยเย็น",
    "stockengland": "อังกฤษ",
    "stockgerman": "เยอรมัน",
    "stockrussia": "รัสเซีย",
    "stockdowjones": "ดาวโจนส์",
}


def parse_thailottoapi(payload: dict, source_url: str = THAILOTTOAPI_URL) -> dict:
    """Flatten the category tree into key -> Record, keeping empty draws out."""
    records = {}
    for category in (payload or {}).get("categories", {}).values():
        for item in category.get("items", []):
            top3 = digits(item.get("top3"), 3)
            bottom2 = digits(item.get("bottom2"), 2)
            draw_date = thai_date_to_iso(str(item.get("drawDate") or ""))
            if not (top3 and bottom2 and draw_date):
                continue
            first = digits(item.get("result"), 6)
            records[item["key"]] = Record(
                top3=top3,
                bottom2=bottom2,
                draw_date=draw_date,
                source=f"ThaiLottoAPI ({source_url})",
                first_prize=first,
                label=item.get("label", ""),
            )
    return records


def fetch_thailottoapi(days: int = 4, today: datetime.date | None = None) -> tuple[dict, list]:
    """Collect the newest available record per key over the last `days` days."""
    today = today or datetime.date.today()
    merged, reasons = {}, []
    for offset in range(days):
        day = today - datetime.timedelta(days=offset)
        url = f"{THAILOTTOAPI_URL}?date={day.isoformat()}"
        try:
            payload = json.loads(http_get(url, timeout=20))
        except (SourceError, ValueError) as error:
            reasons.append(f"{day.isoformat()}: {error}")
            continue
        for key, record in parse_thailottoapi(payload, url).items():
            current = merged.get(key)
            if current is None or record.draw_date > current.draw_date:
                merged[key] = record
    return merged, reasons


# --- ผลหวย.com (pholhuay) ---------------------------------------------------

def parse_pholhuay_page(html: str, source_url: str) -> Record | None:
    """Read the 'latest draw' block of a per-lottery page."""
    text = strip_markup(html)
    date_match = re.search(r"งวด\s*(\d{1,2}\s+\S+\s+\d{4})", text)
    top_match = re.search(r"3\s*ตัวบน\s*(\d{3})", text)
    bottom_match = re.search(r"2\s*ตัวล่าง\s*(\d{2})", text)
    if not (date_match and top_match and bottom_match):
        return None
    draw_date = thai_date_to_iso(date_match.group(1))
    if not draw_date:
        return None
    special = re.search(r"รางวัลพิเศษ\s*(\d{5})", text)
    return Record(
        top3=top_match.group(1),
        bottom2=bottom_match.group(1),
        draw_date=draw_date,
        source=f"ผลหวย.com ({source_url})",
        first_prize=special.group(1) if special else "",
    )


def fetch_pholhuay_page(slug: str) -> Record | None:
    url = f"{PHOLHUAY_BASE}{slug}"
    return parse_pholhuay_page(http_get(url), url)


STOCK_GROUPS = {
    "หวยหุ้นต่างประเทศ": "stock",
    "หวยหุ้น VIP": "stock_vip",
    "หวยหุ้นพิเศษ": "stock_special",
    "หวยหุ้น VISA": "stock_visa",
}


def parse_pholhuay_stock_groups(html: str, source_url: str = f"{PHOLHUAY_BASE}/stock-lottery") -> list:
    """Parse the separated regular/VIP/special/VISA stock cards."""
    from html.parser import HTMLParser

    class Collector(HTMLParser):
        def __init__(self):
            super().__init__()
            self.group = ""
            self.cards = []
            self._heading = None
            self._buffer = []

        def handle_starttag(self, tag, attrs):
            if tag in ("h2", "h3"):
                self._heading = tag
                self._buffer = []

        def handle_endtag(self, tag):
            if self._heading and tag == self._heading:
                label = re.sub(r"\s+", " ", "".join(self._buffer)).strip()
                if tag == "h2":
                    self.group = next((v for k, v in STOCK_GROUPS.items() if k in label), "")
                elif self.group and label.startswith("หวยหุ้น"):
                    self.cards.append((self.group, label))
                self._heading = None
                self._buffer = []

        def handle_data(self, data):
            if self._heading:
                self._buffer.append(data)

    parser = Collector()
    parser.feed(html)
    text = strip_markup(html)
    rows, cursor = [], 0
    for group, label in parser.cards:
        marker = text.find(label, cursor)
        if marker < 0:
            continue
        window = text[marker: marker + 700]
        cursor = marker + len(label)
        date_match = re.search(r"งวด\s*(\d{1,2}\s+\S+\s+\d{4})", window)
        top_match = re.search(r"3\s*ตัวบน\s*(\d{3})", window)
        bottom_match = re.search(r"2\s*ตัวล่าง\s*(\d{2})", window)
        if not (date_match and top_match and bottom_match):
            continue
        draw_date = thai_date_to_iso(date_match.group(1))
        if not draw_date:
            continue
        rows.append(Record(
            top3=top_match.group(1),
            bottom2=bottom_match.group(1),
            draw_date=draw_date,
            source=f"ผลหวย.com ({source_url})",
            label=label,
            extra={"group": group},
        ))
    unique, seen = [], set()
    for row in rows:
        key = (row.extra.get("group"), row.label, row.draw_date, row.top3, row.bottom2)
        if key not in seen:
            seen.add(key)
            unique.append(row)
    return unique


def fetch_pholhuay_stock_groups() -> list:
    url = f"{PHOLHUAY_BASE}/stock-lottery"
    return parse_pholhuay_stock_groups(http_get(url), url)


# --- Catalog mapping --------------------------------------------------------

# id -> ("page", slug) | ("tla", key) | ("stock", group, label regex)
CATALOG_SOURCES = {
    "lao_extra": ("page", "/lao-lottery/extra"),
    "nikkei_vip_morning": ("stock", "stock_vip", r"นิคเคอิ VIP เช้า"),
    "hanoi_asean": ("page", "/hanoi-lottery/asean"),
    "nikkei_morning": ("tla", "stocknikkei1"),
    "china_vip_morning": ("stock", "stock_vip", r"จีน VIP เช้า"),
    "china_morning": ("tla", "stockchina1"),
    "lao_tv": ("page", "/lao-lottery/tv"),
    "hangseng_vip_morning": ("stock", "stock_vip", r"ฮั่งเส็ง VIP เช้า"),
    "hangseng_morning": ("tla", "stockhangseng1"),
    "taiwan_vip": ("stock", "stock_vip", r"ไต้หวัน VIP"),
    "hanoi_star": ("page", "/hanoi-lottery/star"),
    "taiwan": ("tla", "stocktaiwan"),
    "korea_vip": ("stock", "stock_vip", r"เกาหลี VIP"),
    "korea": ("tla", "stockkorea"),
    "nikkei_afternoon": ("tla", "stocknikkei2"),
    "nikkei_vip_afternoon": ("stock", "stock_vip", r"นิคเคอิ VIP บ่าย"),
    "lao_hd": ("page", "/lao-lottery/hd"),
    "china_afternoon": ("tla", "stockchina2"),
    "hanoi_tv": ("page", "/hanoi-lottery/tv"),
    "china_vip_afternoon": ("stock", "stock_vip", r"จีน VIP บ่าย"),
    "hangseng_afternoon": ("tla", "stockhangseng2"),
    "hangseng_vip_afternoon": ("stock", "stock_vip", r"ฮั่งเส็ง VIP บ่าย"),
    "lao_star": ("page", "/lao-lottery/star"),
    "singapore": ("tla", "stocksingapore"),
    "thai_stock_evening": ("tla", "stockthai4"),
    "hanoi_redcross": ("page", "/hanoi-lottery/redcross"),
    "india": ("tla", "stockindia"),
    "singapore_vip": ("stock", "stock_vip", r"สิงคโปร์ VIP"),
    "hanoi_samakki": ("page", "/hanoi-lottery/union"),
    "hanoi_special": ("page", "/hanoi-lottery/special"),
    "hanoi_regular": ("page", "/hanoi-lottery/normal"),
    "hanoi_vip": ("page", "/hanoi-lottery/vip"),
    "hanoi_patthana": ("page", "/hanoi-lottery/develop"),
    "lao_patthana": ("tla", "laoslotto"),
    "lao_asean": ("page", "/lao-lottery/asean"),
    "lao_vip": ("page", "/lao-lottery/vip"),
    "lao_samakki_vip": ("page", "/lao-lottery/union-vip"),
    "lao_star_vip": ("page", "/lao-lottery/star-vip"),
    "hanoi_extra": ("page", "/hanoi-lottery/extra"),
    "england": ("tla_or_stock", "stockengland", "stock", r"อังกฤษ$"),
    "germany": ("tla_or_stock", "stockgerman", "stock", r"เยอรมัน$"),
    "russia": ("tla_or_stock", "stockrussia", "stock", r"รัสเซีย$"),
    "lao_redcross": ("page", "/lao-lottery/redcross"),
    "dowjones": ("tla_or_stock", "stockdowjones", "stock", r"ดาวโจนส์$"),
    "thai_gov": ("tla", "thailotto"),
    "gsb": ("tla", "gsblotto"),
    "baac": ("tla", "baaclotto"),
}

# Items with no verifiable public source, with the reason recorded as evidence.
UNSOURCED = {
    "hanoi_hd": "ไม่พบหน้าผลรางวัลของฮานอย HD ในแหล่งที่ตรวจสอบได้ (ผลหวย.com ไม่มีหมวดนี้)",
    "lao_samakki": "ผลหวย.com ไม่มีหน้าลาวสามัคคี (มีเฉพาะลาวสามัคคี VIP) และ ThaiLottoAPI ไม่มีคู่นี้",
    "england_vip": "ผลหวย.com หน้าแยกหมวดหุ้นไม่มีอังกฤษ VIP (มีเฉพาะอังกฤษพิเศษ/VISA)",
    "germany_vip": "ผลหวย.com หน้าแยกหมวดหุ้นไม่มีเยอรมัน VIP (มีเฉพาะเยอรมันพิเศษ/VISA)",
    "russia_vip": "ผลหวย.com หน้าแยกหมวดหุ้นไม่มีรัสเซีย VIP (มีเฉพาะรัสเซียพิเศษ/VISA)",
    "dowjones_vip": "ผลหวย.com หน้าแยกหมวดหุ้นไม่มีดาวโจนส์ VIP",
    "dowjones_star": "ไม่พบแหล่งประกาศผลดาวโจนส์ STAR ที่ตรวจสอบได้",
}


def collect_sources(days: int = 4, today: datetime.date | None = None) -> tuple[dict, list]:
    """Fetch every source once and return a lookup structure plus error reasons."""
    reasons = []
    tla, tla_reasons = fetch_thailottoapi(days=days, today=today)
    reasons.extend(f"ThaiLottoAPI {reason}" for reason in tla_reasons)
    stocks = []
    try:
        stocks = fetch_pholhuay_stock_groups()
    except SourceError as error:
        reasons.append(f"ผลหวย.com stock groups: {error}")
    pages = {}
    slugs = sorted({spec[1] for spec in CATALOG_SOURCES.values() if spec[0] == "page"})
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {slug: pool.submit(fetch_pholhuay_page, slug) for slug in slugs}
        for slug, future in futures.items():
            try:
                record = future.result()
            except Exception as error:  # noqa: BLE001
                reasons.append(f"ผลหวย.com {slug}: {type(error).__name__}")
                continue
            if record:
                pages[slug] = record
    return {"tla": tla, "stocks": stocks, "pages": pages}, reasons


def resolve(catalog_id: str, sources: dict) -> tuple[dict | None, str]:
    """Return (result, reason). A None result carries the reason it is missing."""
    spec = CATALOG_SOURCES.get(catalog_id)
    if not spec:
        return None, UNSOURCED.get(catalog_id, "ไม่มีแหล่งข้อมูลที่กำหนดไว้สำหรับรายการนี้")
    kind = spec[0]
    if kind == "tla_or_stock":
        return resolve_stock_with_fallback(catalog_id, sources)
    if kind == "tla":
        record = sources["tla"].get(spec[1])
        if record is None:
            return None, f"ThaiLottoAPI ยังไม่มีผลของคีย์ {spec[1]} ในช่วงที่ตรวจ"
        return record.as_result(), ""
    if kind == "page":
        record = sources["pages"].get(spec[1])
        if record is None:
            return None, f"ผลหวย.com หน้า {spec[1]} ไม่มีบล็อกผลล่าสุดที่อ่านได้"
        return record.as_result(), ""
    group, label_regex = spec[1], spec[2]
    matches = [row for row in sources["stocks"]
               if row.extra.get("group") == group and re.search(label_regex, row.label)]
    if not matches:
        return None, f"ไม่พบการ์ดหุ้นกลุ่ม {group} ที่ตรงกับ {label_regex}"
    newest = max(matches, key=lambda row: row.draw_date)
    return newest.as_result(), ""


def resolve_stock_with_fallback(catalog_id: str, sources: dict) -> tuple[dict | None, str]:
    """Prefer ThaiLottoAPI, fall back to the ผลหวย.com stock card when it is stale."""
    spec = CATALOG_SOURCES.get(catalog_id)
    if not spec or spec[0] != "tla_or_stock":
        return resolve(catalog_id, sources)
    _, key, group, label_regex = spec
    record = sources["tla"].get(key)
    if record is not None:
        return record.as_result(), ""
    cards = [row for row in sources["stocks"]
             if row.extra.get("group") == group and re.search(label_regex, row.label)]
    if cards:
        newest = max(cards, key=lambda row: row.draw_date)
        return newest.as_result(), ""
    return None, f"ทั้ง ThaiLottoAPI ({key}) และการ์ดหุ้นผลหวย.com ไม่มีผลล่าสุด"
