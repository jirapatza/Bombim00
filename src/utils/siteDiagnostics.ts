/**
 * Privacy-safe diagnostic events. Never send error messages, stacks, URLs,
 * credentials, form contents or user identifiers to analytics.
 */
export type DiagnosticEvent = 'frontend_started' | 'frontend_runtime_error' | 'frontend_promise_error' | 'frontend_render_error';
type PostHogStub = { capture: (event: string, properties?: Record<string, string>) => void };

export function trackDiagnostic(event: DiagnosticEvent, area: 'app' | 'widget' | 'window' = 'app'): void {
  if (typeof window === 'undefined') return;
  try {
    (window as Window & { posthog?: PostHogStub }).posthog?.capture(event, { area });
  } catch {
    // Analytics must never interfere with app functionality.
  }
}
