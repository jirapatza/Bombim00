import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withCanonicalName, mergeRows, scheduleName, providerProductName } from '../src/domain.js';

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
const label = (name, category) => ({ หวย: name, ชื่อหวย: name, หมวดหวย: category, งวดวันที่: '2026-11-26',
  วันที่จัดรูปแบบ: '2026-11-26', เลขบน_3_ตัว: '123', เลขล่าง_2_ตัว: '45' });

test('a stock VISA or พิเศษ round is a different product from the catalogue VIP round', () => {
  assert.notEqual(scheduleName('หวยหุ้นอังกฤษ VISA'), scheduleName('อังกฤษ VIP'));
  assert.notEqual(scheduleName('หวยหุ้นรัสเซียพิเศษ'), scheduleName('รัสเซีย VIP'));
});

test('a provider-only product is labelled by market, product and round', () => {
  assert.equal(providerProductName(label('หวยหุ้นอังกฤษ VISA', 'stock_visa')), 'หวยหุ้นอังกฤษ VISA');
  assert.equal(providerProductName(label('หวยหุ้นรัสเซียพิเศษ', 'stock_special')), 'หวยหุ้นรัสเซียพิเศษ');
  assert.equal(providerProductName(label('นิเคอิเช้า VIP', 'stock_visa')), 'หวยหุ้นนิเคอิ VISA เช้า');
  assert.equal(providerProductName(label('จีนบ่าย VIP', 'stock_special')), 'หวยหุ้นจีนพิเศษ บ่าย');
});

test('the label of a provider-only product is stable', () => {
  const once = withCanonicalName(label('หวยหุ้นจีน VISA เช้า', 'stock_visa'), live);
  assert.equal(once.ชื่อหวย, 'หวยหุ้นจีน VISA เช้า');
  assert.equal(withCanonicalName(once, live), once);
});

test('a row folded into the catalogue VIP name gets its own product back', () => {
  assert.equal(withCanonicalName(label('รัสเซีย VIP', 'stock_special'), live).ชื่อหวย, 'หวยหุ้นรัสเซียพิเศษ');
  assert.equal(withCanonicalName(label('อังกฤษ VIP', 'stock_visa'), live).ชื่อหวย, 'หวยหุ้นอังกฤษ VISA');
});

test('the real VIP round keeps the catalogue name', () => {
  assert.equal(withCanonicalName(label('หวยหุ้นอังกฤษ VIP', 'vip'), live).ชื่อหวย, 'อังกฤษ VIP');
  assert.equal(withCanonicalName(label('รัสเซีย VIP', 'vip'), live).ชื่อหวย, 'รัสเซีย VIP');
});

test('three products of one market on one date stay three rows', () => {
  const rows = [
    label('รัสเซีย VIP', 'vip'),
    label('หวยหุ้นรัสเซียพิเศษ', 'stock_special'),
    label('หวยหุ้นรัสเซีย VISA', 'stock_visa'),
  ].map((row, index) => ({ ...row, เลขบน_3_ตัว: ['111', '222', '333'][index] }));
  const merged = mergeRows([], rows, live);
  assert.deepEqual(merged.map(row => row.ชื่อหวย), ['รัสเซีย VIP', 'หวยหุ้นรัสเซียพิเศษ', 'หวยหุ้นรัสเซีย VISA']);
});

test('ฮานอยพิเศษ stays its own lottery and is not read as a VIP round', () => {
  assert.notEqual(scheduleName('ฮานอยพิเศษ'), scheduleName('ฮานอย VIP'));
  assert.equal(withCanonicalName(label('ฮานอยพิเศษ', 'hanoi'), live).ชื่อหวย, 'ฮานอยพิเศษ');
});

test('the live catalogue relabels the provider spellings of a catalogue name', () => {
  const cases = {
    'หวยหุ้นจีนเช้า': 'จีนรอบเช้า',
    'จีนรอบเช้า': 'จีนรอบเช้า',
    'หวยหุ้นนิคเคอิเช้า': 'นิเคอิรอบเช้า',
  };
  for (const [stored, expected] of Object.entries(cases)) {
    assert.equal(withCanonicalName(label(stored, 'stock'), live).ชื่อหวย, expected, stored);
  }
});

test('a lottery the catalogue does not list keeps its provider label', () => {
  assert.equal(withCanonicalName(label('หวยมาเลย์', 'malay'), live).ชื่อหวย, 'หวยมาเลย์');
});
