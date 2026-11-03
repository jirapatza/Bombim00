"""Captured public responses plus synthetic edge cases; never runtime history."""
import copy
import datetime
import json
from pathlib import Path
import lottery_checker as lc
import settings_loader as sl


def test_captured_live_responses_from_github_runner():
    fixture = json.loads((Path(__file__).parent / 'fixtures/lotterychecks-2026-11-03.json').read_text())
    expected = {'lao-union': ('853', '08'), 'hanoi-develop': ('910', '09')}
    for slug, numbers in expected.items():
        row, = lc.parse_lotterychecks_round(fixture['responses'][slug], slug, datetime.date(2026, 11, 3))
        assert sl.result_numbers(row) == numbers


def envelope(slug='lao-union', date='2026-11-03'):
    return {'success': True, 'data': [{
        'lottery': slug, 'drawDate': date, 'status': 'complete', 'pendingPrizes': [],
        'prizes': [{'name': '3 ตัวบน', 'numbers': ['007']},
                   {'name': '2 ตัวล่าง', 'numbers': ['90']}],
    }]}


def test_explicit_prizes_and_round_identity_preserve_zeroes():
    today = datetime.date(2026, 11, 3)
    for slug, (key, name, category) in lc.LOTTERYCHECKS_ROUNDS.items():
        row, = lc.parse_lotterychecks_round(envelope(slug), slug, today)
        assert (row['หวย'], row['ชื่อหวย'], row['หมวดหวย']) == (key, name, category)
        assert sl.result_numbers(row) == ('007', '90')
        assert row['วันที่จัดรูปแบบ'] == today.isoformat()
        assert 'lotterychecks.com' in row['แหล่งข้อมูล']


def test_rejects_wrong_round_old_future_pending_and_malformed_prizes():
    today = datetime.date(2026, 11, 3)
    changes = [
        {'lottery': 'lao-union-vip'}, {'drawDate': '2026-11-02'},
        {'drawDate': '2026-11-04'}, {'drawDate': '2026-02-30'},
        {'status': 'announced'}, {'pendingPrizes': ['bottom']},
        {'prizes': [{'name': 'รางวัลพิเศษ', 'numbers': ['90007']}]},
        {'prizes': [{'name': '3 ตัวบน', 'numbers': [7]}, {'name': '2 ตัวล่าง', 'numbers': ['90']}]},
        {'prizes': [{'name': '3 ตัวบน', 'numbers': ['007']}, {'name': '2 ตัวล่าง', 'numbers': ['9']}]},
        {'prizes': [{'name': '3 ตัวบน', 'numbers': ['007', '008']}, {'name': '2 ตัวล่าง', 'numbers': ['90']}]},
    ]
    for change in changes:
        data = envelope()
        data['data'][0].update(change)
        assert lc.parse_lotterychecks_round(data, 'lao-union', today) == []
    for data in [None, [], {'success': False}, {'success': True, 'data': {}}, {'success': True, 'data': [None]}]:
        assert lc.parse_lotterychecks_round(data, 'lao-union', today) == []


def test_conflicting_records_are_rejected():
    data = envelope()
    other = copy.deepcopy(data['data'][0])
    other['prizes'][1]['numbers'] = ['91']
    data['data'].append(other)
    assert lc.parse_lotterychecks_round(data, 'lao-union', datetime.date(2026, 11, 3)) == []


def test_missing_round_fetches_are_independent_and_failures_do_not_erase_success(monkeypatch):
    monkeypatch.setattr(lc, 'S', {'sources': {'lotterychecks': {'enabled': True}}})
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    calls = []
    def get(url, **kwargs):
        calls.append(url)
        assert f'date={today.isoformat()}' in url
        assert kwargs['timeout'] == 10
        if 'hanoi-develop' in url:
            raise TimeoutError()
        return envelope(date=today.isoformat())
    monkeypatch.setattr(lc, '_http_get_json', get)
    unrelated = {'ชื่อหวย': 'ฮานอย VIP', 'งวดวันที่': today.isoformat(), 'top3': '123', 'bottom2': '45'}
    rows = lc.fetch_missing_lotterychecks_rounds([unrelated])
    assert [row['หวย'] for row in rows] == ['lao_samakki']
    assert len(calls) == 2
    calls.clear()
    assert lc.fetch_missing_lotterychecks_rounds(rows, 'lao') == []
    assert calls == []
    legacy_label = dict(rows[0], ชื่อหวย='ลาว VIP')
    assert lc.fetch_missing_lotterychecks_rounds([legacy_label], 'lao') == []
    assert calls == []
    for target in ['government', 'foreign_stock', 'vip', 'unknown']:
        assert lc.fetch_missing_lotterychecks_rounds([], target) == []
    monkeypatch.setattr(lc, 'S', {'sources': {'lotterychecks': {'enabled': False}}})
    assert lc.fetch_missing_lotterychecks_rounds([]) == []


def test_main_adds_missing_feed_and_never_pushes_twice(monkeypatch):
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    settings = {'sources': {'lotterychecks': {'enabled': True}},
                'channels': {'ntfy': {'enabled': True}}, 'notifications': {'enabled': True}}
    monkeypatch.setattr(lc, 'S', settings)
    monkeypatch.setenv('LOTTERY_TARGET', 'lao')
    monkeypatch.delenv('FORCE_NOTIFY', raising=False)
    monkeypatch.setattr(lc, 'fetch_from_pholhuay_stock_groups', lambda: [])
    monkeypatch.setattr(lc, 'fetch_from_pholhuay_lao_extra', lambda: [])
    monkeypatch.setattr(lc, '_http_get_json', lambda *args, **kwargs: envelope(date=today.isoformat()))
    history, sent, statuses = [], [], []
    monkeypatch.setattr(sl, 'load_previous_results', lambda: copy.deepcopy(history))
    monkeypatch.setattr(sl, 'save_results', lambda rows: history.__setitem__(slice(None), copy.deepcopy(rows)))
    monkeypatch.setattr(sl, 'write_status', lambda *args, **kwargs: statuses.append(kwargs))
    monkeypatch.setattr(lc, 'send_ntfy_notification', lambda row: sent.append(row['หวย']) or True)
    lc.main()
    lc.main()
    assert sent == ['lao_samakki']
    assert statuses[-1]['source_used'] == 'LotteryChecks Lao/Hanoi'
