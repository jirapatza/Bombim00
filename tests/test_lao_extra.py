import copy
import datetime
import lottery_checker as lc
import settings_loader as sl


def table(rows, heading='ผลหวยลาว Extra วันนี้'):
    return f'<h1>{heading}</h1><table><tr><th>งวดวันที่</th><th>รางวัลพิเศษ</th><th>3 ตัวบน</th><th>2 ตัวล่าง</th></tr>' + ''.join(
        '<tr>' + ''.join(f'<td>{cell}</td>' for cell in row) + '</tr>' for row in rows) + '</table>'


def test_extra_preserves_dates_zeroes_and_explicit_lower_number():
    html = table([['งวดวันที่ 2 พฤศจิกายน 2569', '00007', '007', '90'],
                  ['งวดวันที่ 1 พฤศจิกายน 2569', '19105', '105', '19']])
    rows = lc.parse_lao_extra_history(html, datetime.date(2026, 11, 3))
    assert [r['วันที่จัดรูปแบบ'] for r in rows] == ['2026-11-02', '2026-11-01']
    assert sl.result_numbers(rows[0]) == ('007', '90')
    assert rows[0]['หวย'] == 'lao_extra'
    assert sl.map_canonical_lottery_name('หวยลาว Extra') == 'ลาว EXTRA'
    assert sl.map_canonical_lottery_name('หวยลาวพัฒนา') != 'ลาว EXTRA'


def test_extra_rejects_wrong_round_missing_lower_bad_schema_and_future_dates():
    valid = ['งวดวันที่ 2 พฤศจิกายน 2569', '57925', '925', '57']
    today = datetime.date(2026, 11, 3)
    assert lc.parse_lao_extra_history(table([valid], 'ผลหวยลาวพัฒนา'), today) == []
    for row in [valid[:3] + [''], valid[:2] + ['924', '57'], ['งวดวันที่ 9 พฤศจิกายน 2569'] + valid[1:], ['ไม่ระบุ'] + valid[1:]]:
        assert lc.parse_lao_extra_history(table([row]), today) == []
    assert lc.parse_lao_extra_history(table([valid]).replace('2 ตัวล่าง', 'เลขอื่น'), today) == []


def test_extra_backfills_without_old_pushes_and_preserves_delivery_dedup(monkeypatch):
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    yesterday = today - datetime.timedelta(days=1)
    def row(date):
        return {'ชื่อหวย': 'ลาว EXTRA', 'หวย': 'lao_extra', 'หมวดหวย': 'lao',
                'งวดวันที่': date.isoformat(), 'วันที่จัดรูปแบบ': date.isoformat(),
                'รางวัลที่_1': '007', 'เลขท้าย_2_ตัว': '90'}
    monkeypatch.setattr(lc, 'S', {'channels': {'ntfy': {'enabled': True}}, 'notifications': {'enabled': True}})
    monkeypatch.setattr(lc, 'fetch_from_pholhuay_stock_groups', lambda: [])
    monkeypatch.setattr(lc, 'fetch_from_pholhuay_lao_extra', lambda: [row(today), row(yesterday)])
    monkeypatch.setenv('LOTTERY_TARGET', 'lao')
    monkeypatch.delenv('FORCE_NOTIFY', raising=False)
    history, sent = [], []
    monkeypatch.setattr(sl, 'load_previous_results', lambda: copy.deepcopy(history))
    monkeypatch.setattr(sl, 'save_results', lambda rows: history.__setitem__(slice(None), copy.deepcopy(rows)))
    monkeypatch.setattr(sl, 'write_status', lambda *args, **kwargs: None)
    monkeypatch.setattr(lc, 'send_ntfy_notification', lambda row: sent.append(row['วันที่จัดรูปแบบ']) or True)
    lc.main()
    assert sent == [today.isoformat()]
    old = next(r for r in history if r['วันที่จัดรูปแบบ'] == yesterday.isoformat())
    assert old['สถานะการแจ้งเตือน'] == 'history_only'
    lc.main()
    assert sent == [today.isoformat()]
    assert next(r for r in history if r['วันที่จัดรูปแบบ'] == yesterday.isoformat()) == old
    monkeypatch.setenv('FORCE_NOTIFY', 'true')
    lc.main()
    assert sent == [today.isoformat(), today.isoformat()]


def test_named_rounds_are_never_collapsed_just_because_their_times_match():
    assert sl.map_canonical_lottery_name('หวยลาวสามัคคี VIP เวลา 21:30') == 'หวยลาวสามัคคี VIP'
    assert sl.map_canonical_lottery_name('ลาวสตาร์ VIP') != sl.map_canonical_lottery_name('ลาว VIP')
    assert sl.map_canonical_lottery_name('ลาวพัฒนาพิเศษ') != sl.map_canonical_lottery_name('ลาวพัฒนา')
    assert sl.map_canonical_lottery_name('ฮานอยพัฒนา เวลา 19:30') == 'ฮานอยพัฒนา'
    assert sl.map_canonical_lottery_name('ฮานอยสามัคคี เวลา 17:30') == 'ฮานอยสามัคคี'
    assert sl.map_canonical_lottery_name('ฮานอยกาชาด เวลา 16:30') == 'ฮานอยกาชาด'
