import { buildPushPayload } from '@block65/webcrypto-web-push';

export const DEFAULT_PUSH_BACKOFF_MS = 60_000;
const DEFAULT_MAX_DEVICES = 10;
const TEST_INTERVAL = 60_000;
const SITE = 'https://bombim00.pages.dev';
// Exact hosts only: a spoofed suffix such as fcm.googleapis.com.evil.example must fail.
const PUSH_ENDPOINTS = [
  /^https:\/\/fcm\.googleapis\.com\/fcm\/send\/[A-Za-z0-9_:.%-]{16,512}$/,
  /^https:\/\/web\.push\.apple\.com\/[A-Za-z0-9_=-]{16,512}$/,
  /^https:\/\/updates\.push\.services\.mozilla\.com\/wpush\/v2\/[A-Za-z0-9_=-]{16,512}$/,
];
const encoder = new TextEncoder();

export class PreflightError extends Error {}

export function deviceLimit(env) {
  const limit = Number(env?.MAX_DEVICES);
  return Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : DEFAULT_MAX_DEVICES;
}

export function pushKeys(env) {
  if (!env.WEB_PUSH_PUBLIC_KEY || !env.WEB_PUSH_PRIVATE_KEY || !env.WEB_PUSH_SUBJECT) return null;
  return { publicKey: env.WEB_PUSH_PUBLIC_KEY, privateKey: env.WEB_PUSH_PRIVATE_KEY, subject: env.WEB_PUSH_SUBJECT };
}

function subscriptionFrom(value) {
  const endpoint = value?.endpoint;
  const keys = value?.keys;
  if (typeof endpoint !== 'string' || !PUSH_ENDPOINTS.some(pattern => pattern.test(endpoint)) ||
      typeof keys?.p256dh !== 'string' || !/^B[A-Za-z0-9_-]{86}$/.test(keys.p256dh) ||
      typeof keys?.auth !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(keys.auth)) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, expirationTime: null };
}

const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode64url = value => {
  const input = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(input), x => x.charCodeAt(0));
};
async function digest(value) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
async function receiptKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) return null;
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function createReceipt(env, endpoint, ttl) {
  const key = await receiptKey(env.WEB_PUSH_RECEIPT_SECRET);
  if (!key) return null;
  const deliveryId = crypto.randomUUID(), deviceHash = await digest(endpoint), expiresAt = Date.now() + Math.max(120, ttl) * 1000;
  const signature = base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key,
    encoder.encode(`${deliveryId}.${deviceHash}.${expiresAt}`))));
  return { deliveryId, deviceHash, expiresAt, token: `${expiresAt}.${signature}` };
}
async function validReceiptToken(env, row, token) {
  const [expires, signature, extra] = String(token || '').split('.');
  const expiresAt = Number(expires), key = await receiptKey(env.WEB_PUSH_RECEIPT_SECRET);
  if (extra !== undefined || !key || !Number.isSafeInteger(expiresAt) || expiresAt !== row.expires_at || expiresAt < Date.now() ||
      !/^[A-Za-z0-9_-]{43}$/.test(signature || '')) return false;
  return crypto.subtle.verify('HMAC', key, decode64url(signature),
    encoder.encode(`${row.delivery_id}.${row.device_hash}.${expiresAt}`));
}

async function sendToDevice(message, subscription, keys, request, ttl, receipt = null) {
  const payload = await buildPushPayload({
    data: JSON.stringify({ title: message.title, body: message.message, ...(receipt ? { receipt: {
      deliveryId: receipt.deliveryId, token: receipt.token, expiresAt: receipt.expiresAt,
    } } : {}) }),
    options: { ttl, urgency: 'high' },
  }, subscription, keys);
  return request(subscription.endpoint, { ...payload, method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(5000) });
}

export async function publishBrowserPush(env, message, request, detail = {}, ttl = 21600, drawKeys = []) {
  const keys = pushKeys(env);
  if (!keys) return 'failed';
  const { results } = await env.DB.prepare(
    'SELECT subscription FROM browser_push_subscriptions ORDER BY endpoint LIMIT ?',
  ).bind(deviceLimit(env)).all();
  if (!results.length) return 'failed';
  const outcomes = await Promise.all(results.map(async ({ subscription }) => {
    try {
      const device = subscriptionFrom(JSON.parse(subscription));
      if (!device) return 'failed';
      const receipt = await createReceipt(env, device.endpoint, ttl);
      const response = await sendToDevice(message, device, keys, request, ttl, receipt);
      if (response.ok) {
        if (receipt) {
          await env.DB.prepare(`INSERT INTO browser_push_receipts
            (delivery_id, device_hash, draw_keys, accepted_at, expires_at)
            VALUES (?, ?, ?, ?, ?)`)
            .bind(receipt.deliveryId, receipt.deviceHash, JSON.stringify(drawKeys), Date.now(), receipt.expiresAt).run();
          (detail.receipt_ids ||= []).push(receipt.deliveryId);
        }
        return 'sent';
      }
      if (response.status === 404 || response.status === 410) {
        await env.DB.prepare('DELETE FROM browser_push_subscriptions WHERE endpoint = ? AND subscription = ?')
          .bind(device.endpoint, subscription).run();
        return 'failed';
      }
      if (response.status === 429) {
        const header = response.headers.get('Retry-After')?.trim();
        const delay = header && /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header || '') - Date.now();
        detail.retry_after_ms = Math.max(detail.retry_after_ms || 0,
          Number.isFinite(delay) && delay > 0 ? Math.min(delay, 86_400_000) : DEFAULT_PUSH_BACKOFF_MS);
        detail.code = 'http_429';
      }
      if ([401, 403].includes(response.status) && !detail.code) detail.code = `http_${response.status}`;
      return response.status >= 500 ? 'uncertain' : 'failed';
    } catch (error) {
      return error instanceof PreflightError ? 'failed' : 'uncertain';
    }
  }));
  if (outcomes.includes('sent')) return 'sent';
  if (outcomes.includes('uncertain')) return 'uncertain';
  return 'failed';
}

async function readJson(request, limit = 2048) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_body');
  let body = '', length = 0; const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new Error('invalid_body'); }
    body += decoder.decode(value, { stream: true });
  }
  return JSON.parse(body + decoder.decode());
}

export async function browserPushApi(request, env) {
  const path = new URL(request.url).pathname;
  const origin = env.WEB_PUSH_ORIGIN || SITE;
  if (request.headers.get('Origin') !== origin) return new Response(null, { status: 403 });
  const headers = {
    'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store', Vary: 'Origin',
  };
  const reply = (body, status = 200) => Response.json(body, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const keys = pushKeys(env);
  if (!keys) return reply({ error: 'push_unavailable' }, 503);
  if (path === '/push/config' && request.method === 'GET') return reply({ publicKey: keys.publicKey });
  if (path === '/push/receipt' && request.method === 'POST') {
    try {
      const input = await readJson(request);
      if (!['received', 'opened'].includes(input.event) || !/^[0-9a-f-]{36}$/.test(String(input.deliveryId || ''))) {
        return reply({ error: 'invalid_receipt' }, 400);
      }
      const row = await env.DB.prepare('SELECT delivery_id, device_hash, expires_at FROM browser_push_receipts WHERE delivery_id = ?')
        .bind(input.deliveryId).first();
      if (!row || !(await validReceiptToken(env, row, input.token))) return reply({ error: 'invalid_receipt' }, 403);
      const at = Date.now();
      if (input.event === 'received') await env.DB.prepare(
        'UPDATE browser_push_receipts SET received_at = COALESCE(received_at, ?) WHERE delivery_id = ?')
        .bind(at, input.deliveryId).run();
      else await env.DB.prepare(
        'UPDATE browser_push_receipts SET received_at = COALESCE(received_at, ?), opened_at = COALESCE(opened_at, ?) WHERE delivery_id = ?')
        .bind(at, at, input.deliveryId).run();
      return reply({ ok: true });
    } catch { return reply({ error: 'invalid_receipt' }, 400); }
  }
  if (path !== '/push/subscription' && path !== '/push/test') return reply({ error: 'not_found' }, 404);
  if (request.method !== 'POST' && request.method !== 'DELETE') return reply({ error: 'method_not_allowed' }, 405);
  let subscription;
  let enrollment;
  try {
    const input = await readJson(request);
    subscription = subscriptionFrom(input.subscription);
    enrollment = input.enrollment;
  } catch {
    return reply({ error: 'invalid_subscription' }, 400);
  }
  if (!subscription) return reply({ error: 'invalid_subscription', reason: 'unsupported_endpoint' }, 400);
  const serialized = JSON.stringify(subscription);
  try {
    if (path === '/push/test' && request.method === 'POST') {
      const reserved = await env.DB.prepare(
        'UPDATE browser_push_subscriptions SET tested_at = ? WHERE endpoint = ? AND subscription = ? AND tested_at <= ?',
      ).bind(Date.now(), subscription.endpoint, serialized, Date.now() - TEST_INTERVAL).run();
      if (!reserved.meta.changes) return reply({ error: 'test_unavailable' }, 429);
      const response = await sendToDevice({ title: 'Bombim00 • ทดสอบแจ้งเตือน', message: 'แตะเพื่อกลับไปยังหน้าผลหวย' },
        subscription, keys, fetch, 120);
      return reply({ accepted: response.ok }, response.ok ? 200 : 502);
    }
    if (path === '/push/subscription' && request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM browser_push_subscriptions WHERE endpoint = ? AND subscription = ?')
        .bind(subscription.endpoint, serialized).run();
      return reply({ ok: true });
    }
    if (path === '/push/subscription' && request.method === 'POST') {
      if (!env.WEB_PUSH_ENROLLMENT || enrollment !== env.WEB_PUSH_ENROLLMENT) return reply({ error: 'enrollment_required' }, 403);
      const result = await env.DB.prepare(
        'INSERT OR IGNORE INTO browser_push_subscriptions (endpoint, subscription) SELECT ?, ? WHERE (SELECT count(*) FROM browser_push_subscriptions) < ?',
      ).bind(subscription.endpoint, serialized, deviceLimit(env)).run();
      if (!result.meta.changes) {
        const existing = await env.DB.prepare('SELECT endpoint FROM browser_push_subscriptions WHERE endpoint = ? AND subscription = ?')
          .bind(subscription.endpoint, serialized).first();
        if (!existing) return reply({ error: 'subscription_capacity' }, 409);
      }
      return reply({ ok: true });
    }
    return reply({ error: 'method_not_allowed' }, 405);
  } catch {
    return reply({ error: 'push_unavailable' }, 503);
  }
}
