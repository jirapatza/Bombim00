import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyHealth } from '../src/watchdog.mjs';

const now = Date.parse('2026-11-14T00:20:00Z');
test('distinguishes stale heartbeat from unreadable health', () => {
  assert.equal(classifyHealth(503, { status: 'degraded', last_success: '2026-11-14T00:09:59Z' }, now).state, 'stale');
  assert.equal(classifyHealth(503, { status: 'unavailable', last_success: null }, now).state, 'unreachable');
  assert.equal(classifyHealth(403, null, now).state, 'unreachable');
  assert.equal(classifyHealth(200, { status: 'healthy', last_success: 'invalid' }, now).state, 'unreachable');
  assert.equal(classifyHealth(200, { status: 'healthy', last_success: '2026-11-14T00:20:01Z' }, now).state, 'unreachable');
  assert.equal(classifyHealth(200, { status: 'healthy', last_success: '2026-11-14T00:10:00Z' }, now).state, 'healthy');
});
