import test from 'node:test';
import assert from 'node:assert/strict';
import { getResultNumbers, formatResultPair, normalizeLotteryIdentity } from '../src/utils/lotteryResult.ts';

test('government, stock and foreign results share the same three/two presentation', () => {
  for (const row of [
    { รางวัลที่_1: '123782', เลขท้าย_2_ตัว: '57' },
    { top3: '782', bottom2: '57' },
    { เลขบน_3_ตัว: '782', เลขล่าง_2_ตัว: '57' },
  ]) assert.equal(formatResultPair(row), '782 - 57');
});

test('result presentation keeps real zeros and never manufactures unavailable results', () => {
  assert.deepEqual(getResultNumbers({ firstPrize: '000007', bottom2: '00' }), { top3: '007', bottom2: '00' });
  assert.equal(formatResultPair({ top3: '000', bottom2: '00' }), '000 - 00');
  assert.equal(formatResultPair({ top3: '---', bottom2: '--' }), '--- - --');
  assert.equal(formatResultPair({}), '--- - --');
});

test('canonical identities preserve VIP and round boundaries', () => {
  assert.equal(normalizeLotteryIdentity('หวยหุ้นนิคเคอิ VIP เช้า'), normalizeLotteryIdentity('นิเคอิเช้า VIP'));
  assert.notEqual(normalizeLotteryIdentity('หวยหุ้นไต้หวัน VIP'), normalizeLotteryIdentity('ไต้หวัน'));
  assert.notEqual(normalizeLotteryIdentity('หวยหุ้นเกาหลี VIP'), normalizeLotteryIdentity('เกาหลี'));
  assert.notEqual(normalizeLotteryIdentity('นิเคอิเช้า'), normalizeLotteryIdentity('นิเคอิบ่าย'));
  assert.notEqual(normalizeLotteryIdentity('ดาวโจนส์พิเศษ'), normalizeLotteryIdentity('ดาวโจนส์'));
});
