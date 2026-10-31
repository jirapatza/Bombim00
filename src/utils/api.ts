/**
 * Authenticated same-origin API helper.
 * The dashboard password is stored by the existing Worker connection flow.
 */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (typeof window !== 'undefined') {
    try {
      const password = window.localStorage.getItem('cf_dash_password') || '';
      if (password) headers.set('Authorization', `Bearer ${password}`);
    } catch {
      // Storage can be unavailable in restricted browser contexts; the API will reject writes safely.
    }
  }
  return fetch(input, { ...init, headers });
}
