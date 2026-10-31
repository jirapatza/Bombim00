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

test('Worker accepts a valid dashboard password in the Bearer header', async () => {
  const response = await worker.fetch(
    makeRequest({ Authorization: 'Bearer correct-dashboard-password' }),
    { DASH_PASSWORD: 'correct-dashboard-password' },
  );
  assert.equal(response.status, 200);
});

test('Worker rejects an incorrect dashboard password', async () => {
  const response = await worker.fetch(
    makeRequest({ Authorization: 'Bearer wrong-password' }),
    { DASH_PASSWORD: 'correct-dashboard-password' },
  );
  assert.equal(response.status, 401);
});
