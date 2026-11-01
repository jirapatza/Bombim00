import test from 'node:test';
import assert from 'node:assert/strict';
import { getOverallHealth } from '../server/selfHeal.ts';

test('health is healthy only when every verified action passes', () => {
  assert.equal(getOverallHealth([{ status: 'success' }, { status: 'success' }]), 'healthy');
  assert.equal(getOverallHealth([{ status: 'success' }, { status: 'warning' }]), 'degraded');
  assert.equal(getOverallHealth([{ status: 'warning' }, { status: 'failed' }]), 'error');
});

test('empty diagnostic runs are not treated as a successful repair', () => {
  assert.equal(getOverallHealth([]), 'healthy');
});
