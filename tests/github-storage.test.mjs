import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNoSecretFields,
  commitGitHubJson,
  GitHubStorageError,
  readGitHubJson,
} from '../server/githubStorage.ts';

test('reads the latest JSON from the configured public repository', async () => {
  let requestedUrl = '';
  const data = { app_name: 'Bombim00' };
  const result = await readGitHubJson('config/settings.json', {
    repo: 'jirapatza/Bombim00',
    branch: 'main',
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify(data), { status: 200 });
    },
  });
  assert.deepEqual(result, data);
  assert.match(requestedUrl, /raw\.githubusercontent\.com\/jirapatza\/Bombim00/);
});

test('allows the latest GitHub Actions runtime status file to be read', async () => {
  const result = await readGitHubJson('status/status.json', {
    repo: 'jirapatza/Bombim00',
    branch: 'main',
    fetchImpl: async () => new Response(JSON.stringify({ system_status: 'healthy' }), { status: 200 }),
  });
  assert.deepEqual(result, { system_status: 'healthy' });
});

test('commits JSON with the current blob SHA and keeps the token out of the payload', async () => {
  const calls = [];
  const sha = await commitGitHubJson('config/settings.json', { app_name: 'Bombim00' }, 'test settings update', {
    repo: 'jirapatza/Bombim00',
    branch: 'main',
    token: 'test-secret-token',
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (init.method !== 'PUT') return new Response(JSON.stringify({ sha: 'blob-sha' }), { status: 200 });
      return new Response(JSON.stringify({ commit: { sha: 'commit-sha' } }), { status: 200 });
    },
  });
  assert.equal(sha, 'commit-sha');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.method, 'PUT');
  assert.equal(JSON.parse(calls[1].init.body).sha, 'blob-sha');
  assert.equal(calls[1].init.body.includes('test-secret-token'), false);
  assert.equal(calls[1].init.headers.Authorization, 'Bearer test-secret-token');
});

test('does not attempt writes when the Render GitHub token is missing', async () => {
  await assert.rejects(
    commitGitHubJson('config/settings.json', {}, 'test', { token: '', fetchImpl: async () => { throw new Error('must not call fetch'); } }),
    (error) => error instanceof GitHubStorageError && error.code === 'GITHUB_TOKEN_MISSING' && error.status === 503,
  );
});

test('rejects secret-like settings fields before they can be committed publicly', () => {
  assert.throws(
    () => assertNoSecretFields({ channels: { ntfy: { topic: 'public-topic' }, line_token: 'do-not-commit' } }),
    (error) => error instanceof GitHubStorageError && error.code === 'SECRET_FIELD_NOT_ALLOWED',
  );
  assert.doesNotThrow(() => assertNoSecretFields({ channels: { ntfy: { topic: 'public-topic' }, line: { token: '' } } }));
});

test('allows durable system audit history but rejects arbitrary paths', async () => {
  const result = await readGitHubJson('status/self_healing_history.json', {
    repo: 'jirapatza/Bombim00',
    branch: 'main',
    fetchImpl: async () => new Response('[]', { status: 200 }),
  });
  assert.deepEqual(result, []);
  await assert.rejects(
    readGitHubJson('status/other.json', { fetchImpl: async () => { throw new Error('must not fetch'); } }),
    (error) => error instanceof GitHubStorageError && error.code === 'INVALID_DATA_PATH',
  );
});
