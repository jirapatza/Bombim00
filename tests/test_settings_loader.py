"""
test_settings_loader.py - Unit tests for settings_loader.py
Run with: pytest tests/test_settings_loader.py
"""

import os
import json
import pytest
import settings_loader as sl


def test_load_settings_fallback():
    """Verify that loading non-existent path falls back to default dictionary."""
    cfg = sl.load("non_existent_settings.json")
    assert isinstance(cfg, dict)
    assert "sources" in cfg
    assert "ntfy" in cfg


def test_source_enabled():
    """Verify source_enabled accurately checks enabled flag."""
    sample_settings = {
        "sources": {
            "pholhuay": {"enabled": True},
            "glo": {"enabled": False}
        }
    }
    assert sl.source_enabled(sample_settings, "pholhuay") is True
    assert sl.source_enabled(sample_settings, "glo") is False
    assert sl.source_enabled(sample_settings, "non_existent") is False


def test_should_notify_rules():
    """Verify notification filtering logic."""
    settings = {
        "notifications": {
            "enabled": True,
            "notify_on_new_draw": True,
            "custom_watched_numbers": ["84", "999"]
        }
    }

    # Should notify if draw has prizes and not yet sent
    row_new = {
        "งวดวันที่": "16 ตุลาคม 2569",
        "รางวัลที่_1": "289594",
        "เลขท้าย_2_ตัว": "84",
        "สถานะการแจ้งเตือน": "pending"
    }
    assert sl.should_notify(settings, row_new) is True

    # Should NOT notify if already sent
    row_sent = dict(row_new)
    row_sent["สถานะการแจ้งเตือน"] = "sent"
    assert sl.should_notify(settings, row_sent) is False

    # Should NOT notify if notifications are disabled entirely
    disabled_settings = {"notifications": {"enabled": False}}
    assert sl.should_notify(disabled_settings, row_new) is False


def test_write_status(tmp_path):
    """Verify write_status creates valid status.json."""
    status_file = tmp_path / "status.json"
    sample_rows = [{
        "งวดวันที่": "16 ตุลาคม 2569",
        "รางวัลที่_1": "289594",
        "เลขท้าย_2_ตัว": "84"
    }]

    status = sl.write_status(sample_rows, status_path=str(status_file), source_used="glo")
    assert status["system_status"] == "healthy"
    assert status["last_source_used"] == "glo"
    assert status["latest_draw_detected"] == "16 ตุลาคม 2569"
    assert os.path.exists(status_file)

    with open(status_file, "r", encoding="utf-8") as f:
        saved = json.load(f)
        assert saved["system_status"] == "healthy"


def test_result_fingerprint_ignores_provider_and_is_stable():
    a = {"ชื่อหวย": "สลากกินแบ่งรัฐบาล", "งวดวันที่": "1 พฤศจิกายน 2569", "รางวัลที่_1": "001234", "เลขท้าย_2_ตัว": "09", "แหล่งข้อมูล": "glo"}
    b = dict(a, **{"แหล่งข้อมูล": "pholhuay"})
    assert sl.result_fingerprint(a) == sl.result_fingerprint(b)


def test_was_already_notified_only_for_same_sent_result():
    sent = {"ชื่อหวย": "สลากกินแบ่งรัฐบาล", "งวดวันที่": "1 พฤศจิกายน 2569", "รางวัลที่_1": "001234", "เลขท้าย_2_ตัว": "09", "สถานะการแจ้งเตือน": "sent"}
    assert sl.was_already_notified(dict(sent), [sent]) is True
    changed = dict(sent, **{"เลขท้าย_2_ตัว": "10"})
    assert sl.was_already_notified(changed, [sent]) is False
    pending = dict(sent, **{"สถานะการแจ้งเตือน": "pending"})
    assert sl.was_already_notified(pending, [pending]) is False


def test_should_notify_rejects_empty_rows():
    assert sl.should_notify({"notifications": {"enabled": True, "notify_on_new_draw": True}}, {}) is False


def test_write_status_counts_distinct_sources_not_result_rows(tmp_path):
    status_file = tmp_path / "status.json"
    sample_rows = [
        {"ชื่อหวย": "หุ้น A", "แหล่งข้อมูล": "ThaiLottoAPI"},
        {"ชื่อหวย": "หุ้น B", "แหล่งข้อมูล": "ThaiLottoAPI"},
        {"ชื่อหวย": "หุ้น C", "แหล่งข้อมูล": "ผลหวย.com"},
    ]

    status = sl.write_status(
        sample_rows,
        status_path=str(status_file),
        source_used="ThaiLottoAPI + ผลหวย.com",
    )
    assert status["active_sources_count"] == 2


def test_write_status_marks_missing_live_results_as_degraded(tmp_path):
    status_file = tmp_path / "status.json"
    status = sl.write_status([], status_path=str(status_file), source_used=None)
    assert status["system_status"] == "degraded"
    assert "ไม่พบผลหวยสด" in status["status_message"]
    assert status["notifications_sent_today"] == 0


def test_fetch_from_ranlotto_parses_published_result(monkeypatch):
    import lottery_checker as lc
    monkeypatch.setattr(lc, "S", {
        "sources": {"ranlotto": {"enabled": True, "url": "https://example.invalid/latest", "timeout_sec": 1}}
    })
    monkeypatch.setattr(lc, "_http_get_json", lambda *args, **kwargs: {
        "success": True,
        "data": {
            "date": "2026-10-16",
            "state": "published",
            "result": {"first_prize": "289594", "last_two": "84", "front_three": ["012", "425"], "last_three": ["318", "972"]}
        }
    })
    rows = lc.fetch_from_ranlotto()
    assert len(rows) == 1
    assert rows[0]["งวดวันที่"] == "16 ตุลาคม 2569"
    assert rows[0]["รางวัลที่_1"] == "289594"
    assert rows[0]["เลขท้าย_2_ตัว"] == "84"
    assert rows[0]["แหล่งข้อมูล"] == "ranlotto"


def test_fetch_from_ranlotto_rejects_unpublished_result(monkeypatch):
    import lottery_checker as lc
    monkeypatch.setattr(lc, "S", {"sources": {"ranlotto": {"url": "https://example.invalid/latest"}}})
    monkeypatch.setattr(lc, "_http_get_json", lambda *args, **kwargs: {
        "success": True, "data": {"date": "2026-11-01", "state": "scheduled", "result": {"first_prize": "123456", "last_two": "78"}}
    })
    assert lc.fetch_from_ranlotto() == []



def test_ntfy_notification_requires_secret_when_public_topic_is_removed(monkeypatch):
    import lottery_checker as lc

    posted = []
    monkeypatch.setattr(lc, "NTFY_TOPIC", "")
    monkeypatch.setattr(lc, "S", {
        "channels": {"ntfy": {"enabled": True, "topic": ""}},
        "ntfy": {"server": "https://ntfy.sh"}
    })
    monkeypatch.setattr(lc, "_http_post", lambda *args, **kwargs: posted.append(args) or True)

    assert lc.send_ntfy_notification({
        "ชื่อหวย": "ทดสอบ",
        "งวดวันที่": "ทดสอบ",
        "รางวัลที่_1": "123456",
        "เลขท้าย_2_ตัว": "78",
    }) is False
    assert posted == []
