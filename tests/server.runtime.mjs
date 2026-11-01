import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('production server exposes one GitHub Actions runner and rejects legacy local runner routes', { timeout: 15000 }, async () => {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      DASH_PASSWORD: 'test-secret',
      GITHUB_TOKEN: '',
      LINE_CHANNEL_ACCESS_TOKEN: '',
      LINE_TARGET_ID: '',
    },
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

    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.writesEnabled, false);

    assert.equal((await post('/api/github/dispatch', {}, false)).status, 401);
    assert.equal((await post('/api/github/dispatch')).status, 503);
    assert.equal((await post('/api/test-line')).status, 503);
    assert.equal((await post('/api/settings', { app_name: 'test' })).status, 503);

    for (const path of [
      '/api/trigger',
      '/api/check-now',
      '/api/simulate-runner',
      '/api/github/workflow',
      '/api/github/get-remote-file',
      '/api/github/commit-file',
      '/api/project-files',
    ]) {
      const response = await post(path);
      assert.equal(response.status, 404, path);
      assert.match(response.headers.get('content-type'), /json/);
    }

    const runs = await fetch(`${base}/api/github/runs`, { method: 'POST' });
    assert.equal(runs.status, 200);
    const runsData = await runs.json();
    assert.equal(runsData.success, true);
    assert.ok(Array.isArray(runsData.workflow_runs));

    assert.match(await (await fetch(base)).text(), /<div id="root">/);
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await once(server, 'exit');
    }
  }
});
