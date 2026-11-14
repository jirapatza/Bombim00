import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWatchdog } from '../src/watchdog-cycle.mjs';

test('healthy response does not send', async () => {
  const result = await runWatchdog({ now: Date.parse('2026-11-14T00:20:00Z'),
    readHealth: async () => ({ status: 200, body: { status: 'healthy', last_success: '2026-11-14T00:19:00Z' } }),
    claimAlert: async () => assert.fail('healthy must not claim'), sendAlert: async () => assert.fail('healthy must not send') });
  assert.deepEqual(result, { state: 'healthy' });
});
test('claims before sending, and stores ambiguous delivery', async () => {
  const order = [];
  const result = await runWatchdog({ readHealth: async () => { throw Error('offline'); },
    claimAlert: async state => { order.push(`claim:${state}`); return 'claim-1'; },
    sendAlert: async () => { order.push('send'); throw Error('timeout'); },
    finishAlert: async (claim, status) => { order.push(`${claim}:${status}`); } });
  assert.deepEqual(order, ['claim:unreachable', 'send', 'claim-1:uncertain']);
  assert.deepEqual(result, { state: 'unreachable', alert: 'uncertain' });
});
test('claimed incident does not send again', async () => {
  const result = await runWatchdog({ readHealth: async () => { throw Error('offline'); },
    claimAlert: async () => null, sendAlert: async () => assert.fail('duplicate') });
  assert.equal(result.alert, 'already_claimed');
});
