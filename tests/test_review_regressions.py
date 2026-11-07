import datetime
import json
import pytest
import settings_loader as sl


def test_reject_wrong_width_in_explicit_number_fields():
    assert sl.result_numbers({'top3': '1', 'bottom2': '2345'}) == ('', '')
    assert sl.result_numbers({'top3': '007', 'bottom2': '00'}) == ('007', '00')
    assert sl.result_numbers({'รางวัลที่_1': '123456', 'เลขท้าย_2_ตัว': '09'}) == ('456', '09')


def test_history_errors_do_not_reset_dedup(tmp_path):
    path = tmp_path / 'history.json'
    assert sl.load_previous_results(str(path)) == []
    for content in ('broken', '{}', '[null]'):
        path.write_text(content)
        with pytest.raises((ValueError, json.JSONDecodeError)):
            sl.load_previous_results(str(path))


def test_atomic_write_preserves_old_history_when_replace_fails(tmp_path, monkeypatch):
    path = tmp_path / 'history.json'
    path.write_text('[{"old": true}]')
    def fail(*args):
        raise OSError('simulated storage failure')
    monkeypatch.setattr(sl.os, 'replace', fail)
    with pytest.raises(OSError):
        sl.save_results([{'new': True}], str(path))
    assert json.loads(path.read_text()) == [{'old': True}]
    assert sorted(p.name for p in tmp_path.iterdir()) == ['history.json']


def test_old_rows_do_not_claim_live_health(tmp_path):
    row = {'ชื่อหวย': 'test', 'งวดวันที่': '2020-01-01'}
    result = sl.write_status([row], str(tmp_path / 'status.json'), live_results=True)
    assert result['system_status'] == 'degraded'


def test_historical_feeds_never_publish_or_rewrite_delivery_history(monkeypatch):
    import copy
    import lottery_checker as lc
    old = {'ชื่อหวย': 'หุ้นทดสอบ', 'งวดวันที่': '2020-01-01', 'top3': '123', 'bottom2': '45', 'สถานะการแจ้งเตือน': 'sent'}
    history = [copy.deepcopy(old)]
    incoming = [dict(old, สถานะการแจ้งเตือน='pending'), dict(old, ชื่อหวย='หุ้นอีกตัว', สถานะการแจ้งเตือน='pending')]
    monkeypatch.setattr(lc, 'S', {'notifications': {'enabled': True}, 'channels': {'ntfy': {'enabled': True}}})
    monkeypatch.setenv('LOTTERY_TARGET', 'all')
    monkeypatch.setenv('FORCE_NOTIFY', 'true')
    monkeypatch.setattr(lc, 'fetch_from_pholhuay_stock_groups', lambda: incoming)
    monkeypatch.setattr(lc, 'fetch_from_pholhuay_lao_extra', lambda: [])
    monkeypatch.setattr(lc, 'fetch_missing_lotterychecks_rounds', lambda *args: [])
    monkeypatch.setattr(sl, 'load_previous_results', lambda: history)
    saved, statuses = [], []
    monkeypatch.setattr(sl, 'save_results', lambda rows: saved.extend(rows))
    monkeypatch.setattr(sl, 'write_status', lambda *args, **kwargs: statuses.append(kwargs))
    def forbidden(*args):
        pytest.fail('historical draw must not send')
    monkeypatch.setattr(lc, 'send_all_notifications', forbidden)
    lc.main()
    assert saved[0] == old
    assert saved[1]['สถานะการแจ้งเตือน'] == 'history_only'
    assert statuses[0]['live_results'] is False


def test_current_rows_remain_healthy(tmp_path):
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    row = {'ชื่อหวย': 'test', 'งวดวันที่': today.isoformat()}
    status = sl.write_status([row], str(tmp_path / 'status.json'), live_results=True)
    assert status['system_status'] == 'healthy'
