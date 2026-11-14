import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendWatchdogAlert } from '../src/gmail.mjs';
const config = { clientId: 'test-id', clientSecret: 'test-secret', refreshToken: 'test-refresh', recipient: 'ops@example.test' };
test('refreshes access and sends one correctly addressed message', async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? Response.json({ access_token: 'test-access' }) : Response.json({ id: 'test' });
  };
  assert.deepEqual(await sendWatchdogAlert(config, 'stale', request), { status: 'accepted' });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-access');
  assert.match(Buffer.from(JSON.parse(calls[1].options.body).raw, 'base64url').toString(), /To: ops@example\.test\r\nSubject: Bombim00 watchdog/);
});
test('does not send after token rejection and avoids header injection', async () => {
  let count = 0;
  const request = async () => { count++; return new Response('', { status: 401 }); };
  assert.equal((await sendWatchdogAlert(config, 'stale', request)).status, 'authentication_error');
  assert.equal(count, 1);
  assert.equal((await sendWatchdogAlert({ ...config, recipient: 'x@example.test\r\nBcc:evil@example.test' }, 'stale', request)).status, 'configuration_error');
  assert.equal(count, 1);
});
test('timeout during sending is uncertain and is not retried', async () => {
  let count = 0;
  const request = async () => { if (++count === 1) return Response.json({ access_token: 'test' }); throw Error('timeout'); };
  assert.equal((await sendWatchdogAlert(config, 'unreachable', request)).status, 'uncertain');
  assert.equal(count, 2);
});
