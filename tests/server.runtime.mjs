import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('foreground assistance checks real run state and prevents duplicate dispatch across clients', { timeout: 15000 }, async () => {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const base = `http://127.0.0.1:${port}`;
  const fixture = `
    let reads = 0;
    globalThis.fetch = async (url, init) => {
      if (String(url).endsWith('/dispatches')) { console.log('FIXTURE_DISPATCH'); return new Response(null, { status: 204 }); }
      if (String(url).includes('/actions/workflows/lottery.yml/runs')) {
        reads++;
        if (reads === 1) return new Response('{}', { status: 503 });
        const recent = { id: 1, status: 'completed', conclusion: 'success', created_at: new Date().toISOString() };
        const runs = reads === 2 ? [{ ...recent, status: 'in_progress' }] : reads === 3 ? [recent] : [];
        await new Promise(resolve => setTimeout(resolve, 50));
        return Response.json({ workflow_runs: runs });
      }
      throw new Error('Unexpected network call in isolated fixture');
    };
  `;
  const server = spawn(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(fixture), 'server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production', DASH_PASSWORD: 'test-secret', GITHUB_TOKEN: 'fixture-token', LOTTERY_DISPATCH_ASSIST_ENABLED: 'false', PATH: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; server.stdout.on('data', data => { output += data; }); server.stderr.on('data', data => { output += data; });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(output);
      ready = await fetch(base + '/api/health').then(r => r.ok).catch(() => false);
      if (ready) break;
      await delay(50);
    }
    assert.ok(ready, output);
    const post = (extra = {}) => fetch(base + '/api/github/dispatch', {
      method: 'POST', headers: { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({ automatic: true, inputs: { lottery_target: 'all', force_notify: 'false' }, ...extra }),
    });
    assert.equal((await post()).status, 502, 'unknown run state must not trigger a job');
    assert.equal((await (await post()).json()).skipped, true, 'active job must not be queued twice');
    assert.equal((await (await post()).json()).skipped, true, 'recent completed job must not be repeated');
    const responses = await Promise.all([post(), post()]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const accepted = await responses.find(r => r.status === 200).json();
    assert.equal(accepted.queued, true);
    assert.ok(accepted.request_id);
    assert.equal((await (await post()).json()).skipped, true, 'shared guard must cover other clients');
    assert.equal((output.match(/FIXTURE_DISPATCH/g) || []).length, 1);
    assert.equal((await post({ inputs: { lottery_target: 'all', force_notify: 'true' } })).status, 400);
  } finally {
    if (server.exitCode === null) { server.kill(); await once(server, 'exit'); }
  }
});

test('production API protects writes and exposes only the single GitHub Actions runner', { timeout: 15000 }, async () => {
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
      PATH: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (data) => { output += data; });
  server.stderr.on('data', (data) => { output += data; });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(output);
      ready = await fetch(`${base}/api/health`).then((r) => r.ok).catch(() => false);
      if (ready) break;
      await delay(50);
    }
    assert.ok(ready, output);

    const post = (path, body = {}, auth = true) => fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: 'Bearer test-secret' } : {}),
      },
      body: JSON.stringify(body),
    });

    assert.equal((await post('/api/settings', {}, false)).status, 401);
    assert.equal((await post('/api/settings', {})).status, 503);
    assert.equal((await post('/api/github/dispatch', {})).status, 503);
    assert.equal((await post('/api/test-line', {})).status, 404);
    assert.equal((await post('/api/system/self-heal', {})).status, 503);
    assert.equal((await post('/api/test-ntfy', { topic: 'bad/topic' })).status, 400);

    for (const path of [
      '/api/trigger',
      '/api/check-now',
      '/api/simulate-runner',
      '/api/github/workflow',
      '/api/github/get-remote-file',
      '/api/github/commit-file',
      '/api/project-files',
      '/api/system/audit',
      '/api/system/audit-history',
    ]) {
      const response = await post(path);
      assert.equal(response.status, 404, path);
      assert.match(response.headers.get('content-type'), /json/);
    }

    const health = await (await fetch(`${base}/api/health`, { headers: { Authorization: 'Bearer test-secret' } })).json();
    assert.equal(health.ok, true);
    assert.equal(health.writesEnabled, false);
    assert.equal(health.githubTokenConfigured, false);
    assert.equal(health.dashboardAuthConfigured, true);
    assert.match(await (await fetch(base)).text(), /เว็บไซต์ส่วนตัว/);
    assert.equal((await fetch(`${base}/api/status`)).status, 401);
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await once(server, 'exit');
    }
  }
});

test('awake server requests one stale check without a browser and shares the client guard', { timeout: 15000 }, async () => {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const base = `http://127.0.0.1:${port}`;
  const fixture = `
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('/dispatches')) { console.log('ASSIST_DISPATCH'); return new Response(null, { status: 204 }); }
      if (String(url).includes('/actions/workflows/lottery.yml/runs')) return Response.json({ workflow_runs: [] });
      throw new Error('Unexpected network call');
    };
  `;
  const server = spawn(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(fixture), 'server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production', DASH_PASSWORD: 'test-secret', GITHUB_TOKEN: 'fixture-token', LOTTERY_DISPATCH_ASSIST_ENABLED: 'true', PATH: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; server.stdout.on('data', data => { output += data; }); server.stderr.on('data', data => { output += data; });
  try {
    for (let i = 0; i < 100 && !output.includes('[DISPATCH_ASSIST] Requested'); i++) {
      if (server.exitCode !== null) throw new Error(output);
      await delay(50);
    }
    assert.ok(output.includes('[DISPATCH_ASSIST] Requested'), output);
    const response = await fetch(base + '/api/github/dispatch', {
      method: 'POST', headers: { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({ automatic: true }),
    });
    assert.equal((await response.json()).skipped, true);
    assert.equal((output.match(/ASSIST_DISPATCH/g) || []).length, 1);
    assert.equal((await fetch(base + '/api/github/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  } finally {
    if (server.exitCode === null) { server.kill(); await once(server, 'exit'); }
  }
});

test('ntfy test API publishes structured JSON at root instead of displaying JSON as text', {timeout:15000}, async()=>{
 const port=30000+Math.floor(Math.random()*20000);const base=`http://127.0.0.1:${port}`;
 const fixture=`globalThis.fetch=async(url,init)=>{console.log('NTFY_CAPTURE '+JSON.stringify({url:String(url),payload:JSON.parse(init.body)}));return Response.json({id:'fixture'});};`;
 const server=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(fixture),'server.js'],{
  cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),NODE_ENV:'production',DASH_PASSWORD:'test-secret',GITHUB_TOKEN:'',NTFY_SERVER:'https://ntfy.sh',PATH:''},stdio:['ignore','pipe','pipe']});
 let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
 try{
  let ready=false;for(let i=0;i<100;i++){ready=await fetch(base+'/api/health').then(r=>r.ok).catch(()=>false);if(ready)break;await delay(50);}assert.ok(ready,output);
  const response=await fetch(base+'/api/test-ntfy',{method:'POST',headers:{Authorization:'Bearer test-secret','Content-Type':'application/json'},body:JSON.stringify({topic:'test-topic',title:'ผลทดสอบ',message:'ลาวพัฒนา\n007 - 00'})});
  assert.equal(response.status,200,await response.text());
  const captured=JSON.parse(output.split('\n').find(line=>line.startsWith('NTFY_CAPTURE ')).slice('NTFY_CAPTURE '.length));
  assert.equal(captured.url,'https://ntfy.sh/');assert.equal(captured.payload.topic,'test-topic');assert.equal(captured.payload.message,'ลาวพัฒนา\n007 - 00');
 }finally{if(server.exitCode===null){server.kill();await once(server,'exit');}}
});
