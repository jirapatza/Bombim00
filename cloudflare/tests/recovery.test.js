import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { configuration } from '../configure.mjs';
import { resolutionSQL, deliveryId } from '../recovery.mjs';

test('configuration stays paused/observing and rejects missing or placeholder database identity', () => {
  assert.throws(() => configuration('00000000-0000-0000-0000-000000000000'));
  const config = configuration('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  assert.equal(config.vars.ENABLED, 'false'); assert.equal(config.vars.MODE, 'observe');
});
test('recovery updates only an unresolved result after lease expiry with no pending publication', t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  db.exec(readFileSync(new URL('../migrations/0001_state.sql', import.meta.url), 'utf8'));
  const key = '["ลาว TV","2026-11-07","007","90"]';
  const state = { version: 1, pending: null, deliveries: { [key]: { state: 'uncertain', date: '2026-11-07' }, other: { state: 'sent' } } };
  db.prepare('UPDATE worker_state SET payload = ?, lease_until = 5000').run(JSON.stringify(state));
  const sql = resolutionSQL(key, 'sent', "verified synthetic ntfy ID '123'", 6000);
  db.exec(resolutionSQL(key, 'sent', 'verified synthetic ntfy ID', 4000));
  assert.equal(JSON.parse(db.prepare('SELECT payload FROM worker_state').get().payload).deliveries[key].state, 'uncertain');
  db.exec(sql);
  let after = JSON.parse(db.prepare('SELECT payload FROM worker_state').get().payload);
  assert.equal(after.deliveries[key].state, 'sent'); assert.equal(after.deliveries[key].date, '2026-11-07');
  assert.equal(after.deliveries.other.state, 'sent');
  assert.equal(deliveryId(key).length, 64);
  state.pending = { cannotLose: true };
  db.prepare('UPDATE worker_state SET payload = ?').run(JSON.stringify(state)); db.exec(sql);
  after = JSON.parse(db.prepare('SELECT payload FROM worker_state').get().payload);
  assert.equal(after.deliveries[key].state, 'uncertain');
  assert.throws(() => resolutionSQL(key, 'failed', '', 6000));
});
