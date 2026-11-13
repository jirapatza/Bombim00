import { initializeWebPush, subscriptionId, validPushSubscription, validPushEndpoint } from '../../../cloudflare/src/web-push.js';

const MAX_DEVICES = 8;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function originAllowed(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const site = request.headers.get('Sec-Fetch-Site');
  return url.hostname === 'bombim00.pages.dev' &&
    url.protocol === 'https:' && origin === url.origin &&
    (!site || site === 'same-origin');
}
const error = (reason, status = 400) => Response.json({ ok: false, reason }, { status, headers });
async function parse(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return null;
  const body = await request.text();
  if (body.length > 2500) return null;
  try { return JSON.parse(body); } catch { return null; }
}

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return error('origin_not_allowed', 403);
  if (!env.PUSH_DB) return error('unavailable', 503);
  const subscription = await parse(request);
  if (!validPushSubscription(subscription)) return error('invalid_subscription');
  try {
    await initializeWebPush(env.PUSH_DB);
    const id = await subscriptionId(subscription.endpoint);
    const existing = await env.PUSH_DB.prepare('SELECT id FROM web_push_subscriptions WHERE id=?').bind(id).first();
    if (!existing) {
      const total = await env.PUSH_DB.prepare('SELECT COUNT(*) AS n FROM web_push_subscriptions').first();
      if (total.n >= MAX_DEVICES) return error('device_limit', 429);
    }
    // No third-party endpoint is accepted outside browser push service allowlist.
    const now = new Date().toISOString();
    await env.PUSH_DB.prepare(
      'INSERT INTO web_push_subscriptions (id, endpoint, p256dh, auth, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth, updated_at=excluded.updated_at, last_error_code=NULL'
    ).bind(id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, now, now).run();
    return Response.json({ ok: true }, { status: 201, headers });
  } catch { return error('unavailable', 503); }
}

export async function onRequestDelete({ request, env }) {
  if (!originAllowed(request)) return error('origin_not_allowed', 403);
  if (!env.PUSH_DB) return error('unavailable', 503);
  const payload = await parse(request);
  if (!payload || !validPushEndpoint(payload.endpoint)) return error('invalid_subscription');
  try {
    const id = await subscriptionId(payload.endpoint);
    await env.PUSH_DB.prepare('DELETE FROM web_push_subscriptions WHERE id=?').bind(id).run();
    return Response.json({ ok: true }, { headers });
  } catch { return error('unavailable', 503); }
}
