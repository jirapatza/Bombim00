import test from 'node:test';
import assert from 'node:assert/strict';
import { consensusRows, evaluateConsensus } from '../src/consensus.js';
import { recordConsensus } from '../src/evidence.js';
import { database } from './state-helper.js';

const catalog = [{ id: 'lao_samakki', name: 'ลาวสามัคคี', drawDays: 'ทุกวัน (จันทร์ - อาทิตย์)' }];
const result = (family, top = '007', bottom = '04') => ({
  ชื่อหวย: 'หวยลาวสามัคคี', หวย: family === 'lotterychecks' ? 'lao_samakki' : 'legacy-lao',
  งวดวันที่: '2026-11-19', วันที่จัดรูปแบบ: '2026-11-19', เลขบน_3_ตัว: top, เลขล่าง_2_ตัว: bottom,
  source_family: family, แหล่งข้อมูล: family, เวลาที่ตรวจพบ: '2026-11-19T12:00:00.000Z',
});

test('requires two independent source families and preserves leading zeroes', () => {
  const pending = evaluateConsensus([result('thailottoapi')], catalog);
  assert.equal(pending.pending.length, 1);
  assert.equal(pending.pending[0].row.verification_status, 'waiting_for_evidence');
  assert.deepEqual(consensusRows(pending, 'enforce'), []);

  const report = evaluateConsensus([result('thailottoapi'), result('lotterychecks')], catalog);
  assert.equal(report.verified.length, 1);
  assert.deepEqual(report.verified[0].row.verification_sources, ['lotterychecks', 'thailottoapi']);
  assert.deepEqual([report.verified[0].row.เลขบน_3_ตัว, report.verified[0].row.เลขล่าง_2_ตัว], ['007', '04']);
});

test('duplicate endpoints from one family never count twice and conflicts fail closed', () => {
  const duplicate = evaluateConsensus([result('pholhuay'), result('pholhuay')], catalog);
  assert.equal(duplicate.pending[0].sourceFamilies.length, 1);
  const conflict = evaluateConsensus([result('pholhuay'), result('lotterychecks', '008')], catalog);
  assert.equal(conflict.verified.length, 0);
  assert.equal(conflict.conflicts.length, 1);
  assert.deepEqual(consensusRows(conflict, 'enforce'), []);
});

test('unmapped providers and lotteries stay visible instead of becoming evidence', () => {
  const unknownSource = { ...result('thailottoapi'), source_family: 'mirror' };
  const unknownLottery = { ...result('thailottoapi'), ชื่อหวย: 'หวยที่ไม่มีในตาราง', หวย: 'unknown' };
  const report = evaluateConsensus([unknownSource, unknownLottery], catalog);
  assert.equal(report.unmapped.length, 2);
  assert.deepEqual(report.unmapped.map(x => x.reason).sort(), ['catalog', 'source_family']);
});

test('persists evidence and the latest verification state without raw provider payloads', async t => {
  const db = database(); t.after(() => db.close());
  const report = evaluateConsensus([result('thailottoapi'), result('lotterychecks')], catalog);
  await recordConsensus(db, report, new Date('2026-11-19T12:00:00Z'));
  const evidence = await db.prepare('SELECT source_family, top3, bottom2, raw_hash FROM verification_evidence ORDER BY source_family').all();
  assert.deepEqual(evidence.results.map(x => [x.source_family, x.top3, x.bottom2]), [
    ['lotterychecks', '007', '04'], ['thailottoapi', '007', '04'],
  ]);
  assert.ok(evidence.results.every(x => /^[0-9a-f]{64}$/.test(x.raw_hash)));
  const draw = await db.prepare('SELECT status, source_count FROM verification_draws').first();
  assert.deepEqual({ ...draw }, { status: 'verified', source_count: 2 });
});

test('re-observing the same consensus writes no rows, and a changed verdict does', async t => {
  const db = database(); t.after(() => db.close());
  const first = new Date('2026-11-19T12:00:00Z'), later = new Date('2026-11-19T12:05:00Z');
  const report = evaluateConsensus([result('thailottoapi'), result('lotterychecks')], catalog);
  await recordConsensus(db, report, first);
  const before = await db.prepare('SELECT observed_at FROM verification_evidence').all();
  const drawBefore = await db.prepare('SELECT status, updated_at FROM verification_draws').first();

  // Same evidence and same verdict one cycle later: nothing may change.
  await recordConsensus(db, report, later);
  const after = await db.prepare('SELECT observed_at FROM verification_evidence').all();
  const drawAfter = await db.prepare('SELECT status, updated_at FROM verification_draws').first();
  assert.deepEqual(after.results.map(x => x.observed_at), before.results.map(x => x.observed_at));
  assert.deepEqual({ ...drawAfter }, { ...drawBefore });

  // A conflicting second source must still update the verdict.
  const conflicting = evaluateConsensus([result('thailottoapi'), result('lotterychecks', '999')], catalog);
  await recordConsensus(db, conflicting, later);
  const changed = await db.prepare('SELECT status, updated_at FROM verification_draws').first();
  assert.equal(changed.status, 'conflict');
  assert.equal(changed.updated_at, +later);
});
