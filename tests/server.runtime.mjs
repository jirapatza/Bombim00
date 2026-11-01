import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('production server validates auth, removed endpoints and real checker failures', { timeout: 15000 }, async () => {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    // Python must not run live feeds or send notifications in this smoke test.
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production', DASH_PASSWORD: 'test-secret', GITHUB_TOKEN: '', DISABLE_BACKGROUND_CHECK: 'true', PATH: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', data => { output += data; });
  server.stderr.on('data', data => { output += data; });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(output);
      ready = await fetch(`${base}/api/health`).then(r => r.ok).catch(() => false);
      if (ready) break;
      await delay(50);
    }
    assert.ok(ready, output);
    const post = (path, body = {}, auth = true) => fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test-secret' } : {}) },
      body: JSON.stringify(body),
    });
    assert.equal((await post('/api/trigger', {}, false)).status, 401);
    assert.equal((await post('/api/trigger', { lotteryTarget: 'invalid' })).status, 400);
    assert.equal((await post('/api/settings', {})).status, 503);
    assert.equal((await post('/api/all-lotteries', [])).status, 503);
    for (const path of ['/api/github/workflow', '/api/github/get-remote-file', '/api/github/commit-file']) {
      const response = await post(path);
      assert.equal(response.status, 404);
      assert.match(response.headers.get('content-type'), /json/);
    }
    for (const path of ['/api/trigger', '/api/check-now', '/api/simulate-runner']) {
      const response = await post(path);
      assert.equal(response.status, 502, path);
      const result = await response.json();
      assert.equal(result.success, false);
      assert.match(result.error, /python3/);
    }
    assert.match(await (await fetch(base)).text(), /<div id="root">/);
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await once(server, 'exit');
    }
  }
});
