import test from 'node:test';
import assert from 'node:assert/strict';
import { applyControlOverrides, isQuarantined, syncCodaControls, syncCodaDashboard } from '../src/coda-control.js';
import { database } from './state-helper.js';

const now = new Date('2026-11-19T12:00:00Z');
const env = db => ({ DB: db, CODA_API_TOKEN: 'secret', CODA_DOC_ID: 'doc123', CODA_CONTROL_TABLE_ID: 'grid123' });
const row = (id, action, extra = {}) => ({ id, values: { Action: action, Status: 'requested',
  'Requested At': '2026-11-19T11:59:00Z', 'Expires At': '2026-11-19T12:04:00Z', ...extra } });
const requester = rows => async (_url, options) => options.method === 'GET'
  ? Response.json({ items: rows }) : new Response(null, { status: 202 });

test('applies one-click controls once, records audit and acknowledges Coda', async t => {
  const db = database(); t.after(() => db.close());
  const state = { deliveries: {} };
  const rows = [row('r1', 'pause_all'), row('r2', 'quarantine_lottery', { Target: 'lao_samakki' }),
    row('r3', 'disable_source', { Target: 'lotterychecks' })];
  const first = await syncCodaControls(env(db), state, requester(rows), now);
  assert.deepEqual(first, { configured: true, applied: 3, rejected: 0 });
  assert.equal(state.controls.paused, true);
  assert.equal(isQuarantined(state, 'lao_samakki'), true);
  assert.equal(applyControlOverrides({ sources: { lotterychecks: { enabled: true } } }, state).sources.lotterychecks.enabled, false);
  const second = await syncCodaControls(env(db), state, requester(rows), now);
  assert.deepEqual(second, { configured: true, applied: 0, rejected: 0 });
  assert.equal((await db.prepare('SELECT count(*) AS count FROM coda_control_requests').first()).count, 3);
});

test('rejects expired, unknown and unsafe uncertain resolution without evidence', async t => {
  const db = database(); t.after(() => db.close());
  const state = { deliveries: { draw: { state: 'uncertain', date: '2026-11-19', startedAt: now.toISOString() } } };
  const rows = [row('r1', 'resolve_uncertain_sent', { Target: 'draw' }), row('r2', 'force_unverified_send'),
    row('r3', 'pause_all', { 'Expires At': '2026-11-19T11:58:00Z' })];
  const result = await syncCodaControls(env(db), state, requester(rows), now);
  assert.deepEqual(result, { configured: true, applied: 0, rejected: 3 });
  assert.equal(state.deliveries.draw.state, 'uncertain');
  const audit = await db.prepare('SELECT reason FROM coda_control_requests ORDER BY request_id').all();
  assert.deepEqual(audit.results.map(x => x.reason), ['evidence_required', 'unknown_action', 'expired_request']);
});

test('Coda outage never changes the last applied controls', async t => {
  const db = database(); t.after(() => db.close());
  const state = { deliveries: {}, controls: { paused: true, quarantined: ['lao_samakki'], disabledSources: [] } };
  const result = await syncCodaControls(env(db), state, async () => { throw new Error('offline'); }, now);
  assert.equal(result.error, 'coda_sync');
  assert.equal(state.controls.paused, true);
  assert.equal(isQuarantined(state, 'lao_samakki'), true);
});

test('batches verification, lottery and incident summaries without exposing raw payloads', async t => {
  const db = database(); t.after(() => db.close());
  const configured = { ...env(db), CODA_LOTTERIES_TABLE_ID: 'lotteries123',
    CODA_VERIFICATION_TABLE_ID: 'verification123', CODA_INCIDENTS_TABLE_ID: 'incidents123' };
  const group = { key: '["lao_samakki","2026-11-19"]', item: { id: 'lao_samakki', name: 'ลาวสามัคคี' },
    date: '2026-11-19', sourceFamilies: ['lotterychecks', 'thailottoapi'], row: { เลขบน_3_ตัว: '007', เลขล่าง_2_ตัว: '04' } };
  const report = { verified: [group], pending: [], conflicts: [],
    unmapped: [{ reason: 'catalog', row: { หวย: 'unknown', วันที่จัดรูปแบบ: '2026-11-19' } }] };
  const writes = [];
  const request = async (url, options) => { writes.push({ url, body: JSON.parse(options.body) }); return new Response(null, { status: 202 }); };
  const state = {};
  const result = await syncCodaDashboard(configured, state, report, request, now);
  assert.deepEqual(result, { configured: true, rows: 1 });
  assert.equal(writes.length, 3);
  assert.deepEqual(writes.map(x => x.body.keyColumns[0]), ['Lottery ID', 'Draw Key', 'Incident Key']);
  assert.ok(!JSON.stringify(writes).includes('endpoint'));
  assert.deepEqual(await syncCodaDashboard(configured, state, report, request, now), { configured: true, skipped: true });
});
