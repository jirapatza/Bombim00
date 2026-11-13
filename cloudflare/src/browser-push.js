import { buildPushPayload } from '@block65/webcrypto-web-push';

export const DEFAULT_PUSH_BACKOFF_MS = 60_000;
const MAX_DEVICES = 3;
const TEST_INTERVAL = 60_000;
const SITE = 'https://bombim00.pages.dev';
const FCM_ENDPOINT = /^https:\/\/fcm\.googleapis\.com\/fcm\/send\/[A-Za-z0-9_:.%-]{16,512}$/;

export class PreflightError extends Error {}

export function pushKeys(env) {
  if (!env.WEB_PUSH_PUBLIC_KEY || !env.WEB_PUSH_PRIVATE_KEY || !env.WEB_PUSH_SUBJECT) return null;
  return { publicKey: env.WEB_PUSH_PUBLIC_KEY, privateKey: env.WEB_PUSH_PRIVATE_KEY, subject: env.WEB_PUSH_SUBJECT };
}

function subscriptionFrom(value) {
  const endpoint = value?.endpoint;
  const keys = value?.keys;
  if (typeof endpoint !== 'string' || !FCM_ENDPOINT.test(endpoint) ||
      typeof keys?.p256dh !== 'string' || !/^B[A-Za-z0-9_-]{86}$/.test(keys.p256dh) ||
      typeof keys?.auth !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(keys.auth)) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, expirationTime: null };
}

async function sendToDevice(message, subscription, keys, request, ttl) {
  const payload = await buildPushPayload({
    data: JSON.stringify({ title: message.title, body: message.message }),
    options: { ttl, urgency: 'high' },
  }, subscription, keys);
  return request(subscription.endpoint, { ...payload, method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(5000) });
}

export async function publishBrowserPush(env, message, request, detail = {}, ttl = 21600) {
  const keys = pushKeys(env);
  if (!keys) return 'failed';
  const { results } = await env.DB.prepare(
    'SELECT subscription FROM browser_push_subscriptions ORDER BY endpoint LIMIT ?',
  ).bind(MAX_DEVICES).all();
  if (!results.length) return 'failed';
  const outcomes = await Promise.all(results.map(async ({ subscription }) => {
    try {
      const device = subscriptionFrom(JSON.parse(subscription));
      if (!device) return 'failed';
      const response = await sendToDevice(message, device, keys, request, ttl);
      if (response.ok) return 'sent';
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
  if (path !== '/push/subscription' && path !== '/push/test') return reply({ error: 'not_found' }, 404);
  if (request.method !== 'POST' && request.method !== 'DELETE') return reply({ error: 'method_not_allowed' }, 405);
  const reader = request.body?.getReader();
  let subscription;
  let enrollment;
  try {
    let body = '';
    const decoder = new TextDecoder();
    let length = 0;
    if (!reader) return reply({ error: 'invalid_subscription' }, 400);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2048) {
        await reader.cancel();
        return reply({ error: 'invalid_subscription' }, 400);
      }
      body += decoder.decode(value, { stream: true });
    }
    const input = JSON.parse(body + decoder.decode());
    subscription = subscriptionFrom(input.subscription);
    enrollment = input.enrollment;
  } catch {
    return reply({ error: 'invalid_subscription' }, 400);
  }
  if (!subscription) return reply({ error: 'invalid_subscription' }, 400);
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
      ).bind(subscription.endpoint, serialized, MAX_DEVICES).run();
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
