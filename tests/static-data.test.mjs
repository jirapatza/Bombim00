import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('lottery catalog has unique IDs and required display fields', async () => {
  const catalog = await readJson('../data/all_lotteries.json');
  assert.ok(Array.isArray(catalog) && catalog.length > 0, 'catalog must be a non-empty array');

  const ids = new Set();
  for (const item of catalog) {
    assert.equal(typeof item.id, 'string');
    assert.ok(item.id.trim().length > 0);
    assert.ok(!ids.has(item.id), `duplicate lottery ID: ${item.id}`);
    ids.add(item.id);
    assert.equal(typeof item.name, 'string');
    assert.ok(item.name.trim().length > 0);
    assert.equal(typeof item.closeTimeStr, 'string');
  }
});

test('historical results are valid named records', async () => {
  const results = await readJson('../lottery_previous_results.json');
  assert.ok(Array.isArray(results), 'history must be an array');
  assert.ok(results.length > 0, 'history must not be empty');

  for (const row of results) {
    assert.ok(row && typeof row === 'object' && !Array.isArray(row));
    assert.ok(
      (typeof row['ชื่อหวย'] === 'string' && row['ชื่อหวย'].trim()) ||
      (typeof row['หวย'] === 'string' && row['หวย'].trim()),
      'each result must identify its lottery'
    );
  }
});

test('settings and status JSON expose required top-level structure', async () => {
  const settings = await readJson('../config/settings.json');
  const status = await readJson('../status/status.json');

  assert.ok(settings.sources && typeof settings.sources === 'object');
  assert.ok(settings.channels?.ntfy && typeof settings.channels.ntfy.enabled === 'boolean');
  assert.ok(['healthy', 'degraded', 'error'].includes(status.system_status));
  assert.equal(typeof status.status_message, 'string');
});
