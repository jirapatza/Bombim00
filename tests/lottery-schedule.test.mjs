import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLotteriesForDrawDate } from '../src/utils/lotterySchedule.ts';

const catalog = [
  { id: 'thai_gov', name: 'สลากกินแบ่งรัฐบาล (ไทย)', category: 'gov_savings' },
  { id: 'gsb', name: 'หวยออมสิน', category: 'gov_savings' },
  { id: 'baac', name: 'หวย ธ.ก.ส.', category: 'gov_savings' },
  { id: 'nikkei_morning', name: 'นิเคอิเช้า', category: 'foreign_stock' },
];

test('hides government, GSB and BAAC on non-draw dates but keeps daily lotteries', () => {
  const visible = filterLotteriesForDrawDate(catalog, new Date('2026-10-31T12:00:00+07:00'));
  assert.deepEqual(visible.map((item) => item.id), ['nikkei_morning']);
});

test('shows Thai government and GSB, but not BAAC, on day 1', () => {
  const visible = filterLotteriesForDrawDate(catalog, new Date('2026-11-01T12:00:00+07:00'));
  assert.deepEqual(visible.map((item) => item.id), ['thai_gov', 'gsb', 'nikkei_morning']);
});

test('shows all three government lotteries on day 16', () => {
  const visible = filterLotteriesForDrawDate(catalog, new Date('2026-11-16T12:00:00+07:00'));
  assert.deepEqual(visible.map((item) => item.id), ['thai_gov', 'gsb', 'baac', 'nikkei_morning']);
});

test('uses Bangkok calendar date at UTC date boundaries', () => {
  const visible = filterLotteriesForDrawDate(catalog, new Date('2026-10-31T17:30:00Z'));
  assert.deepEqual(visible.map((item) => item.id), ['thai_gov', 'gsb', 'nikkei_morning']);
});
