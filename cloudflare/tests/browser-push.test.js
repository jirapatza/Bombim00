import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { browserPushApi, createReceipt, deviceLimit, publishBrowserPush } from '../src/browser-push.js';
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
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.urgency, 'high');
    assert.equal(init.headers.ttl, '21600');
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

test('records accepted pushes and accepts authenticated received/opened receipts idempotently', async t => {
  const db = database(); t.after(() => db.close());
  const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const device = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const base64 = async key => Buffer.from(await crypto.subtle.exportKey('raw', key)).toString('base64url');
  const env = { DB: db, WEB_PUSH_PUBLIC_KEY: await base64(vapid.publicKey),
    WEB_PUSH_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', vapid.privateKey)).d,
    WEB_PUSH_SUBJECT: 'https://bombim00.pages.dev', WEB_PUSH_RECEIPT_SECRET: 'r'.repeat(32) };
  const endpoint = 'https://fcm.googleapis.com/fcm/send/receipt-device-123456789';
  const subscription = { endpoint, keys: { p256dh: await base64(device.publicKey), auth: randomBytes(16).toString('base64url') } };
  await db.prepare('INSERT INTO browser_push_subscriptions (endpoint, subscription) VALUES (?, ?)')
    .bind(endpoint, JSON.stringify(subscription)).run();
  const detail = {};
  assert.equal(await publishBrowserPush(env, { title: 'result', message: '007 - 04' },
    async () => new Response(null, { status: 201 }), detail, 600, ['draw-1']), 'sent');
  assert.equal(detail.receipt_ids.length, 1);
  const accepted = await db.prepare('SELECT draw_keys, received_at FROM browser_push_receipts WHERE delivery_id = ?')
    .bind(detail.receipt_ids[0]).first();
  assert.equal(accepted.draw_keys, '["draw-1"]');
  assert.equal(accepted.received_at, null);

  const receipt = await createReceipt(env, endpoint, 600);
  await db.prepare(`INSERT INTO browser_push_receipts
    (delivery_id, device_hash, draw_keys, accepted_at, expires_at) VALUES (?, ?, '[]', ?, ?)`)
    .bind(receipt.deliveryId, receipt.deviceHash, Date.now(), receipt.expiresAt).run();
  const post = event => browserPushApi(new Request('https://worker.test/push/receipt', { method: 'POST',
    headers: { Origin: 'https://bombim00.pages.dev' },
    body: JSON.stringify({ deliveryId: receipt.deliveryId, token: receipt.token, event }) }), env);
  assert.equal((await post('received')).status, 200);
  assert.equal((await post('received')).status, 200);
  assert.equal((await post('opened')).status, 200);
  const saved = await db.prepare('SELECT received_at, opened_at FROM browser_push_receipts WHERE delivery_id = ?')
    .bind(receipt.deliveryId).first();
  assert.ok(saved.received_at > 0 && saved.opened_at >= saved.received_at);
  const invalid = await browserPushApi(new Request('https://worker.test/push/receipt', { method: 'POST',
    headers: { Origin: 'https://bombim00.pages.dev' },
    body: JSON.stringify({ deliveryId: receipt.deliveryId, token: `${receipt.expiresAt}.bad`, event: 'received' }) }), env);
  assert.equal(invalid.status, 403);
});

test('accepts Chrome, Safari and Firefox push endpoints and rejects every other host', async t => {
  const db = database(); t.after(() => db.close());
  const device = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const base64 = async key => Buffer.from(await crypto.subtle.exportKey('raw', key)).toString('base64url');
  const env = { DB: db, WEB_PUSH_PUBLIC_KEY: 'public', WEB_PUSH_PRIVATE_KEY: 'private',
    WEB_PUSH_SUBJECT: 'https://bombim00.pages.dev', WEB_PUSH_ENROLLMENT: 'local-test-code' };
  const keys = { p256dh: await base64(device.publicKey), auth: randomBytes(16).toString('base64url') };
  const enroll = endpoint => browserPushApi(new Request('https://worker.test/push/subscription', {
    method: 'POST', headers: { Origin: 'https://bombim00.pages.dev' },
    body: JSON.stringify({ subscription: { endpoint, keys }, enrollment: 'local-test-code' }),
  }), env);
  const accepted = [
    'https://fcm.googleapis.com/fcm/send/synthetic-device-123456',
    'https://web.push.apple.com/QGx1Y2t5YXBwbGV0b2tlbmV4YW1wbGUxMjM0NTY3ODkw',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABmozillatokenexample123456',
  ];
  for (const endpoint of accepted) assert.equal((await enroll(endpoint)).status, 200, endpoint);
  const rejected = [
    'https://example.com/send/abcdefghijklmnop',
    'http://fcm.googleapis.com/fcm/send/synthetic-device-123456',
    'https://fcm.googleapis.com.evil.example/fcm/send/synthetic-device-123456',
    'https://web.push.apple.com.evil.example/QGx1Y2t5YXBwbGV0b2tlbmV4YW1wbGUxMjM0NTY3ODkw',
    'https://updates.push.services.mozilla.com/wpush/v2/../../etc/passwd',
  ];
  for (const endpoint of rejected) {
    const response = await enroll(endpoint);
    assert.equal(response.status, 400, endpoint);
    assert.deepEqual(await response.json(), { error: 'invalid_subscription', reason: 'unsupported_endpoint' });
  }
});

test('honours MAX_DEVICES, reports capacity, and keeps re-enrolling an existing device idempotent', async t => {
  const db = database(); t.after(() => db.close());
  const device = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const base64 = async key => Buffer.from(await crypto.subtle.exportKey('raw', key)).toString('base64url');
  const env = { DB: db, WEB_PUSH_PUBLIC_KEY: 'public', WEB_PUSH_PRIVATE_KEY: 'private',
    WEB_PUSH_SUBJECT: 'https://bombim00.pages.dev', WEB_PUSH_ENROLLMENT: 'local-test-code', MAX_DEVICES: '2' };
  const keys = { p256dh: await base64(device.publicKey), auth: randomBytes(16).toString('base64url') };
  const enroll = index => browserPushApi(new Request('https://worker.test/push/subscription', {
    method: 'POST', headers: { Origin: 'https://bombim00.pages.dev' },
    body: JSON.stringify({ subscription: { endpoint: `https://fcm.googleapis.com/fcm/send/synthetic-device-00000${index}`, keys },
      enrollment: 'local-test-code' }),
  }), env);
  assert.equal(deviceLimit({}), 10);
  assert.equal(deviceLimit({ MAX_DEVICES: '3' }), 3);
  assert.equal(deviceLimit({ MAX_DEVICES: '0' }), 10);
  assert.equal(deviceLimit({ MAX_DEVICES: 'many' }), 10);
  assert.equal((await enroll(1)).status, 200);
  assert.equal((await enroll(2)).status, 200);
  assert.equal((await enroll(1)).status, 200);
  const full = await enroll(3);
  assert.equal(full.status, 409);
  assert.equal((await full.json()).error, 'subscription_capacity');
  assert.equal((await db.prepare('SELECT count(*) AS n FROM browser_push_subscriptions').first()).n, 2);
});
