/**
 * Same-origin API helper. Dashboard credentials live only in this browser tab's session.
 */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (typeof window !== 'undefined') {
    try {
      const password = window.sessionStorage.getItem('bombim00_dashboard_password') || '';
      if (password) headers.set('Authorization', `Bearer ${password}`);
    } catch {
      // Storage may be unavailable; protected writes fail safely on the server.
    }
  }
  return fetch(input, { ...init, headers });
}
