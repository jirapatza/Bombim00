import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export const sessionCookieName = (production: boolean) => production ? '__Host-dashboard-session' : 'dashboard-session';

function signature(payload: string, password: string): string {
  return createHmac('sha256', password).update('bombim00-dashboard-session-v1:').update(payload).digest('base64url');
}

export function createSession(password: string, now = Date.now()): string {
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(24).toString('base64url')}`;
  return `${payload}.${signature(payload, password)}`;
}

export function validSession(token: string, password: string, now = Date.now()): boolean {
  if (!password || !/^\d{10}\.[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [expires, nonce, supplied] = token.split('.');
  const remaining = Number(expires) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > SESSION_SECONDS) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(signature(`${expires}.${nonce}`, password)));
}

export function readSessionCookie(header: string, name: string): string {
  return header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}
