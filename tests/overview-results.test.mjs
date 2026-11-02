import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, minutes, complete, rowName } from '../src/utils/overviewResults.ts';

test('normalizes actual provider dates including postponed and Buddhist calendar dates', () => {
  assert.equal(dayKey('17.11.2026'), '2026-11-17');
  assert.equal(dayKey('2/11/2569'), '2026-11-02');
  assert.equal(dayKey('2026-11-03T00:10:00+07:00'), '2026-11-03');
  assert.equal(dayKey('3 พฤศจิกายน 2569'), '2026-11-03');
  assert.equal(dayKey('ไม่ระบุ'), '');
});
test('a draw requires both published numbers, preserving real leading zeros', () => {
  assert.equal(complete({top3:'007',bottom2:'00'}), true);
  assert.equal(complete({top3:'007',bottom2:''}), false);
  assert.equal(complete({top3:'',bottom2:'00'}), false);
  assert.equal(complete({status:'announced'}), false);
});
test('schedule parsing handles midnight without fabricating missing times', () => {
  assert.equal(minutes('00:30 น.'), 30);
  assert.equal(minutes('23:55'), 1435);
  assert.equal(minutes('รอประกาศ'), null);
  assert.equal(rowName({ชื่อหวย:'ลาว VIP'}), 'ลาว VIP');
});
