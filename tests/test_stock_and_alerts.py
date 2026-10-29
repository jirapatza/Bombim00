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
            "body": "รางวัลที่ 1: {first_prize}\\nเลขท้าย 2 ตัว: {last_2}"
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
