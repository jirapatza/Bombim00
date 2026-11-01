/**
 * Same-origin API helper. Dashboard credentials remain in memory only.
 * They are never written to browser storage, URLs, or repository files.
 */
let dashboardPassword = '';

export function setDashboardPassword(value: string): void {
  dashboardPassword = value.trim();
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (dashboardPassword) headers.set('Authorization', `Bearer ${dashboardPassword}`);
  return fetch(input, { ...init, headers });
}
