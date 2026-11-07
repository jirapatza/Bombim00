import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('production notifications have exactly one scheduled writer: Cloudflare', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/lottery.yml', import.meta.url), 'utf8');
  const gate = JSON.parse(readFileSync(new URL('../PRIMARY_CHECKER.json', import.meta.url), 'utf8'));
  assert.deepEqual(gate, { mode: 'cloudflare', legacy_workflow: 'pr-only', poll_seconds: 60 });
  assert.match(workflow, /\bpull_request:\s*\n/);
  for (const trigger of ['schedule:', 'workflow_dispatch:', 'push:']) {
    assert.ok(!workflow.includes(trigger), `GitHub Actions must not contain ${trigger}`);
  }
  for (const operation of ['NTFY_TOPIC', 'lottery_checker.py\n', 'runtime-live', 'FORCE_NOTIFY', 'secrets.']) {
    assert.ok(!workflow.includes(operation), `GitHub Actions must not publish: ${operation}`);
  }
  assert.match(workflow, /\bcheck-lottery:/);
  assert.match(workflow, /pytest tests\//);
});
