import datetime

import lottery_checker as lc


def test_stock_fetch_keeps_only_published_complete_results(monkeypatch):
    monkeypatch.setattr(lc, "S", {
        "sources": {"thailottoapi": {"url": "https://example.test/api/results", "timeout_sec": 1}}
    })
    seen = {}

    def fake_get(url, **kwargs):
        seen["url"] = url
        return {
            "ok": True,
            "categories": {
                "stock": {
                    "items": [
                        {"key": "SET", "label": "หุ้นไทย", "status": "success",
                         "top3": "012", "bottom2": "07", "drawDate": "2026-10-29",
                         "drawDateDisplay": "29 ต.ค. 2569"},
                        {"key": "VIP", "label": "หุ้น VIP", "status": "pending",
                         "top3": "123", "bottom2": "45", "drawDate": "2026-10-29"},
                        {"key": "BAD", "label": "ข้อมูลไม่ครบ", "status": "success",
                         "top3": "", "bottom2": "12", "drawDate": "2026-10-29"},
                    ]
                }
            }
        }

    monkeypatch.setattr(lc, "_http_get_json", fake_get)
    rows = lc.fetch_from_thailottoapi_stock()

    assert "sync=1" in seen["url"]
    assert len(rows) == 1
    assert rows[0]["ชื่อหวย"] == "หุ้นไทย"
    assert rows[0]["เลขบน_3_ตัว"] == "012"
    assert rows[0]["เลขล่าง_2_ตัว"] == "07"
    assert rows[0]["หมวดหวย"] == "stock"


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
