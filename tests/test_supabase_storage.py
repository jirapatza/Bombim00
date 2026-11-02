import json
import supabase_storage as ss


def test_checker_mode_is_explicit_opt_in(monkeypatch):
    monkeypatch.delenv("SUPABASE_CHECKER_ENABLED", raising=False)
    assert ss.enabled() is False
    monkeypatch.setenv("SUPABASE_CHECKER_ENABLED", "true")
    assert ss.enabled() is True


def test_secret_key_configuration_requires_https_and_never_bearer(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://project.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_test")
    try:
        ss._config()
        assert False, "expected invalid URL"
    except ss.SupabaseStorageError as exc:
        assert "HTTPS" in str(exc)

    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    assert ss._config() == ("https://project.supabase.co", "sb_secret_test")


def test_claim_and_complete_use_atomic_rpc(monkeypatch):
    calls = []
    def fake_request(path, method="GET", body=None, prefer=None):
        calls.append((path, method, body, prefer))
        return True

    monkeypatch.setattr(ss, "_request", fake_request)
    assert ss.claim_notification("fingerprint", "ntfy", {"lottery": "ฮานอย"})
    assert ss.complete_notification("fingerprint", "ntfy", True, "provider-id")
    assert calls[0][0] == "rpc/claim_bombim00_notification"
    assert calls[0][2]["p_fingerprint"] == "fingerprint"
    assert calls[0][2]["p_force"] is False
    assert calls[1][0] == "rpc/complete_bombim00_notification"
    assert calls[1][2]["p_success"] is True
    assert calls[1][2]["p_provider_reference"] == "provider-id"
    assert ss.claim_notification("fingerprint", "ntfy", {}, force=True)
    assert calls[2][2]["p_force"] is True


def test_save_results_uses_canonical_fingerprint_and_preserves_payload(monkeypatch):
    calls = []
    monkeypatch.setattr(ss, "_request", lambda *args, **kwargs: calls.append((args, kwargs)))
    row = {
        "ชื่อหวย": "ฮานอย VIP",
        "งวดวันที่": "2 พฤศจิกายน 2569",
        "เลขบน_3_ตัว": "123",
        "เลขล่าง_2_ตัว": "45",
        "สถานะการแจ้งเตือน": "sent",
        "provider_extra": {"keep": True},
    }
    ss.save_results([row])
    args, kwargs = calls[0]
    assert args[0] == "lottery_results?on_conflict=fingerprint"
    records = args[2]
    assert len(records) == 1
    assert records[0]["fingerprint"]
    assert records[0]["payload"] == row
    assert records[0]["payload"]["provider_extra"] == {"keep": True}


def test_load_results_validates_postgrest_shape(monkeypatch):
    monkeypatch.setattr(ss, "_request", lambda *args, **kwargs: [{"payload": {"id": 1}}])
    assert ss.load_results() == [{"id": 1}]

    monkeypatch.setattr(ss, "_request", lambda *args, **kwargs: [{"bad": True}])
    try:
        ss.load_results()
        assert False, "expected invalid response"
    except ss.SupabaseStorageError:
        pass


def test_settings_loader_uses_supabase_only_when_flag_enabled(monkeypatch):
    import settings_loader as sl
    monkeypatch.setenv("SUPABASE_CHECKER_ENABLED", "true")
    monkeypatch.setattr(ss, "load_settings", lambda: {"source": "supabase"})
    assert sl.load() == {"source": "supabase"}


def test_results_are_written_to_supabase_and_github_json_mirror(monkeypatch, tmp_path):
    import settings_loader as sl
    calls = []
    monkeypatch.setenv("SUPABASE_CHECKER_ENABLED", "true")
    monkeypatch.setattr(ss, "save_results", lambda rows: calls.append(rows))
    target = tmp_path / "results.json"
    rows = [{"ชื่อหวย": "ฮานอย VIP", "สถานะการแจ้งเตือน": "sent"}]
    sl.save_results(rows, str(target))
    assert calls == [rows]
    assert json.loads(target.read_text(encoding="utf-8")) == rows


def test_status_is_written_to_supabase_and_github_json_mirror(monkeypatch, tmp_path):
    import settings_loader as sl
    calls = []
    monkeypatch.setenv("SUPABASE_CHECKER_ENABLED", "true")
    monkeypatch.setattr(ss, "load_status", lambda: {"total_checks": 4, "recent_logs": []})
    monkeypatch.setattr(ss, "save_singleton", lambda table, payload: calls.append((table, payload)))
    target = tmp_path / "status.json"
    result = sl.write_status([], status_path=str(target), source_used="test")
    assert calls and calls[0][0] == "system_status"
    assert calls[0][1] == result
    assert json.loads(target.read_text(encoding="utf-8")) == result
    assert result["total_checks"] == 5


def test_load_results_paginates_past_postgrest_default_limit(monkeypatch):
    calls = []
    def fake_request(path, *args, **kwargs):
        calls.append(path)
        if "offset=0" in path:
            return [{"payload": {"id": i}} for i in range(1000)]
        return [{"payload": {"id": 1000}}, {"payload": {"id": 1001}}]
    monkeypatch.setattr(ss, "_request", fake_request)
    rows = ss.load_results()
    assert len(rows) == 1002
    assert calls[0].endswith("offset=0&order=created_at.desc")
    assert calls[1].endswith("offset=1000&order=created_at.desc")
