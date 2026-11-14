import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { health, recordHeartbeat } from '../src/worker.mjs';

test('heartbeat writes a successful run with consistent timestamps', async () => {
  let values;
  const db = { prepare: () => ({ bind: (...args) => ({ run: async () => { values = args; } }) }) };
  await recordHeartbeat(db, new Date('2026-11-14T00:00:00Z'));
  assert.equal(values[1], '2026-11-14T00:00:00.000Z');
  assert.equal(values[1], values[2]);
});
test('health detects missing, stale, future and fresh heartbeats', async () => {
  const now = Date.parse('2026-11-14T00:20:00Z');
  for (const [value, expected] of [[null, 'degraded'], ['2026-11-14T00:09:59Z', 'degraded'], ['2026-11-14T00:20:01Z', 'degraded'], ['2026-11-14T00:10:00Z', 'healthy']]) {
    const db = { prepare: () => ({ first: async () => value ? { finished_at: value } : null }) };
    assert.equal((await health(db, now)).status, expected);
  }
});
test('database failure is exposed as unavailable', async () => {
  const response = await worker.fetch(new Request('https://example.test/health'), { DB: { prepare() { throw Error('offline'); } } });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, 'unavailable');
});
