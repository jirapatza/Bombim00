import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLotteriesForDrawDate } from '../src/utils/lotterySchedule.ts';

const items = [
  { id: 'nikkei_morning', name: 'นิเคอิรอบเช้า', category: 'foreign_stock', drawDays: 'จันทร์ - ศุกร์' },
  { id: 'nikkei_vip_morning', name: 'นิเคอิเช้า VIP', category: 'vip', drawDays: 'ทุกวัน (จันทร์ - อาทิตย์)' },
  { id: 'hanoi_regular', name: 'ฮานอยปกติ', category: 'hanoi', drawDays: 'ทุกวัน (จันทร์ - อาทิตย์)' },
  { id: 'lao_patthana', name: 'ลาวพัฒนา', category: 'lao', drawDays: 'จันทร์, พุธ, ศุกร์' },
  { id: 'thai_gov', name: 'สลากกินแบ่งรัฐบาล (ไทย)', category: 'gov_savings', drawDays: 'วันที่ 1 และ 16' },
  { id: 'baac', name: 'หวย ธ.ก.ส.', category: 'gov_savings', drawDays: 'ทุกวันที่ 16' },
];

const bangkokDate = (isoDate) => new Date(isoDate + 'T05:00:00.000Z');

test('weekends hide regular stocks but keep VIP and daily lotteries', () => {
  const saturday = filterLotteriesForDrawDate(items, bangkokDate('2026-11-07')).map((item) => item.id);
  assert.deepEqual(saturday, ['nikkei_vip_morning', 'hanoi_regular']);
  const sunday = filterLotteriesForDrawDate(items, bangkokDate('2026-11-08')).map((item) => item.id);
  assert.deepEqual(sunday, ['nikkei_vip_morning', 'hanoi_regular']);
});

test('weekdays show regular stocks and apply named weekly schedules', () => {
  const monday = filterLotteriesForDrawDate(items, bangkokDate('2026-11-02')).map((item) => item.id);
  assert.deepEqual(monday, ['nikkei_morning', 'nikkei_vip_morning', 'hanoi_regular', 'lao_patthana']);
  const tuesday = filterLotteriesForDrawDate(items, bangkokDate('2026-11-03')).map((item) => item.id);
  assert.deepEqual(tuesday, ['nikkei_morning', 'nikkei_vip_morning', 'hanoi_regular']);
});

test('government rows only appear on their scheduled calendar dates', () => {
  const first = filterLotteriesForDrawDate(items, bangkokDate('2026-11-01')).map((item) => item.id);
  assert.deepEqual(first, ['nikkei_vip_morning', 'hanoi_regular', 'thai_gov']);
  const sixteenth = filterLotteriesForDrawDate(items, bangkokDate('2026-11-16')).map((item) => item.id);
  assert.deepEqual(sixteenth, ['nikkei_morning', 'nikkei_vip_morning', 'hanoi_regular', 'lao_patthana', 'thai_gov', 'baac']);
  const ordinaryDay = filterLotteriesForDrawDate(items, bangkokDate('2026-11-17')).map((item) => item.id);
  assert.deepEqual(ordinaryDay, ['nikkei_morning', 'nikkei_vip_morning', 'hanoi_regular']);
});
