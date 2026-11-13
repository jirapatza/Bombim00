import test from 'node:test';
import assert from 'node:assert/strict';
import { publishNtfy, retryAfterDelay, quotaCooldownUntil, PreflightError } from '../src/ntfy-gateway-v2.js';

const fixed = Date.parse('2026-11-13T10:00:00Z');
const expectedClick = 'https://bombim00.pages.dev';

test('Ntfy Gateway v2 keeps HTTPS, topic, click and bearer auth without changing subscribers', async () => {
  let call;
  const request = async (url, options) => {
    call = { url, options, payload: JSON.parse(options.body) };
    return new Response(null, { status: 200 });
  };
  const settings = { channels: { ntfy: { server: 'https://ntfy.sh/', click_url: 'https://bombim00.onrender.com' } } };
  const msg = { title: 'Bombim00', message: 'ทดสอบในเครื่อง ไม่ส่งจริง' };
  const detail = {};
  assert.equal(await publishNtfy(settings, msg, 'existing-subscribed-topic', request, detail, 'tk_sample'), 'sent');
  assert.equal(call.url, 'https://ntfy.sh/');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers.Authorization, 'Bearer tk_sample');
  assert.equal(call.payload.topic, 'existing-subscribed-topic');
  assert.equal(call.payload.click, expectedClick);
  assert.equal(detail.code, 'http_200');
});

test('Gateway v2 treats quota exhaustion after 200 as accepted, but asks to pause future sends', async () => {
  const detail = {};
  const request = async () => new Response(null, {
    status: 200, headers: { RateLimit: '"messages";r=0;t=3600' },
  });
  const outcome = await publishNtfy({}, { title: 'result', message: '123' }, 'existing-topic', request, detail);
  assert.equal(outcome, 'sent');
  assert.equal(detail.code, 'http_200');
  assert.ok(Date.parse(detail.quota_until) > Date.now());
});

test('RateLimit remaining budget does not pause while nonempty or invalid', () => {
  assert.equal(quotaCooldownUntil('"messages";r=1;t=3600', fixed), null);
  assert.equal(quotaCooldownUntil('"messages";r=undefined;t=3600', fixed), null);
  assert.equal(quotaCooldownUntil('', fixed), null);
  assert.equal(quotaCooldownUntil('"messages";r=0;t=3600', fixed), new Date(fixed + 3_600_000).toISOString());
  assert.equal(quotaCooldownUntil('"requests";r=0;t=20, "messages";r=0;t=60', fixed), new Date(fixed + 60_000).toISOString());
});

test('HTTP 429 honors Retry-After, and 5xx/timeout remain uncertain (no retries)', async () => {
  const rejected = {};
  let count = 0;
  const send429 = async () => { count++; return new Response(null, { status: 429, headers: { 'Retry-After': '180' } }); };
  assert.equal(await publishNtfy({}, { title: 'x' }, 'existing-topic', send429, rejected), 'failed');
  assert.equal(count, 1);
  assert.equal(rejected.code, 'http_429');
  assert.ok(Date.parse(rejected.retry_after_until) > Date.now() + 120_000);

  const maybeAccepted = {};
  count = 0;
  const timedOut = async () => { count++; const e = new Error('synthetic'); e.name = 'TimeoutError'; throw e; };
  assert.equal(await publishNtfy({}, { title: 'x' }, 'existing-topic', timedOut, maybeAccepted), 'uncertain');
  assert.equal(count, 1, 'transport must never automatically resend uncertain attempts');
  assert.equal(maybeAccepted.code, 'timeout');
  assert.equal(await publishNtfy({}, { title: 'x' }, 'existing-topic', async () => new Response(null, { status: 503 }), {}), 'uncertain');
});

test('429 without Retry-After waits for exhausted ntfy daily bucket reset', async () => {
  const detail = {};
  const request = async () => new Response(null, {
    status: 429, headers: { RateLimit: '"requests";r=3;t=5, "messages";r=0;t=3600' },
  });
  assert.equal(await publishNtfy({}, { message: 'x' }, 'existing-topic', request, detail), 'failed');
  assert.equal(detail.code, 'http_429');
  assert.ok(Date.parse(detail.retry_after_until) > Date.now() + 3500_000);
});

test('429 with Retry-After preserves server delay over fallback hints', async () => {
  const detail = {};
  const request = async () => new Response(null, {
    status: 429, headers: { 'Retry-After': '240', RateLimit: '"messages";r=0;t=3600' },
  });
  assert.equal(await publishNtfy({}, { message: 'x' }, 'existing-topic', request, detail), 'failed');
  const ms = Date.parse(detail.retry_after_until) - Date.now();
  assert.ok(ms > 230_000 && ms < 250_000);
});

test('Gateway v2 fails closed on malformed topic or insecure URL without network access', async () => {
  let calls = 0;
  const request = async () => { calls++; return new Response(null, { status: 200 }); };
  const invalidTopic = {};
  assert.equal(await publishNtfy({}, {}, 'topic with spaces', request, invalidTopic), 'failed');
  assert.equal(invalidTopic.code, 'notification_configuration');
  const insecure = {};
  assert.equal(await publishNtfy({ channels: { ntfy: { server: 'http://ntfy.sh' } } }, {}, 'safe_topic', request, insecure), 'failed');
  assert.equal(insecure.code, 'https_required');
  assert.equal(calls, 0);
});

test('Preflight errors are definite; unknown network exceptions are uncertain', async () => {
  const known = {};
  assert.equal(await publishNtfy({}, {}, 'safe_topic', async () => { throw new PreflightError('request_budget'); }, known), 'failed');
  assert.equal(known.code, 'request_budget');
  const unknown = {};
  assert.equal(await publishNtfy({}, {}, 'safe_topic', async () => { throw new Error('random synthetic'); }, unknown), 'uncertain');
  assert.equal(unknown.code, 'network');
});

test('429 default minimum delay and cap survive migration', () => {
  assert.equal(retryAfterDelay(null, fixed), 60_000);
  assert.equal(retryAfterDelay('30', fixed), 30_000);
  assert.equal(retryAfterDelay('999999999', fixed), 26 * 60 * 60 * 1000);
});
