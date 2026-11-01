import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../api/worker.js';

const makeRequest = (headers = {}, body = {}) => new Request(
  'https://worker.example/api/simulate-runner',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  },
);

test('Worker rejects writes when DASH_PASSWORD is not configured', async () => {
  const response = await worker.fetch(makeRequest({}, { token: 'arbitrary-token' }), {});
  assert.equal(response.status, 401);
});

test('Worker does not treat a body GitHub token as dashboard authentication', async () => {
  const response = await worker.fetch(
    makeRequest({}, { token: 'ghp_example_token' }),
    { DASH_PASSWORD: 'correct-dashboard-password' },
  );
  assert.equal(response.status, 401);
});

test('Worker authenticates but reports Python execution as unsupported', async () => {
  const response = await worker.fetch(
    makeRequest({ Authorization: 'Bearer correct-dashboard-password' }),
    { DASH_PASSWORD: 'correct-dashboard-password' },
  );
  assert.equal(response.status, 501);
  assert.equal((await response.json()).success, false);
});

test('Worker rejects an incorrect dashboard password', async () => {
  const response = await worker.fetch(
    makeRequest({ Authorization: 'Bearer wrong-password' }),
    { DASH_PASSWORD: 'correct-dashboard-password' },
  );
  assert.equal(response.status, 401);
});

test('removed editor and builder endpoints are unavailable even to authenticated users', async () => {
  for (const path of ['/api/github/workflow', '/api/github/get-remote-file', '/api/github/commit-file']) {
    for (const method of ['GET', 'POST']) {
      const response = await worker.fetch(new Request(`https://worker.example${path}`, {
        method,
        headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}),
      }), { DASH_PASSWORD: 'secret' });
      assert.equal(response.status, 404, `${method} ${path}`);
    }
  }
});

