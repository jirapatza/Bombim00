import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { browserPushApi, publishBrowserPush } from '../src/browser-push.js';
import { database } from './state-helper.js';

test('enrolls Chrome, sends encrypted Web Push, handles 429, and removes expired subscriptions', async t => {
  const db = database();
  t.after(() => db.close());
  const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const device = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const base64 = async key => Buffer.from(await crypto.subtle.exportKey('raw', key)).toString('base64url');
  const env = { DB: db, WEB_PUSH_PUBLIC_KEY: await base64(vapid.publicKey),
    WEB_PUSH_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', vapid.privateKey)).d,
    WEB_PUSH_SUBJECT: 'https://bombim00.pages.dev', WEB_PUSH_ENROLLMENT: 'local-test-code' };
  const endpoint = 'https://fcm.googleapis.com/fcm/send/synthetic-device-123456';
  const subscription = { endpoint, keys: { p256dh: await base64(device.publicKey), auth: randomBytes(16).toString('base64url') } };
  const enroll = (origin, enrollment, target = subscription) => browserPushApi(new Request('https://worker.test/push/subscription', {
    method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ subscription: target, enrollment }),
  }), env);
  assert.equal((await enroll('https://other.example', 'local-test-code')).status, 403);
  assert.equal((await enroll('https://bombim00.pages.dev', 'wrong')).status, 403);
  assert.equal((await enroll('https://bombim00.pages.dev', 'local-test-code', { ...subscription, endpoint: 'https://example.com/send' })).status, 400);
  assert.equal((await enroll('https://bombim00.pages.dev', 'local-test-code')).status, 200);
  const message = { title: 'ผลหวย', message: '007 - 90' };
  const detail = {};
  assert.equal(await publishBrowserPush(env, message, async (url, init) => {
    assert.equal(url, endpoint);
    assert.match(init.headers.authorization, /^vapid t=/);
    assert.equal(init.headers['content-encoding'], 'aes128gcm');
    assert.equal(init.redirect, 'error');
    assert.ok(init.body.byteLength > 100);
    return new Response(null, { status: 201 });
  }), 'sent');
  assert.equal(await publishBrowserPush(env, message, async () => new Response(null, {
    status: 429, headers: { 'Retry-After': '120' },
  }), detail), 'failed');
  assert.deepEqual(detail, { code: 'http_429', retry_after_ms: 120000 });
  assert.equal(await publishBrowserPush(env, message, async () => new Response(null, { status: 503 })), 'uncertain');
  assert.equal(await publishBrowserPush(env, message, async () => new Response(null, { status: 410 })), 'failed');
  assert.equal(await publishBrowserPush(env, message, async () => assert.fail('expired endpoint')), 'failed');
});
