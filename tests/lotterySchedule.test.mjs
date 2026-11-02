import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterLotteriesForDrawDate } from '../src/utils/lotterySchedule.ts';

const items = [
  { id: 'nikkei_morning', name: 'นิเคอิรอบเช้า', category: 'foreign_stock', drawDays: 'จันทร์ - ศุกร์' },
  { id: 'dowjones', name: 'ดาวโจนส์', category: 'foreign_stock', drawDays: 'อังคาร - เสาร์' },
  { id: 'nikkei_vip_morning', name: 'นิเคอิเช้า VIP', category: 'vip', drawDays: 'ทุกวัน (จันทร์ - อาทิตย์)' },
  { id: 'hanoi_regular', name: 'ฮานอยปกติ', category: 'hanoi', drawDays: 'ทุกวัน (จันทร์ - อาทิตย์)' },
  { id: 'lao_patthana', name: 'ลาวพัฒนา', category: 'lao', drawDays: 'จันทร์, พุธ, ศุกร์' },
  { id: 'thai_gov', name: 'สลากกินแบ่งรัฐบาล (ไทย)', category: 'gov_savings', drawDays: 'วันที่ 1 และ 16' },
  { id: 'baac', name: 'หวย ธ.ก.ส.', category: 'gov_savings', drawDays: 'ทุกวันที่ 16' },
];

const bangkokDate = (isoDate) => new Date(isoDate + 'T05:00:00.000Z');

test('weekends hide weekday-only stocks but honor an explicit Saturday stock schedule', () => {
  const saturday = filterLotteriesForDrawDate(items, bangkokDate('2026-11-07')).map((item) => item.id);
  assert.deepEqual(saturday, ['dowjones', 'nikkei_vip_morning', 'hanoi_regular', 'thai_gov', 'baac']);
  const sunday = filterLotteriesForDrawDate(items, bangkokDate('2026-11-08')).map((item) => item.id);
  assert.deepEqual(sunday, ['nikkei_vip_morning', 'hanoi_regular', 'thai_gov', 'baac']);
});

test('weekdays show configured stocks and apply named weekly schedules', () => {
  const monday = filterLotteriesForDrawDate(items, bangkokDate('2026-11-02')).map((item) => item.id);
  assert.deepEqual(monday, ['nikkei_morning', 'nikkei_vip_morning', 'hanoi_regular', 'lao_patthana', 'thai_gov', 'baac']);
  const tuesday = filterLotteriesForDrawDate(items, bangkokDate('2026-11-03')).map((item) => item.id);
  assert.deepEqual(tuesday, ['nikkei_morning', 'dowjones', 'nikkei_vip_morning', 'hanoi_regular', 'thai_gov', 'baac']);
});

test('government rows are not hidden by assumed 1st and 16th dates', () => {
  const first = filterLotteriesForDrawDate(items, bangkokDate('2026-11-01')).map((item) => item.id);
  assert.deepEqual(first, ['nikkei_vip_morning', 'hanoi_regular', 'thai_gov', 'baac']);
  const sixteenth = filterLotteriesForDrawDate(items, bangkokDate('2026-11-16')).map((item) => item.id);
  assert.deepEqual(sixteenth, ['nikkei_morning', 'nikkei_vip_morning', 'hanoi_regular', 'lao_patthana', 'thai_gov', 'baac']);
  const ordinaryDay = filterLotteriesForDrawDate(items, bangkokDate('2026-11-17')).map((item) => item.id);
  assert.deepEqual(ordinaryDay, ['nikkei_morning', 'dowjones', 'nikkei_vip_morning', 'hanoi_regular', 'thai_gov', 'baac']);
});

test('real catalogue stock schedules are not overridden by a generic weekday rule', () => {
  const catalogue = JSON.parse(readFileSync(new URL('../data/all_lotteries.json', import.meta.url), 'utf8'));
  const dowjones = catalogue.find((item) => item.id === 'dowjones');
  assert.ok(dowjones, 'Dow Jones must exist in the production catalogue');
  assert.equal(dowjones.drawDays, 'อังคาร - เสาร์');

  const saturdayIds = filterLotteriesForDrawDate(catalogue, bangkokDate('2026-11-07')).map((item) => item.id);
  assert.ok(saturdayIds.includes('dowjones'), 'Saturday Dow Jones draw must remain visible');
  assert.ok(!saturdayIds.includes('nikkei_morning'), 'weekday-only Nikkei must remain hidden');
});
