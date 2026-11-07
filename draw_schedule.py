"""Bangkok calendar shared with the web catalog; never guess irregular draw dates."""
import datetime
import json
import re
from pathlib import Path
import settings_loader as sl

WEEKDAYS = json.loads((Path(__file__).parent / 'data/draw_weekdays.json').read_text())


def schedule_name(name):
    text = sl.map_canonical_lottery_name(name).lower()
    vip = bool(re.search(r'(?<!s)vip|วีไอพี', text))
    text = re.sub(r'(?<!s)vip|วีไอพี', '', text)
    for before, after in [('สตาร์', 'star'), ('นิคเคอิ', 'นิเคอิ'), ('หวยหุ้น', ''), ('หวย', ''), ('หุ้น', ''), ('รอบ', ''), ('(ไทย)', '')]:
        text = text.replace(before, after)
    return re.sub(r'[^a-z0-9ก-๙]', '', text) + ('vip' if vip else '')


def load_catalog(path='data/all_lotteries.json'):
    with open(path, encoding='utf-8') as f:
        catalog = json.load(f)
    if not isinstance(catalog, list) or not all(isinstance(x, dict) and isinstance(x.get('drawDays'), str) and isinstance(x.get('name'), str) for x in catalog):
        raise ValueError('Invalid draw calendar')
    return catalog


def scheduled_result(row, catalog, today):
    if sl._parse_draw_date(row) != today:
        return False
    name = schedule_name(row.get('ชื่อหวย') or row.get('หวย') or '')
    item = next((x for x in catalog if x.get('id') == row.get('หวย')), None)
    if item is None:
        item = next((x for x in catalog if schedule_name(x['name']) == name), None)
    if item is None:
        return False
    rule = re.sub(r'\s*-\s*', ' - ', item['drawDays'].strip())
    if rule == 'ตามประกาศวันงวดจริง (อาจเลื่อน)':
        # A complete provider result with an explicit date confirms this irregular draw.
        return all(sl.result_numbers(row)) and (item.get('id') != 'thai_gov' or bool(re.fullmatch(r'[0-9]{6}', str(row.get('รางวัลที่_1') or ''))))
    return (today.weekday() + 1) % 7 in WEEKDAYS.get(rule, [])
