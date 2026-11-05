import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../cloudflare/lottery-data-worker.js';

const originalFetch = globalThis.fetch;

function encodeJson(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function githubFile(value) {
  return new Response(
    JSON.stringify({ type: 'file', encoding: 'base64', content: encodeJson(value) }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

test('live data endpoint reads only allowlisted runtime JSON and never returns settings', async () => {
  const requested = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    requested.push({
      path: url.pathname,
      ref: url.searchParams.get('ref'),
      authorization: new Headers(init.headers).get('Authorization'),
    });
    const filePath = url.pathname.split('/contents/')[1];
    const values = {
      'data/all_lotteries.json': [{ id: 'one', name: 'หวยทดสอบ' }],
      'lottery_previous_results.json': [{ ชื่อหวย: 'หวยทดสอบ', เลขบน_3_ตัว: '123' }],
      'status/status.json': { system_status: 'healthy', total_checks: 12, recent_logs: [{ message: 'ok' }] },
    };
    assert.ok(Object.hasOwn(values, filePath), `unexpected file read: ${filePath}`);
    return githubFile(values[filePath]);
  };

  try {
    const response = await worker.fetch(
      new Request('https://worker.example/api/live-data', {
        headers: { Origin: 'https://dashboard.example' },
      }),
      { GITHUB_TOKEN: 'test-token', ALLOWED_ORIGIN: 'https://dashboard.example' }
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload.catalog, [{ id: 'one', name: 'หวยทดสอบ' }]);
    assert.equal(payload.results[0].เลขบน_3_ตัว, '123');
    assert.equal(payload.status.system_status, 'healthy');
    assert.equal(Object.hasOwn(payload, 'settings'), false);
    assert.equal(requested.length, 3);
    assert.ok(requested.every((item) => item.ref === 'runtime-live'));
    assert.ok(requested.every((item) => item.authorization === 'Bearer test-token'));
    assert.deepEqual(
      requested.map((item) => item.path.split('/contents/')[1]).sort(),
      ['data/all_lotteries.json', 'lottery_previous_results.json', 'status/status.json'].sort()
    );
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://dashboard.example');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live data endpoint fails closed when its server-side GitHub secret is missing', async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('must not call GitHub');
  };

  try {
    const response = await worker.fetch(
      new Request('https://worker.example/api/live-data'),
      {}
    );
    assert.equal(response.status, 503);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live data endpoint rejects unapproved browser origins', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/api/live-data', {
      headers: { Origin: 'https://unexpected.example' },
    }),
    { ALLOWED_ORIGIN: 'https://dashboard.example' }
  );
  assert.equal(response.status, 403);
});

test('live data endpoint is read-only', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/api/live-data', { method: 'POST' }),
    { GITHUB_TOKEN: 'test-token' }
  );
  assert.equal(response.status, 405);
});
