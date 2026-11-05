import datetime
import json

import pytest

import lottery_checker as lc
import settings_loader as sl


@pytest.mark.parametrize("display,iso", [
    ("2 พฤศจิกายน 2569", "2026-11-02"),
    ("17 พฤศจิกายน 2569", "2026-11-17"),
    ("30.12.2569", "2026-12-30"),
])
def test_actual_draw_date_overrides_legacy_fetch_date(display, iso):
    row = {"งวดวันที่": display, "วันที่จัดรูปแบบ": "2026-11-01"}
    assert sl._parse_draw_date(row).isoformat() == iso


@pytest.mark.parametrize("first,bottom,expected", [
    ("123782", "57", ("782", "57")),
    ("000007", "00", ("007", "00")),
    ("000000", "00", ("000", "00")),
    (None, None, ("", "")),
    ("---", "--", ("", "")),
])
def test_only_real_three_and_two_digit_values(first, bottom, expected):
    assert sl.result_numbers({"รางวัลที่_1": first, "เลขท้าย_2_ตัว": bottom}) == expected


def test_glo_preserves_shifted_draw_date_and_never_invents_missing_prizes(monkeypatch):
    monkeypatch.setattr(lc, "_http_get_json", lambda *a, **kw: {
        "date": "17 พฤศจิกายน 2569", "firstPrize": "123782", "last2": "57",
    })
    row = lc.fetch_from_glo()[0]
    assert row["วันที่จัดรูปแบบ"] == "2026-11-17"
    assert sl.result_numbers(row) == ("782", "57")
    assert row["เลขหน้า_3_ตัว"] == []
    assert row["เลขท้าย_3_ตัว"] == []


@pytest.mark.parametrize("data", [
    {"date": "2026-11-17", "firstPrize": "123782"},
    {"firstPrize": "123782", "last2": "57"},
])
def test_glo_rejects_missing_lower_result_or_unknown_date(monkeypatch, data):
    monkeypatch.setattr(lc, "_http_get_json", lambda *a, **kw: data)
    assert lc.fetch_from_glo() == []


def test_government_ntfy_only_announce_upper_three_lower_two(monkeypatch):
    monkeypatch.setattr(lc, "S", {"channels": {
        "ntfy": {"enabled": True, "topic": "local-test"},
    }})
    monkeypatch.setattr(lc, "NTFY_TOPIC", "")
    posted = []
    monkeypatch.setattr(lc, "_http_post", lambda url, data, **kw: posted.append(json.loads(data)) or True)
    row = {"ชื่อหวย": "สลากกินแบ่งรัฐบาล", "หมวดหวย": "government",
           "งวดวันที่": "17 พฤศจิกายน 2569", "รางวัลที่_1": "123782", "เลขท้าย_2_ตัว": "57"}
    assert lc.send_ntfy_notification(row)
    for body in [posted[0]["message"]]:
        assert "782 - 57" in body
        assert "123782" not in body
        assert "รางวัลที่ 1" not in body
        assert "เลขหน้า" not in body


@pytest.mark.parametrize("state", ["failed", "partial"])
def test_status_exposes_failed_notification_deliveries(tmp_path, state):
    status = sl.write_status([{"งวดวันที่": "2026-11-17", "สถานะการแจ้งเตือน": state}],
                             status_path=str(tmp_path / "status.json"), notifications_sent=0)
    assert status["system_status"] == "degraded"
    assert status["notification_failures"] == 1
    assert status["recent_logs"][0]["level"] == "WARNING"


def test_error_status_with_result_rows_does_not_crash(tmp_path):
    status = sl.write_status([{"งวดวันที่": "2026-11-17"}],
                             status_path=str(tmp_path / "status.json"), error="delivery error")
    assert status["system_status"] == "error"


def test_disabled_match_notifications_and_prize_switches_are_honored():
    row = {"top3": "782", "bottom2": "57"}
    config = {"notifications": {"notify_on_new_draw": False, "notify_on_prize_match": False,
                                "custom_watched_numbers": ["782", "57"]}}
    assert not sl.should_notify(config, row)
    config["notifications"]["notify_on_prize_match"] = True
    assert sl.should_notify(config, row)
    config["notifications"]["notify_prizes"] = {"top3": False, "bottom2": False}
    assert not sl.should_notify(config, row)
    config["notifications"]["notify_prizes"] = {"top3": True, "bottom2": True}
    config["notifications"]["custom_watched_numbers"] = ["82"]
    assert not sl.should_notify(config, row)  # An upper substring is not a lower-two result.


def test_checker_retries_failed_ntfy_delivery_and_does_not_repeat_successes(monkeypatch):
    import copy
    settings = {"sources": {"thailottoapi": {"enabled": True}},
                "channels": {"ntfy": {"enabled": True}, "line": {"enabled": True}},
                "notifications": {"enabled": True, "notify_on_new_draw": True}}
    monkeypatch.setattr(lc, "S", settings)
    row = {"ชื่อหวย": "สลากกินแบ่งรัฐบาล", "หมวดหวย": "government", "งวดวันที่": "2026-11-17",
           "รางวัลที่_1": "123782", "เลขท้าย_2_ตัว": "57", "สถานะการแจ้งเตือน": "pending"}
    monkeypatch.setattr(lc, "fetch_from_thailottoapi_results", lambda: [copy.deepcopy(row)])
    monkeypatch.setattr(lc, "fetch_from_pholhuay_stock_groups", lambda: [])
    monkeypatch.setattr(lc, "fetch_from_pholhuay_lao_extra", lambda: [])
    history, summaries, calls = [], [], []
    monkeypatch.setattr(sl, "load_previous_results", lambda: copy.deepcopy(history))
    monkeypatch.setattr(sl, "save_results", lambda rows: history.__setitem__(slice(None), copy.deepcopy(rows)))
    monkeypatch.setattr(sl, "write_status", lambda rows, **kw: summaries.append(copy.deepcopy(rows)))
    ntfy_ready = [False]
    monkeypatch.setattr(lc, "send_ntfy_notification", lambda row: calls.append("ntfy") or ntfy_ready[0])
    monkeypatch.setenv("LOTTERY_TARGET", "all")
    monkeypatch.delenv("FORCE_NOTIFY", raising=False)
    lc.main()
    assert history[0]["สถานะการแจ้งเตือน"] == "failed"
    ntfy_ready[0] = True
    lc.main()
    assert history[0]["สถานะการแจ้งเตือน"] == "sent"
    lc.main()
    assert calls == ["ntfy", "ntfy"]
    assert len(history) == 1
    monkeypatch.setenv("FORCE_NOTIFY", "true")
    lc.main()
    assert calls == ["ntfy", "ntfy", "ntfy"]
    # Temporarily disabling alerts must not erase the delivery history.
    monkeypatch.delenv("FORCE_NOTIFY", raising=False)
    settings["notifications"]["enabled"] = False
    lc.main()
    settings["notifications"]["enabled"] = True
    lc.main()
    assert calls == ["ntfy", "ntfy", "ntfy"]
    settings["channels"]["ntfy"]["enabled"] = False
    lc.main()
    settings["channels"]["ntfy"]["enabled"] = True
    lc.main()
    assert calls == ["ntfy", "ntfy", "ntfy"]
