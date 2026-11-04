import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { installDashboardAuth } from '../server/dashboardAuth.ts';
import { createSession, validSession, SESSION_SECONDS } from '../server/dashboardSession.ts';

test('session expires, rejects tampering and is invalidated by password rotation', () => {
  const now = Date.now();
  const token = createSession('test-password', now);
  assert.equal(validSession(token, 'test-password', now + 1000), true);
  assert.equal(validSession(token, 'test-password', now + SESSION_SECONDS * 1000), false);
  assert.equal(validSession(token, 'changed-password', now), false);
  assert.equal(validSession(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), 'test-password', now), false);
  assert.equal(validSession('malformed', 'test-password', now), false);
});

test('private website requires login, remembers across server instances, blocks CSRF and logs out', async () => {
  process.env.NODE_ENV = 'production';
  process.env.DASH_PASSWORD = 'test-password';
  const app = express();
  app.use(express.json());
  installDashboardAuth(app, express.urlencoded({ extended: false }));
  app.get('/api/health', (_req, res) => res.json({ ok: true, private: true }));
  app.get('/api/status', (_req, res) => res.json({ private: true }));
  app.post('/api/settings', (_req, res) => res.json({ success: true }));
  app.get('*', (_req, res) => res.send('PRIVATE APP'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const origin = base.replace('http:', 'https:');
  const login = (password, extra = {}) => fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...extra }, body: JSON.stringify({ password }),
  });
  try {
    assert.match(await (await fetch(base)).text(), /เว็บไซต์ส่วนตัว/);
    assert.equal((await fetch(`${base}/api/status`)).status, 401);
    assert.match(await (await fetch(`${base}/assets/private.js`)).text(), /เว็บไซต์ส่วนตัว/);
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, status: 'locked' });
    assert.equal((await login('wrong')).status, 401);
    assert.equal((await login('test-password', { Origin: 'https://evil.example' })).status, 403);
    const response = await login('test-password');
    assert.equal(response.status, 200);
    const setCookie = response.headers.get('set-cookie');
    for (const pattern of [/HttpOnly/, /Secure/, /SameSite=Lax/, /Max-Age=2592000/, /Path=\//, /__Host-dashboard-session=/]) assert.match(setCookie, pattern);
    assert.ok(!setCookie.includes('test-password'));
    const Cookie = setCookie.split(';')[0];
    assert.equal(await (await fetch(base, { headers: { Cookie } })).text(), 'PRIVATE APP');
    assert.deepEqual(await (await fetch(`${base}/api/auth/session`, { headers: { Cookie } })).json(), { authenticated: true });
    assert.equal((await fetch(`${base}/api/settings`, { method: 'POST', headers: { Cookie, Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(`${base}/api/settings`, { method: 'POST', headers: { Cookie } })).status, 403);
    assert.equal((await fetch(`${base}/api/settings`, { method: 'POST', headers: { Cookie, Origin: origin } })).status, 200);
    const secondApp = express();
    installDashboardAuth(secondApp, express.urlencoded({ extended: false }));
    secondApp.get('*', (_req, res) => res.send('AFTER RESTART'));
    const secondServer = secondApp.listen(0, '127.0.0.1');
    await new Promise(resolve => secondServer.once('listening', resolve));
    try {
      assert.equal(await (await fetch(`http://127.0.0.1:${secondServer.address().port}/`, { headers: { Cookie } })).text(), 'AFTER RESTART');
    } finally { await new Promise(resolve => secondServer.close(resolve)); }
    const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie, Origin: origin } });
    assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    assert.match(await (await fetch(base)).text(), /เว็บไซต์ส่วนตัว/);
    for (let i = 0; i < 10; i++) assert.equal((await login('wrong')).status, 401);
    assert.equal((await login('test-password')).status, 429);
    let limited;
    for (let i = 0; i < 301; i++) {
      limited = await fetch(`${base}/api/auth/session`);
      if (limited.status === 429) break;
    }
    assert.equal(limited.status, 429, 'global limiter must run before authentication routes');
  } finally {
    await new Promise(resolve => server.close(resolve));
    delete process.env.DASH_PASSWORD;
    delete process.env.NODE_ENV;
  }
});
