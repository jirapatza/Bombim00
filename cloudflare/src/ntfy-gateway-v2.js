/**
 * Bombim00 Ntfy Gateway v2.
 *
 * One HTTP POST per call. No automatic retry when a request times out: the
 * receiver may already have accepted the message, so delivery is uncertain.
 * Persistent deduplication, queueing and retry decisions remain in worker.js.
 *
 * This transport does not reset ntfy.sh limits. Topic/subscriber settings are
 * deliberately unchanged during the migration.
 */
export class PreflightError extends Error {}

export const DEFAULT_NTFY_BACKOFF_MS = 60_000;
const MAX_NTFY_BACKOFF_MS = 26 * 60 * 60 * 1_000;
const DEFINITE_REJECTIONS = new Set([400, 401, 403, 404, 413, 422, 429]);

export function retryAfterDelay(header, now = Date.now()) {
  if (!header) return DEFAULT_NTFY_BACKOFF_MS;
  const seconds = Number(header);
  const delay = Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1_000
    : Date.parse(header) - now;
  return Number.isFinite(delay) && delay > 0
    ? Math.min(delay, MAX_NTFY_BACKOFF_MS)
    : DEFAULT_NTFY_BACKOFF_MS;
}

/**
 * ntfy's RateLimit header may declare the remaining request/daily-message
 * budget, e.g. '"messages";r=0;t=3600'. A successful HTTP 200 with zero
 * remaining budget must still be recorded as sent; only future sends pause.
 * This is an optional hint: malformed/missing headers cannot claim a quota.
 */
export function quotaCooldownUntil(header, now = Date.now()) {
  if (!header || typeof header !== 'string') return null;
  const rules = /"(messages|requests)"\s*;\s*r\s*=\s*(\d+)\s*;\s*t\s*=\s*(\d+)/g;
  let latest = 0, match;
  while ((match = rules.exec(header)) !== null) {
    const remaining = Number(match[2]), seconds = Number(match[3]);
    if (remaining !== 0 || !Number.isFinite(seconds) || seconds <= 0) continue;
    latest = Math.max(latest, now + Math.min(seconds * 1_000, MAX_NTFY_BACKOFF_MS));
  }
  return latest > now ? new Date(latest).toISOString() : null;
}

function safeFailureCode(error) {
  if (error?.message === 'request_budget') return 'request_budget';
  if (error?.message === 'https_required') return 'https_required';
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  return 'network';
}

function clickUrl(settings) {
  const configured = settings.channels?.ntfy?.click_url || settings.ntfy?.click_url || '';
  const fallback = 'https://bombim00.pages.dev';
  if (!configured) return fallback;
  try {
    const url = new URL(configured);
    const host = url.hostname.toLowerCase();
    const retired = host === 'bombim00.onrender.com' || host === 'sanook.com' || host.endsWith('.sanook.com');
    return url.protocol === 'https:' && !retired ? url.href : fallback;
  } catch {
    return fallback;
  }
}

/** Return sent|failed|uncertain and only safe metadata in detail. */
export async function publishNtfy(settings, message, topic, request, detail = {}, token = '') {
  const cfg = settings.channels?.ntfy || {};
  const base = String(cfg.server || settings.ntfy?.server || 'https://ntfy.sh').replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) {
    detail.code = 'https_required';
    return 'failed';
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(topic)) {
    detail.code = 'notification_configuration';
    return 'failed';
  }
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await request(base + '/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic, ...message, priority: 4, click: clickUrl(settings) }),
      timeoutMs: 12_000,
    });
    detail.code = `http_${response.status}`;
    // The response status is final even if cancelling its unused stream fails.
    try { void response.body?.cancel()?.catch(() => {}); } catch { /* no-op */ }
    if (response.status === 429) {
      detail.retry_after_until = new Date(Date.now() +
        retryAfterDelay(response.headers?.get('Retry-After'))).toISOString();
    }
    if (response.status === 200) {
      const until = quotaCooldownUntil(response.headers?.get('RateLimit'));
      if (until) detail.quota_until = until;
      return 'sent';
    }
    return DEFINITE_REJECTIONS.has(response.status) ? 'failed' : 'uncertain';
  } catch (error) {
    detail.code = safeFailureCode(error);
    return error instanceof PreflightError ? 'failed' : 'uncertain';
  }
}
