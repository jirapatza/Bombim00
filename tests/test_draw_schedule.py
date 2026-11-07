import datetime
import pytest
from draw_schedule import scheduled_result, schedule_name

CATALOG = [
    {'id':'weekday', 'name':'หุ้นทดสอบ', 'drawDays':'จันทร์ - ศุกร์'},
    {'id':'weekend', 'name':'หุ้นเสาร์อาทิตย์', 'drawDays':'เสาร์ - อาทิตย์'},
    {'id':'friday', 'name':'หุ้นศุกร์', 'drawDays':'ศุกร์'},
    {'id':'us', 'name':'ดาวโจนส์', 'drawDays':'อังคาร - เสาร์'},
    {'id':'thai_gov', 'name':'สลากกินแบ่งรัฐบาล', 'drawDays':'ตามประกาศวันงวดจริง (อาจเลื่อน)'},
]

@pytest.mark.parametrize('date,expected', [
    ('2026-11-06', {'weekday','friday','us'}),
    ('2026-11-07', {'weekend','us'}),
    ('2026-11-08', {'weekend'}),
    ('2026-11-09', {'weekday'}),
])
def test_bangkok_draw_dates_are_separate(date, expected):
    today = datetime.date.fromisoformat(date)
    actual = {item['id'] for item in CATALOG if scheduled_result({'หวย':item['id'], 'งวดวันที่':date, 'top3':'123', 'bottom2':'45'}, CATALOG, today)}
    assert actual == expected


def test_yesterday_unknown_and_incomplete_irregular_never_send():
    today = datetime.date(2026,11,7)
    assert not scheduled_result({'หวย':'weekday','งวดวันที่':'2026-11-06'}, CATALOG, today)
    assert not scheduled_result({'หวย':'unknown','งวดวันที่':'2026-11-07'}, CATALOG, today)
    assert not scheduled_result({'หวย':'thai_gov','งวดวันที่':'2026-11-07','top3':'123','bottom2':'45'}, CATALOG, today)
    assert scheduled_result({'หวย':'thai_gov','งวดวันที่':'2026-11-07','รางวัลที่_1':'123456','bottom2':'45'}, CATALOG, today)


def test_provider_round_name_matches_catalog_without_losing_vip():
    assert schedule_name('หวยหุ้นนิคเคอิ VIP เช้า') == schedule_name('นิเคอิเช้า VIP')
    assert schedule_name('นิเคอิเช้า VIP') != schedule_name('นิเคอิรอบเช้า')


def test_main_never_sends_off_day_result(monkeypatch):
    import lottery_checker as lc
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    row = {'ชื่อหวย':'ไม่ทราบตาราง','งวดวันที่':today.isoformat(),'top3':'123','bottom2':'45'}
    monkeypatch.setattr(lc,'S',{'channels':{'ntfy':{'enabled':True}}})
    monkeypatch.setenv('LOTTERY_TARGET','all')
    monkeypatch.setattr(lc,'fetch_from_pholhuay_stock_groups',lambda:[row])
    monkeypatch.setattr(lc,'fetch_from_pholhuay_lao_extra',lambda:[])
    monkeypatch.setattr(lc,'fetch_missing_lotterychecks_rounds',lambda *args:[])
    monkeypatch.setattr(lc.sl,'load_previous_results',lambda:[])
    saved=[]
    monkeypatch.setattr(lc.sl,'save_results',lambda rows:saved.extend(rows))
    monkeypatch.setattr(lc.sl,'write_status',lambda *args,**kwargs:None)
    monkeypatch.setattr(lc,'send_all_notifications',lambda *args:pytest.fail('off day must not publish'))
    lc.main()
    assert saved[0]['สถานะการแจ้งเตือน']=='not_scheduled'


def test_star_aliases_preserve_round_identity():
    assert schedule_name('หวยลาวสตาร์ VIP') == schedule_name('ลาว STAR VIP')
    assert schedule_name('หวยลาวสตาร์ VIP') != schedule_name('ลาว STAR')
