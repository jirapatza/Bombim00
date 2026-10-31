/**
 * Authenticated same-origin API helper.
 * The dashboard password is stored by the existing Worker connection flow.
 */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (typeof window !== 'undefined') {
    const password = window.localStorage.getItem('cf_dash_password') || '';
    if (password) headers.set('Authorization', `Bearer ${password}`);
  }
  return fetch(input, { ...init, headers });
}
