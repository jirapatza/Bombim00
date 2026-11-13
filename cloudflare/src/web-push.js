// RFC 8291 + RFC 8292 Web Push, using Cloudflare Workers' native Web Crypto.
// No third-party paid gateway and no Node.js dependencies.
const te = new TextEncoder();
const ascii = s => te.encode(s);
const bytes = (...items) => {
  const arrays = items.map(v => typeof v === 'string' ? ascii(v) : v);
  const output = new Uint8Array(arrays.reduce((n, b) => n + b.length, 0));
  let offset = 0;
  for (const data of arrays) { output.set(data, offset); offset += data.length; }
  return output;
};
export const base64url = data => btoa(String.fromCharCode(...new Uint8Array(data)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unbase64url = str => Uint8Array.from(
  atob(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - str.length % 4) % 4)),
  c => c.charCodeAt(0),
);

export const WEB_PUSH_DDL = [
  'CREATE TABLE IF NOT EXISTS web_push_keys (id INTEGER PRIMARY KEY CHECK (id=1), public_key TEXT NOT NULL, private_jwk TEXT NOT NULL, created_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS web_push_subscriptions (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_success_at TEXT, last_error_code TEXT)',
];

export async function initializeWebPush(db) {
  for (const statement of WEB_PUSH_DDL) await db.prepare(statement).run();
  let keys = await db.prepare('SELECT public_key FROM web_push_keys WHERE id=1').first();
  if (!keys) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const publicKey = base64url(await crypto.subtle.exportKey('raw', pair.publicKey));
    const privateJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey));
    await db.prepare('INSERT OR IGNORE INTO web_push_keys (id, public_key, private_jwk, created_at) VALUES (1, ?, ?, ?)')
      .bind(publicKey, privateJwk, new Date().toISOString()).run();
    keys = await db.prepare('SELECT public_key FROM web_push_keys WHERE id=1').first();
  }
  return keys.public_key;
}

// Do not allow an arbitrary subscription URL to become a free SSRF proxy.
export function validPushEndpoint(url) {
  if (typeof url !== 'string' || url.length > 1200) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.hash &&
      (host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' ||
       host.endsWith('.push.services.mozilla.com') || host === 'web.push.apple.com' ||
       host.endsWith('.push.apple.com') || host === 'notify.windows.com' ||
       host.endsWith('.notify.windows.com'));
  } catch { return false; }
}
export function validPushSubscription(x) {
  if (!x || typeof x !== 'object' || !validPushEndpoint(x.endpoint) || !x.keys ||
      typeof x.keys.p256dh !== 'string' || typeof x.keys.auth !== 'string') return false;
  try { return unbase64url(x.keys.p256dh).length === 65 &&
      unbase64url(x.keys.auth).length === 16 && unbase64url(x.keys.p256dh)[0] === 4; }
  catch { return false; }
}
export async function subscriptionId(endpoint) {
  return base64url(await crypto.subtle.digest('SHA-256', ascii(endpoint)));
}
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
async function encryptPayload(subscription, payload) {
  const recipient = unbase64url(subscription.p256dh);
  const auth = unbase64url(subscription.auth);
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const recipientKey = await crypto.subtle.importKey('raw', recipient, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientKey }, ephemeral.privateKey, 256));
  const secret = await hmac(auth, shared);
  const ikm = await hmac(secret, bytes('WebPush: info', Uint8Array.of(0), recipient, senderPublic, Uint8Array.of(1)));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, bytes('Content-Encoding: aes128gcm', Uint8Array.of(0, 1)))).slice(0, 16);
  const nonce = (await hmac(prk, bytes('Content-Encoding: nonce', Uint8Array.of(0, 1)))).slice(0, 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // RFC 8188 final record delimiter 0x02 is required, even with zero padding.
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aes, bytes(ascii(payload), Uint8Array.of(2))));
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  return bytes(salt, recordSize, Uint8Array.of(65), senderPublic, encrypted);
}
async function vapidAuthorization(url, privateJson, publicKey) {
  const jwk = JSON.parse(privateJson);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = base64url(ascii(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64url(ascii(JSON.stringify({
    aud: new URL(url).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'https://bombim00.pages.dev',
  })));
  const input = header + '.' + claims;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, ascii(input));
  return 'vapid t=' + input + '.' + base64url(signature) + ', k=' + publicKey;
}

export async function sendWebPush(subscription, message, keys, request, detail = {}) {
  if (!validPushSubscription({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }))
    { detail.code = 'invalid_subscription'; return 'failed'; }
  try {
    const body = await encryptPayload(subscription, JSON.stringify(message).slice(0, 2400));
    const response = await request(subscription.endpoint, {
      method: 'POST', timeoutMs: 8000,
      headers: {
        Authorization: await vapidAuthorization(subscription.endpoint, keys.private_jwk, keys.public_key),
        'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm',
        TTL: '3600', Urgency: 'normal',
      },
      body,
    });
    detail.code = 'http_' + response.status;
    try { void response.body?.cancel()?.catch(() => {}); } catch { /* no-op */ }
    if (response.status >= 200 && response.status < 300) return 'sent';
    if ([400, 401, 403, 404, 410, 413, 429].includes(response.status)) return 'failed';
    return 'uncertain'; // 5xx may occur after acceptance: never blindly resend.
  } catch (e) {
    detail.code = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : 'network';
    return 'uncertain';
  }
}
