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
        assert row['แหล่งข้อมูล'] == 'LotteryChecks (https://lotterychecks.com)'


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
    monkeypatch.setattr(lc, 'LOTTERYCHECKS_ROUNDS', {k: lc.LOTTERYCHECKS_ROUNDS[k] for k in ('lao-union', 'hanoi-develop')})
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
    monkeypatch.setattr(lc, 'LOTTERYCHECKS_ROUNDS', {k: lc.LOTTERYCHECKS_ROUNDS[k] for k in ('lao-union', 'hanoi-develop')})
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


def test_main_retries_unsent_draw_without_refetching_it(monkeypatch):
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    result = {'ชื่อหวย': 'ลาวสามัคคี', 'หวย': 'lao_samakki', 'หมวดหวย': 'lao',
              'งวดวันที่': today.isoformat(), 'เลขบน_3_ตัว': '007', 'เลขล่าง_2_ตัว': '90'}
    history = [dict(result, สถานะการแจ้งเตือน='failed', notification_channels={'ntfy': 'failed'})]
    attempts, status = [], []
    monkeypatch.setenv('LOTTERY_TARGET', 'lao')
    monkeypatch.setattr(lc, 'S', {'channels': {'ntfy': {'enabled': True}}})
    monkeypatch.setattr(lc, 'fetch_from_pholhuay_stock_groups', lambda: [])
    monkeypatch.setattr(lc, 'fetch_from_pholhuay_lao_extra', lambda: [])
    monkeypatch.setattr(sl, 'load_previous_results', lambda: copy.deepcopy(history))
    monkeypatch.setattr(sl, 'save_results', lambda rows: history.__setitem__(slice(None), copy.deepcopy(rows)))
    monkeypatch.setattr(sl, 'write_status', lambda *args, **kwargs: status.append(kwargs))
    monkeypatch.setattr(lc, 'send_ntfy_notification', lambda row: attempts.append(row['หวย']) or True)

    lc.main()
    assert attempts == ['lao_samakki']
    assert history[0]['notification_channels'] == {'ntfy': 'sent'}
    assert status[-1]['live_results'] is False
    lc.main()
    assert attempts == ['lao_samakki']


def test_new_rounds_require_today_matching_complete_explicit_prizes_and_calendar():
    from draw_schedule import load_catalog, scheduled_result
    today = datetime.date(2026, 11, 7)
    catalog = load_catalog()
    for slug in ('hanoi-asean', 'lao-tv', 'hanoi-hd', 'hanoi-star', 'lao-hd', 'hanoi-tv', 'lao-star'):
        data = envelope(slug, today.isoformat())
        row, = lc.parse_lotterychecks_round(data, slug, today)
        assert scheduled_result(row, catalog, today)
        assert sl.result_numbers(row) == ('007', '90')
        data['data'][0]['drawDate'] = '2026-11-06'
        assert lc.parse_lotterychecks_round(data, slug, today) == []
        data['data'][0]['drawDate'] = today.isoformat()
        data['data'][0]['pendingPrizes'] = ['2 ตัวล่าง']
        assert lc.parse_lotterychecks_round(data, slug, today) == []


def test_aliases_of_new_rounds_do_not_refetch_or_duplicate_notification(monkeypatch):
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    monkeypatch.setattr(lc, 'S', {'sources': {'lotterychecks': {'enabled': True}}})
    monkeypatch.setattr(lc, 'LOTTERYCHECKS_ROUNDS', {k: lc.LOTTERYCHECKS_ROUNDS[k] for k in ('lao-tv', 'lao-hd')})
    calls = []
    monkeypatch.setattr(lc, '_http_get_json', lambda url, **kwargs: calls.append(url) or {})
    rows = [{'ชื่อหวย': 'หวยลาวทีวี', 'งวดวันที่': today.isoformat(), 'เลขบน_3_ตัว': '007', 'เลขล่าง_2_ตัว': '90', 'หมวดหวย': 'lao', 'สถานะการแจ้งเตือน': 'sent'},
            {'ชื่อหวย': 'หวยลาว HD', 'งวดวันที่': today.isoformat(), 'เลขบน_3_ตัว': '007', 'เลขล่าง_2_ตัว': '90', 'หมวดหวย': 'lao'}]
    assert lc.fetch_missing_lotterychecks_rounds(rows, 'lao') == []
    assert calls == []
    fresh, = lc.parse_lotterychecks_round(envelope('lao-tv', today.isoformat()), 'lao-tv', today)
    assert sl.was_already_notified(fresh, rows)
    assert sl.previous_notification_channels(fresh, rows, ['ntfy']) == {'ntfy': 'sent'}
    assert sl.normalize_lottery_name('หวยลาวทีวี VIP') != sl.normalize_lottery_name('ลาว TV')
    assert sl.normalize_lottery_name('หวยลาว HD VIP') != sl.normalize_lottery_name('ลาว HD')
    assert sl.normalize_lottery_name('หวยฮานอยสตาร์ VIP') != sl.normalize_lottery_name('ฮานอย STAR')
    from draw_schedule import schedule_name
    assert schedule_name('หวยฮานอยทีวี VIP') != schedule_name('ฮานอย TV')


def test_added_rounds_deliver_only_once_and_keep_history(monkeypatch):
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    rounds = {k: lc.LOTTERYCHECKS_ROUNDS[k] for k in ('hanoi-asean', 'lao-tv')}
    monkeypatch.setattr(lc, 'LOTTERYCHECKS_ROUNDS', rounds)
    monkeypatch.setattr(lc, 'S', {'sources': {'lotterychecks': {'enabled': True}},
                                  'channels': {'ntfy': {'enabled': True}},
                                  'notifications': {'enabled': True}})
    monkeypatch.setenv('LOTTERY_TARGET', 'all')
    monkeypatch.delenv('FORCE_NOTIFY', raising=False)
    monkeypatch.setattr(lc, 'fetch_from_pholhuay_stock_groups', lambda: [])
    monkeypatch.setattr(lc, 'fetch_from_pholhuay_lao_extra', lambda: [])
    def read_source(url, **kwargs):
        slug = next(slug for slug in rounds if f'lottery={slug}&' in url)
        return envelope(slug, today.isoformat())
    monkeypatch.setattr(lc, '_http_get_json', read_source)
    history, sent = [], []
    monkeypatch.setattr(sl, 'load_previous_results', lambda: copy.deepcopy(history))
    monkeypatch.setattr(sl, 'save_results', lambda rows: history.__setitem__(slice(None), copy.deepcopy(rows)))
    monkeypatch.setattr(sl, 'write_status', lambda *args, **kwargs: None)
    monkeypatch.setattr(lc, 'send_ntfy_notification', lambda row: sent.append(row['หวย']) or True)
    lc.main()
    lc.main()
    assert sorted(sent) == ['hanoi_asean', 'lao_tv']
    assert {r['หวย'] for r in history} == {'hanoi_asean', 'lao_tv'}
    assert all(r['notification_channels']['ntfy'] == 'sent' for r in history)
