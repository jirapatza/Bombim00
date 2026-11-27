import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withCanonicalName, mergeRows, scheduleName } from '../src/domain.js';

const catalog = [
  { id: 'china_morning', name: 'จีนเช้า', drawDays: 'ทุกวัน', closeTimeStr: '09:30 น.', drawTimeStr: '09:45 น.' },
  { id: 'nikkei_morning', name: 'นิเคอิเช้า', drawDays: 'ทุกวัน', closeTimeStr: '10:00 น.', drawTimeStr: '10:15 น.' },
];
const draw = (label, date = '2026-11-26', id) => ({ หวย: id ?? label, ชื่อหวย: label, งวดวันที่: date,
  วันที่จัดรูปแบบ: date, เลขบน_3_ตัว: '123', เลขล่าง_2_ตัว: '45' });

test('a legacy provider label is rewritten to the catalogue name', () => {
  const fixed = withCanonicalName(draw('หวยหุ้นจีนเช้า'), catalog);
  assert.equal(fixed.ชื่อหวย, 'จีนเช้า');
  assert.equal(fixed.หวย, 'จีนเช้า');
});

test('a stored id is left alone, only the display name changes', () => {
  const fixed = withCanonicalName(draw('หวยหุ้นนิคเคอิเช้า', '2026-11-26', 'nikkei_morning'), catalog);
  assert.equal(fixed.ชื่อหวย, 'นิเคอิเช้า');
  assert.equal(fixed.หวย, 'nikkei_morning');
});

test('an unknown lottery keeps its label', () => {
  const row = draw('หวยอะไรสักอย่าง');
  assert.equal(withCanonicalName(row, catalog), row);
});

test('rows that already carry the catalogue name are returned untouched', () => {
  const row = draw('จีนเช้า', '2026-11-26', 'china_morning');
  assert.equal(withCanonicalName(row, catalog), row);
});

test('one lottery stored under three labels merges into one name in the archive', () => {
  const history = [
    draw('หวยหุ้นจีนเช้า', '2026-11-24'),
    draw('จีนรอบเช้า', '2026-11-25'),
    draw('จีนเช้า', '2026-11-26'),
  ];
  const merged = mergeRows([], history, catalog);
  assert.deepEqual(merged.map(row => row.ชื่อหวย), ['จีนเช้า', 'จีนเช้า', 'จีนเช้า']);
  assert.deepEqual(merged.map(row => row.งวดวันที่), ['2026-11-24', '2026-11-25', '2026-11-26']);
});

test('the same draw arriving under two labels is stored once', () => {
  const merged = mergeRows([draw('หวยหุ้นจีนเช้า')], [draw('จีนเช้า')], catalog);
  assert.equal(merged.length, 1);
});

const live = JSON.parse(readFileSync(new URL('../../data/all_lotteries.json', import.meta.url)));
const label = name => ({ หวย: name, ชื่อหวย: name, งวดวันที่: '2026-11-26', วันที่จัดรูปแบบ: '2026-11-26',
  เลขบน_3_ตัว: '123', เลขล่าง_2_ตัว: '45' });

test('VISA and a stock พิเศษ round are the catalogue VIP round', () => {
  assert.equal(scheduleName('หวยหุ้นอังกฤษ VISA'), scheduleName('อังกฤษ VIP'));
  assert.equal(scheduleName('หวยหุ้นรัสเซียพิเศษ'), scheduleName('รัสเซีย VIP'));
  assert.equal(scheduleName('หวยหุ้นนิคเคอิ VISA เช้า'), scheduleName('นิเคอิเช้า VIP'));
  assert.equal(scheduleName('หวยหุ้นจีนพิเศษ บ่าย'), scheduleName('จีนบ่าย VIP'));
});

test('ฮานอยพิเศษ stays its own lottery and is not read as a VIP round', () => {
  assert.notEqual(scheduleName('ฮานอยพิเศษ'), scheduleName('ฮานอย VIP'));
  assert.equal(withCanonicalName(label('ฮานอยพิเศษ'), live).ชื่อหวย, 'ฮานอยพิเศษ');
});

test('the live catalogue relabels every provider VIP spelling', () => {
  const cases = {
    'หวยหุ้นอังกฤษ VISA': 'อังกฤษ VIP',
    'หวยหุ้นเยอรมัน VISA': 'เยอรมัน VIP',
    'หวยหุ้นรัสเซียพิเศษ': 'รัสเซีย VIP',
    'หวยหุ้นไต้หวันพิเศษ': 'ไต้หวัน VIP',
    'หวยหุ้นเกาหลีพิเศษ': 'เกาหลี VIP',
    'หวยหุ้นฮั่งเส็ง VISA เช้า': 'ฮั่งเส็งเช้า VIP',
  };
  for (const [stored, expected] of Object.entries(cases)) {
    assert.equal(withCanonicalName(label(stored), live).ชื่อหวย, expected, stored);
  }
});

test('a lottery the catalogue does not list keeps its provider label', () => {
  assert.equal(withCanonicalName(label('หวยมาเลย์'), live).ชื่อหวย, 'หวยมาเลย์');
});
