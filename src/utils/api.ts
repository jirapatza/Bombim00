/**
 * Authenticated same-origin API helper.
 * The dashboard password is kept for the current browser session only.
 */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (typeof window !== 'undefined') {
    try {
      let password = window.sessionStorage.getItem('bombim00_dashboard_password') || '';
      if (!password) {
        const legacyPassword = window.localStorage.getItem('cf_dash_password') || '';
        if (legacyPassword) {
          password = legacyPassword;
          window.sessionStorage.setItem('bombim00_dashboard_password', legacyPassword);
          window.localStorage.removeItem('cf_dash_password');
        }
      }
      if (password) headers.set('Authorization', `Bearer ${password}`);
    } catch {
      // Storage may be unavailable; protected writes fail safely on the server.
    }
  }
  return fetch(input, { ...init, headers });
}
