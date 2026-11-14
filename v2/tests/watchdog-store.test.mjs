import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/watchdog-store.mjs';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../watchdog-migrations/0001_watchdog.sql', import.meta.url), 'utf8'));
  return { prepare(sql) { return { bind(...args) { return { async run() {
    return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } };
  } }; } }; } };
}
test('claim is unique, resolved incidents can alert again', async () => {
  const store = createStore(database());
  const id = await store.claimAlert('stale');
  assert.ok(id);
  assert.equal(await store.claimAlert('stale'), null);
  await store.finishAlert(id, 'accepted');
  await store.resolve();
  assert.ok(await store.claimAlert('stale'));
});
test('uncertain sends remain claimed after recovery', async () => {
  const store = createStore(database());
  const id = await store.claimAlert('unreachable');
  await store.finishAlert(id, 'uncertain');
  await store.resolve();
  assert.equal(await store.claimAlert('stale'), null);
});
test('definite failure is retried after cooldown without retrying uncertain sends', async () => {
  let time = '2026-11-14T00:00:00.000Z';
  const store = createStore(database(), () => time);
  const first = await store.claimAlert('unreachable');
  await store.finishAlert(first, 'authentication_error');
  time = '2026-11-14T00:14:59.000Z';
  assert.equal(await store.claimAlert('unreachable'), null);
  time = '2026-11-14T00:15:00.000Z';
  const next = await store.claimAlert('unreachable');
  assert.ok(next);
  await store.finishAlert(next, 'uncertain');
  time = '2026-11-14T01:00:00.000Z';
  assert.equal(await store.claimAlert('unreachable'), null);
});
