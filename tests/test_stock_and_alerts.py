import base64
import datetime

import lottery_checker as lc


def test_thailottoapi_fetches_all_supported_categories_and_skips_removed_maekhong(monkeypatch):
    monkeypatch.setattr(lc, "S", {
        "sources": {"thailottoapi": {"url": "https://example.test/api/results", "timeout_sec": 1}}
    })
    seen = {}

    def fake_get(url, **kwargs):
        seen["url"] = url
        return {
            "ok": True,
            "categories": {
                "lottothaihot": {"items": [
                    {"key": "thailotto", "label": "หวยรัฐบาลไทย", "status": "success",
                     "result": "001234", "top3": "234", "bottom2": "09", "drawDate": "2026-10-30"},
                    {"key": "lpp", "label": "ลาวพัฒนาพิเศษ", "status": "success",
                     "result": "56789", "top3": "789", "bottom2": "89", "drawDate": "2026-10-30"},
                ]},
                "lottoforeign": {"items": [
                    {"key": "hanoylottospecial", "label": "หวยฮานอยพิเศษ", "status": "success",
                     "result": "82024", "top3": "024", "bottom2": "44", "drawDate": "2026-10-30"},
                    {"key": "laoslotto", "label": "หวยลาว", "status": "success",
                     "result": "12345", "top3": "345", "bottom2": "45", "drawDate": "2026-10-30"},
                    {"key": "malaylotto", "label": "หวยมาเลย์", "status": "success",
                     "result": "67890", "top3": "890", "bottom2": "90", "drawDate": "2026-10-30"},
                ]},
                "stock": {"items": [
                    {"key": "SET", "label": "หวยหุ้นไทยเย็น", "status": "success",
                     "top3": "012", "bottom2": "07", "drawDate": "2026-10-30"},
                    {"key": "NIKKEI-VIP", "label": "หวยหุ้นนิเคอิ VIP", "status": "success",
                     "top3": "123", "bottom2": "45", "drawDate": "2026-10-30"},
                    {"key": "NIKKEI", "label": "หวยหุ้นนิเคอิ", "status": "pending",
                     "top3": "456", "bottom2": "78", "drawDate": "2026-10-30"},
                ]},
                "liw": {"items": [
                    {"key": "liw#1915", "label": "หวย LIW", "status": "success",
                     "result": "13579", "drawDate": "2026-10-30"},
                ]},
                "maekhong": {"items": [
                    {"key": "mkt", "label": "แม่โขงทูเดย์", "status": "success",
                     "result": "24680", "top3": "680", "bottom2": "80", "drawDate": "2026-10-30"},
                ]},
            }
        }

    monkeypatch.setattr(lc, "_http_get_json", fake_get)
    rows = lc.fetch_from_thailottoapi_results()

    assert "sync=1" in seen["url"]
    assert len(rows) == 8
    assert {row["หมวดหวย"] for row in rows} == {
        "government", "lao", "hanoi", "malay", "thai_stock", "vip", "liw"
    }
    assert not any("แม่โขง" in row["ชื่อหวย"] for row in rows)
    assert not any(row["หวย"] == "NIKKEI" for row in rows)


def test_lottery_target_filters_the_requested_category_without_thai_fallback():
    rows = [
        {"ชื่อหวย": "หวยฮานอยพิเศษ", "หวย": "hanoylottospecial", "หมวดหวย": "hanoi"},
        {"ชื่อหวย": "หวยหุ้นนิเคอิ", "หวย": "nikkei", "หมวดหวย": "foreign_stock"},
        {"ชื่อหวย": "หวยรัฐบาลไทย", "หวย": "thailotto", "หมวดหวย": "government"},
    ]
    assert [row["หวย"] for row in lc.filter_rows_by_target(rows, "hanoi")] == ["hanoylottospecial"]
    assert [row["หวย"] for row in lc.filter_rows_by_target(rows, "foreign_stock")] == ["nikkei"]
    assert lc.filter_rows_by_target(rows, "unknown-category") == []
    assert lc.filter_rows_by_target(rows, "all") == rows


def test_non_stock_ntfy_body_uses_real_line_breaks(monkeypatch):
    sent = {}
    monkeypatch.setattr(lc, "S", {
        "ntfy": {"server": "https://ntfy.sh", "default_priority": "high", "tags": ["bell"]},
        "channels": {"ntfy": {"enabled": True, "topic": "test-topic"}},
        "message_template": {
            "title": "ผล{lottery_name} งวด {draw_date}",
            "body": "รางวัลที่ 1: {first_prize}\nเลขท้าย 2 ตัว: {last_2}"
        }
    })
    monkeypatch.setattr(lc, "_http_post", lambda url, data, headers, timeout=10: sent.update(
        url=url, body=data.decode("utf-8"), headers=headers
    ) or True)

    ok = lc.send_ntfy_notification({
        "ชื่อหวย": "สลากกินแบ่งรัฐบาล",
        "หวย": "thailotto",
        "หมวดหวย": "government",
        "งวดวันที่": "16 ตุลาคม 2569",
        "รางวัลที่_1": "001234",
        "เลขท้าย_2_ตัว": "09",
        "เลขหน้า_3_ตัว": [],
        "เลขท้าย_3_ตัว": [],
        "แหล่งข้อมูล": "test"
    })

    assert ok is True
    assert "\n" in sent["body"]
    assert "\\n" not in sent["body"]




def test_non_government_ntfy_body_uses_top3_and_bottom2_labels(monkeypatch):
    sent = {}
    monkeypatch.setattr(lc, "NTFY_TOPIC", "")
    monkeypatch.setattr(lc, "S", {
        "ntfy": {"server": "https://ntfy.sh", "default_priority": "high", "tags": ["bell"]},
        "channels": {"ntfy": {"enabled": True, "topic": "test-topic"}},
        "message_template": {"title": "ผล{lottery_name} งวด {draw_date}", "body": "ไม่ใช้แม่แบบรัฐบาล"}
    })
    monkeypatch.setattr(lc, "_http_post", lambda url, data, headers, timeout=10: sent.update(
        url=url, body=data.decode("utf-8"), headers=headers
    ) or True)

    ok = lc.send_ntfy_notification({
        "ชื่อหวย": "หวยฮานอยพิเศษ",
        "หวย": "hanoylottospecial",
        "หมวดหวย": "hanoi",
        "งวดวันที่": "31 ตุลาคม 2569",
        "รางวัลที่_1": "024",
        "เลขบน_3_ตัว": "024",
        "เลขล่าง_2_ตัว": "44",
        "เลขท้าย_2_ตัว": "44",
        "แหล่งข้อมูล": "test"
    })

    assert ok is True
    assert "3 ตัวบน: 024" in sent["body"]
    assert "2 ตัวล่าง: 44" in sent["body"]
    assert "รางวัลที่ 1:" not in sent["body"]
    assert base64.b64decode(sent["headers"]["Title"].removeprefix("base64:")).decode("utf-8") == "ผลหวยฮานอยพิเศษ งวด 31 ตุลาคม 2569"


def test_ntfy_does_not_publish_when_topic_is_missing(monkeypatch):
    monkeypatch.setattr(lc, "NTFY_TOPIC", "")
    monkeypatch.setattr(lc, "S", {
        "ntfy": {"server": "https://ntfy.sh"},
        "channels": {"ntfy": {"enabled": True, "topic": ""}}
    })
    called = []
    monkeypatch.setattr(lc, "_http_post", lambda *args, **kwargs: called.append(True) or True)

    assert lc.send_ntfy_notification({"ชื่อหวย": "ทดสอบ"}) is False
    assert called == []


def test_stock_groups_are_separated_and_faq_is_not_scraped(monkeypatch):
    html = """
    <h2>หวยหุ้นต่างประเทศ</h2>
    <article><h3>หวยหุ้นนิคเคอิเช้า</h3><p>ออก 09:30 น.</p><p>มีผลแล้ว งวด 29 ตุลาคม 2569</p><p>3 ตัวบน 128</p><p>2 ตัวล่าง 09</p></article>
    <h2>หวยหุ้น VIP</h2>
    <article><h3>หวยหุ้นนิคเคอิ VIP เช้า</h3><p>ออก 09:05 น.</p><p>มีผลแล้ว งวด 29 ตุลาคม 2569</p><p>3 ตัวบน 469</p><p>2 ตัวล่าง 63</p></article>
    <h2>หวยหุ้นพิเศษ</h2>
    <article><h3>หวยหุ้นนิคเคอิพิเศษ เช้า</h3><p>ออก 09:05 น.</p><p>มีผลแล้ว งวด 29 ตุลาคม 2569</p><p>3 ตัวบน 774</p><p>2 ตัวล่าง 32</p></article>
    <h2>หวยหุ้น VISA</h2>
    <article><h3>หวยหุ้นนิคเคอิ VISA เช้า</h3><p>ออก 09:15 น.</p><p>มีผลแล้ว งวด 29 ตุลาคม 2569</p><p>3 ตัวบน 521</p><p>2 ตัวล่าง 44</p></article>
    <h2>คำถามที่พบบ่อยเกี่ยวกับหวยหุ้น</h2>
    <h3>หวยหุ้นในหน้านี้มีกี่รายการ?</h3>
    """
    monkeypatch.setattr(lc, "_http_get_text", lambda url, timeout=15: html)
    rows = lc.fetch_from_pholhuay_stock_groups()
    assert len(rows) == 4
    assert {row["หมวดหวย"] for row in rows} == {
        "stock", "stock_vip", "stock_special", "stock_visa"
    }
    vip = next(row for row in rows if row["หมวดหวย"] == "stock_vip")
    assert vip["ชื่อหวย"] == "หวยหุ้นนิคเคอิ VIP เช้า"
    assert vip["เลขบน_3_ตัว"] == "469"
    assert vip["เลขล่าง_2_ตัว"] == "63"


def test_non_government_result_fingerprint_includes_top3_bottom2_and_category():
    base = {
        "ชื่อหวย": "หวยฮานอยพิเศษ",
        "หวย": "hanoylottospecial",
        "หมวดหวย": "hanoi",
        "งวดวันที่": "31 ตุลาคม 2569",
        "เลขบน_3_ตัว": "024",
        "เลขล่าง_2_ตัว": "44",
        "สถานะการแจ้งเตือน": "sent",
    }
    same_result = dict(base)
    corrected_result = {**base, "เลขบน_3_ตัว": "025"}
    other_category = {**base, "หมวดหวย": "stock_vip"}

    assert lc.sl.result_fingerprint(base) == lc.sl.result_fingerprint(same_result)
    assert lc.sl.was_already_notified(same_result, [base]) is True
    assert lc.sl.result_fingerprint(base) != lc.sl.result_fingerprint(corrected_result)
    assert lc.sl.result_fingerprint(base) != lc.sl.result_fingerprint(other_category)


def test_ntfy_template_error_fallback_keeps_non_government_lottery_identity(monkeypatch):
    sent = {}
    monkeypatch.setattr(lc, "NTFY_TOPIC", "")
    monkeypatch.setattr(lc, "S", {
        "channels": {"ntfy": {"enabled": True, "topic": "test-topic"}},
        "message_template": {"title": "{missing_placeholder}", "body": "invalid"}
    })
    monkeypatch.setattr(lc, "_http_post", lambda url, data, headers, timeout=10: sent.update(
        body=data.decode("utf-8")
    ) or True)

    assert lc.send_ntfy_notification({
        "ชื่อหวย": "หวยฮานอยพิเศษ",
        "หวย": "hanoylottospecial",
        "หมวดหวย": "hanoi",
        "งวดวันที่": "31 ตุลาคม 2569",
        "เลขบน_3_ตัว": "024",
        "เลขล่าง_2_ตัว": "44",
    }) is True
    assert "ผลหวยฮานอยพิเศษ" in sent["body"]
    assert "3 ตัวบน: 024" in sent["body"]
    assert "2 ตัวล่าง: 44" in sent["body"]
    assert "สลากกินแบ่งรัฐบาล" not in sent["body"]


def test_ntfy_title_uses_base64_utf8_header_for_thai_and_emoji(monkeypatch):
    sent = {}
    monkeypatch.setattr(lc, "NTFY_TOPIC", "")
    monkeypatch.setattr(lc, "S", {
        "channels": {"ntfy": {"enabled": True, "topic": "test-topic"}},
        "message_template": {"title": "📢 ผล{lottery_name} งวด {draw_date}"}
    })
    monkeypatch.setattr(lc, "_http_post", lambda url, data, headers, timeout=10: sent.update(headers=headers) or True)

    assert lc.send_ntfy_notification({
        "ชื่อหวย": "หวยฮานอยพิเศษ", "หมวดหวย": "hanoi", "งวดวันที่": "31 ตุลาคม 2569",
        "เลขบน_3_ตัว": "024", "เลขล่าง_2_ตัว": "44"
    }) is True
    encoded_title = sent["headers"]["Title"]
    assert encoded_title.startswith("base64:")
    assert base64.b64decode(encoded_title.removeprefix("base64:")).decode("utf-8") == "📢 ผลหวยฮานอยพิเศษ งวด 31 ตุลาคม 2569"
