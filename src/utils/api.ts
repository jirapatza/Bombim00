/**
 * The server remembers sign-in using an HttpOnly cookie. No password is stored
 * in JavaScript, browser storage, URLs, or repository files.
 */
export async function loginDashboard(password: string): Promise<void> {
  const response = await apiFetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
  }
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, credentials: 'same-origin' });
}
