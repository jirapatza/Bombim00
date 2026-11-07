"""Run the JS port against the unchanged Python contract and original catalog."""
import datetime
import json
from pathlib import Path
import subprocess

import draw_schedule as ds
import settings_loader as sl


def test_cloudflare_matches_existing_python_contract():
    root = Path(__file__).resolve().parents[1]
    catalog = ds.load_catalog()
    names = [x['name'] for x in catalog] + [
        'หวยลาวทีวี', 'หวยลาว HD VIP', 'หวยฮานอยสตาร์ VIP', 'ฮานอย 18:30',
        'หวยลาวพัฒนาเช้า', 'หวยรัฐบาลไทย', 'หวย ธ.ก.ส.', 'นิคเคอิรอบเช้า',
    ]
    dates = ['2026-11-07', '7 พฤศจิกายน 2569', '07/11/2569', '07.11.2026', '1/11/2026',
             '2026-02-30', '2026-11-06', '2026-11-08']
    today = datetime.date(2026, 11, 7)
    cases, expected = [], []
    for i, name in enumerate(names):
        for j, date in enumerate(dates):
            row = {'ชื่อหวย': name, 'งวดวันที่': date, 'เลขบน_3_ตัว': '007', 'เลขล่าง_2_ตัว': '90',
                   'หมวดหวย': ['lao', 'stock_vip', '', 'stock_special'][j % 4]}
            if j % 3 == 0:
                row['รางวัลที่_1'] = '900007'
            if j == 4:
                row.pop('เลขบน_3_ตัว')
                row['firstPrize'] = '900007'
            history = [dict(row, สถานะการแจ้งเตือน='sent')]
            settings = {'notifications': {'enabled': i % 4 != 0, 'notify_on_new_draw': j % 2 == 0,
                                         'custom_watched_numbers': ['007', '90']}}
            cases.append(dict(name=name, row=row, history=history, settings=settings,
                              catalog=catalog, today=today.isoformat()))
            expected.append(dict(canonical=sl.map_canonical_lottery_name(name), normalize=sl.normalize_lottery_name(name),
                                 scheduleName=ds.schedule_name(name),
                                 date='' if sl._parse_draw_date(row) == datetime.date.min else sl._parse_draw_date(row).isoformat(),
                                 numbers=list(sl.result_numbers(row)), fingerprint=sl.result_fingerprint(row),
                                 scheduled=ds.scheduled_result(row, catalog, today),
                                 channels=sl.previous_notification_channels(row, history, ['ntfy']), eligible=sl.should_notify(settings, row)))
    completed = subprocess.run(['node', 'cloudflare/tests/contract-probe.js'], cwd=root,
                               input=json.dumps(cases, ensure_ascii=False), capture_output=True, text=True, check=True)
    actual = json.loads(completed.stdout)
    for case, original, ported in zip(cases, expected, actual, strict=True):
        assert original == ported, (case['name'], case['row'], original, ported)
