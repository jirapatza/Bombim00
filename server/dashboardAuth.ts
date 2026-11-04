import type express from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createSession, validSession, readSessionCookie, sessionCookieName, SESSION_SECONDS } from './dashboardSession.ts';

export function installDashboardAuth(app: express.Express, formParser: express.RequestHandler) {
  // This single-user dashboard shares a quota across clients, so forwarded IP
  // headers cannot bypass the limit. Run it before every authentication handler.
  app.use(rateLimit({ windowMs: 60_000, limit: 300, keyGenerator: () => 'private-dashboard', standardHeaders: 'draft-8', legacyHeaders: false }));
  const production = process.env.NODE_ENV === 'production';
  const cookieName = sessionCookieName(production);
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax' as const, path: '/' };
  const hasSession = (req: express.Request) => validSession(readSessionCookie(req.get('Cookie') || '', cookieName), process.env.DASH_PASSWORD || '');
  const sameOrigin = (req: express.Request) => req.get('Origin') === `${production ? 'https' : req.protocol}://${req.get('Host')}` && req.get('Sec-Fetch-Site') !== 'cross-site';
  const matchesPassword = (value: string) => {
    const expected = Buffer.from(process.env.DASH_PASSWORD || '');
    const supplied = Buffer.from(value);
    return expected.length > 0 && supplied.length === expected.length && timingSafeEqual(supplied, expected);
  };
  const loginPage = (res: express.Response, message = '') => {
    const nonce = randomUUID();
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'` });
    return res.type('html').send(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>เข้าสู่ระบบส่วนตัว · BOMBIM00</title><style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#030b1b;color:#edf4ff;font:18px system-ui,sans-serif}main{width:100%;max-width:420px;padding:32px;border:1px solid #25497a;border-radius:24px;background:#09172f}h1{font-size:28px;margin:0 0 12px}p{color:#a6bbd8;line-height:1.7}label{display:block;margin:24px 0 8px}input,button{width:100%;padding:15px;font:inherit;border-radius:12px}input{background:#030b1b;border:1px solid #436187;color:white}button{margin-top:18px;background:#1765ec;color:white;border:0;cursor:pointer}.error{color:#ffb4b4}small{display:block;line-height:1.7;margin-top:20px;color:#a6bbd8}</style><main><h1>BOMBIM00</h1><p>เว็บไซต์ส่วนตัว<br>กรอกรหัส Dashboard เพื่อเข้าใช้งาน</p>${message ? `<p class="error" role="alert">${message}</p>` : ''}<form method="post" action="/api/auth/login"><label for="password">รหัสผ่าน</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><button type="submit">เข้าสู่ระบบ</button></form></main></html>`);
  };

  app.get('/admin/login', (_req, res) => loginPage(res));
  app.get('/api/auth/session', (req, res) => { res.set('Cache-Control', 'no-store').json({ authenticated: hasSession(req) }); });
  const attempts = new Map<string, { count: number; resetAt: number }>();
  app.post('/api/auth/login', formParser, (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Same-origin request required.' });
    const now = Date.now();
    for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
    const key = req.ip || req.socket.remoteAddress || 'client';
    const attempt = attempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
    if (attempt.count >= 10) return res.status(429).json({ error: 'ลองเข้าสู่ระบบถี่เกินไป กรุณารอ 15 นาที' });
    attempt.count++;
    attempts.set(key, attempt);
    if (!process.env.DASH_PASSWORD) return res.status(503).json({ error: 'Dashboard API is locked: configure DASH_PASSWORD on the server.' });
    if (!matchesPassword(typeof req.body?.password === 'string' ? req.body.password : '')) {
      res.status(401);
      return req.is('application/x-www-form-urlencoded') ? loginPage(res, 'รหัสไม่ถูกต้อง กรุณาลองอีกครั้ง') : res.json({ error: 'รหัส Dashboard ไม่ถูกต้อง' });
    }
    attempts.delete(key);
    res.cookie(cookieName, createSession(process.env.DASH_PASSWORD), { ...cookieOptions, maxAge: SESSION_SECONDS * 1000 });
    return req.is('application/x-www-form-urlencoded') ? res.redirect(303, '/') : res.json({ authenticated: true });
  });
  app.post('/api/auth/logout', (req, res) => {
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Same-origin request required.' });
    res.clearCookie(cookieName, cookieOptions).set('Cache-Control', 'no-store').json({ authenticated: false });
  });

  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Keep Render's probe public without disclosing settings or system details.
    const authorization = req.get('Authorization') || '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : req.get('X-Dashboard-Password') || '';
    if (req.path.startsWith('/api/') && matchesPassword(supplied)) return next();
    if (req.method === 'GET' && req.path === '/api/health' && !hasSession(req)) return res.json({ ok: true, status: 'locked' });
    if (hasSession(req)) {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sameOrigin(req)) return res.status(403).json({ error: 'Same-origin request required.' });
      return next();
    }
    const readOnly = req.method === 'GET' || req.method === 'HEAD';
    const publicPath = ['/', '/index.html', '/sw.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/api/results', '/api/all-lotteries'].includes(req.path) ||
      req.path.startsWith('/assets/');
    if (readOnly && publicPath) return next();
    if (req.path.startsWith('/api/')) return res.status(process.env.DASH_PASSWORD ? 401 : 503).json({ error: 'Dashboard sign-in required.' });
    if (!['GET', 'HEAD'].includes(req.method)) return res.sendStatus(401);
    if (!process.env.DASH_PASSWORD) return res.status(503).type('text').send('Private dashboard is locked: configure DASH_PASSWORD.');
    return loginPage(res);
  });
}
