import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getOverallHealth, preserveCorruptFile } from '../server/selfHeal.ts';

test('corrupt JSON is copied to a timestamped backup without changing the original', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bombim-self-heal-'));
  const settingsPath = path.join(directory, 'settings.json');
  const original = '{ broken json';
  fs.writeFileSync(settingsPath, original);
  try {
    const backup = preserveCorruptFile(settingsPath, new Date('2026-11-02T00:00:00.000Z'));
    assert.ok(backup);
    assert.equal(fs.readFileSync(settingsPath, 'utf8'), original);
    assert.equal(fs.readFileSync(backup, 'utf8'), original);
    assert.match(path.basename(backup), /corrupt-2026-11-02T00-00-00-000Z\.bak$/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('missing files do not produce a backup', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bombim-self-heal-'));
  try {
    assert.equal(preserveCorruptFile(path.join(directory, 'missing.json')), null);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('health is healthy only when every action passes', () => {
  assert.equal(getOverallHealth([{ status: 'success' }, { status: 'success' }]), 'healthy');
  assert.equal(getOverallHealth([{ status: 'success' }, { status: 'warning' }]), 'degraded');
  assert.equal(getOverallHealth([{ status: 'warning' }, { status: 'failed' }]), 'error');
});
