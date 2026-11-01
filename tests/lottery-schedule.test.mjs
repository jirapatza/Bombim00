import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLotteriesForDrawDate } from '../src/utils/lotterySchedule.ts';

const catalog = [
  { id: 'thai_gov', name: 'สลากกินแบ่งรัฐบาล (ไทย)', category: 'gov_savings' },
  { id: 'gsb', name: 'หวยออมสิน', category: 'gov_savings' },
  { id: 'baac', name: 'หวย ธ.ก.ส.', category: 'gov_savings' },
  { id: 'nikkei_morning', name: 'นิเคอิเช้า', category: 'foreign_stock' },
  { id: 'nikkei_vip_morning', name: 'นิเคอิเช้า VIP', category: 'vip' },
  { id: 'hanoi_normal', name: 'ฮานอยปกติ', category: 'vip' },
];

test('on Saturday (weekend): hides regular stock, keeps VIP stock and daily lotteries, hides government on non-1/16 dates', () => {
  // 2026-10-31 is Saturday, day 31
  const visible = filterLotteriesForDrawDate(catalog, new Date('2026-10-31T12:00:00+07:00'));
  assert.deepEqual(visible.map((item) => item.id), ['nikkei_vip_morning', 'hanoi_normal']);
});

test('on Sunday (weekend) day 1: shows Thai government and GSB, hides BAAC and regular stocks, keeps VIP', () => {
  // 2026-11-01 is Sunday, day 1
  const visible = filterLotteriesForDrawDate(catalog, new Date('2026-11-01T12:00:00+07:00'));
  assert.deepEqual(visible.map((item) => item.id), ['thai_gov', 'gsb', 'nikkei_vip_morning', 'hanoi_normal']);
});

test('on Monday (weekday) day 2: hides government and BAAC, shows both regular stocks and VIP stocks', () => {
  // 2026-11-02 is Monday, day 2
  const visible = filterLotteriesForDrawDate(catalog, new Date('2026-11-02T12:00:00+07:00'));
  assert.deepEqual(visible.map((item) => item.id), ['nikkei_morning', 'nikkei_vip_morning', 'hanoi_normal']);
});

test('on Monday day 16: shows all government lotteries, regular stocks, and VIP stocks', () => {
  // 2026-11-16 is Monday, day 16
  const visible = filterLotteriesForDrawDate(catalog, new Date('2026-11-16T12:00:00+07:00'));
  assert.deepEqual(visible.map((item) => item.id), [
    'thai_gov',
    'gsb',
    'baac',
    'nikkei_morning',
    'nikkei_vip_morning',
    'hanoi_normal',
  ]);
});

test('uses Bangkok calendar date at UTC date boundaries', () => {
  // 2026-10-31 17:30 UTC = 2026-11-01 00:30 Bangkok (Sunday day 1)
  const visible = filterLotteriesForDrawDate(catalog, new Date('2026-10-31T17:30:00Z'));
  assert.deepEqual(visible.map((item) => item.id), ['thai_gov', 'gsb', 'nikkei_vip_morning', 'hanoi_normal']);
});

