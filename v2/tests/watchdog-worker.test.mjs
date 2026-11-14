import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { checkOnce } from '../src/watchdog-worker.mjs';

function isolatedDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../watchdog-migrations/0001_watchdog.sql', import.meta.url), 'utf8'));
  return { prepare(sql) { return { bind(...args) { return { async run() {
    return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } };
  } }; } }; } };
}
test('stale health sends one Gmail alert and records the claim', async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return Response.json({ status: 'degraded', last_success: '2020-01-01T00:00:00Z' }, { status: 503 });
    if (calls.length === 2) return Response.json({ access_token: 'test-access' });
    return Response.json({ id: 'test' });
  };
  const env = { HEALTH_URL: 'https://health.example.test/health', WATCHDOG_DB: isolatedDatabase(),
    GMAIL_CLIENT_ID: 'id', GMAIL_CLIENT_SECRET: 'secret', GMAIL_REFRESH_TOKEN: 'refresh', ALERT_RECIPIENT: 'ops@example.test' };
  assert.deepEqual(await checkOnce(env, request), { state: 'stale', alert: 'accepted' });
  assert.equal(calls.length, 3);
  const second = await checkOnce(env, async () => Response.json({ status: 'degraded', last_success: '2020-01-01T00:00:00Z' }, { status: 503 }));
  assert.deepEqual(second, { state: 'stale', alert: 'already_claimed' });
});

test('non-HTTPS health URL is rejected before any requests', async () => {
  await assert.rejects(checkOnce({ HEALTH_URL: 'http://example.test', WATCHDOG_DB: isolatedDatabase() }, async () => assert.fail('must not fetch')), /invalid_health_url/);
});
