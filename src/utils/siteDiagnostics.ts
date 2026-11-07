/**
 * Minimal anonymous browser health signals for the private dashboard.
 * No SDK, cookies, replay, URL, stack, form data, or persistent user ID.
 * VITE_POSTHOG_PROJECT_TOKEN is a public PostHog project key, not an API secret.
 */
export type DiagnosticEvent =
  | 'frontend_started'
  | 'frontend_runtime_error'
  | 'frontend_promise_error'
  | 'frontend_render_error';

export type DiagnosticArea = 'app' | 'window';

const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN || '';
const configuredHost = import.meta.env.VITE_POSTHOG_HOST || '';
const allowedHosts = new Set(['https://us.i.posthog.com', 'https://eu.i.posthog.com']);
const host = allowedHosts.has(configuredHost.replace(/\/$/, '')) ? configuredHost.replace(/\/$/, '') : '';
const enabled = /^phc_[A-Za-z0-9]+$/.test(token) && Boolean(host);
const sessionId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

export function trackDiagnostic(event: DiagnosticEvent, area: DiagnosticArea = 'app'): void {
  if (!enabled || typeof window === 'undefined' || typeof fetch !== 'function') return;
  // Deliberately accept only an event enum and area enum, never arbitrary error details.
  const body = JSON.stringify({
    api_key: token,
    event,
    distinct_id: sessionId,
    properties: {
      area,
      source: 'bombim00',
      $process_person_profile: false,
      $geoip_disable: true,
      $ip: null,
    },
  });
  try {
    void fetch(host + '/i/v0/e', {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {
      // Diagnostics are best-effort; failures must never break the dashboard.
    });
  } catch {
    // Some browsers/extensions block analytics synchronously.
  }
}

export function installBrowserDiagnostics(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', () => trackDiagnostic('frontend_runtime_error', 'window'));
  window.addEventListener('unhandledrejection', () => trackDiagnostic('frontend_promise_error', 'window'));
  trackDiagnostic('frontend_started');
}
