import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { cycle } from '../src/worker.js';
import { POLL_SECONDS, BACKOFF_FAILURES, BACKOFF_MS, nextBackoff, parkedSources, mostlyDown } from '../src/schedule.js';
import { database } from './state-helper.js';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../../data/all_lotteries.json', import.meta.url)));
const now = new Date('2026-11-07T08:00:00Z'), today = '2026-11-07';
const row = { หวย: 'lao_tv', ชื่อหวย: 'ลาว TV', หมวดหวย: 'lao', งวดวันที่: today, วันที่จัดรูปแบบ: today,
  เลขบน_3_ตัว: '007', เลขล่าง_2_ตัว: '90', รางวัลที่_1: '007', เลขท้าย_2_ตัว: '90' };

function fixture(t, collect) {
  const db = database(); t.after(() => db.close());
  const data = { 'config/settings.json': { channels: { browser_push: { enabled: false } } },
    'data/all_lotteries.json': catalog, 'lottery_previous_results.json': [], 'status/status.json': {} };
  const published = [];
  const remote = { assertWriter: async () => {}, snapshot: async () => ({ head: 'a'.repeat(40), data: structuredClone(data) }),
    publish: async p => { published.push(structuredClone(p)); data['status/status.json'] = structuredClone(p.status); } };
  const calls = [];
  return { env: { ENABLED: 'true', MODE: 'deliver', DB: db }, data, published, calls,
    run: () => cycle({ ENABLED: 'true', MODE: 'deliver', DB: db }, { now, remote, send: async () => 'sent',
      collect: async (...args) => { calls.push(args); return collect(); } }) };
}

test('one failing source among several working ones does not degrade the system', async t => {
  const f = fixture(t, () => ({ rows: [row], sources: ['a', 'b', 'c'], errors: [{ source: 'd', status: 500, reason: 'http' }] }));
  await f.run();
  const status = f.data['status/status.json'];
  assert.equal(status.system_status, 'healthy');
  assert.deepEqual(status.degraded_sources, ['d']);
  assert.match(status.status_message, /แหล่งข้อมูลขัดข้อง 1 คำขอ/);
});

test('most sources failing is a real outage', async t => {
  const f = fixture(t, () => ({ rows: [], sources: ['a'], errors: [{ source: 'b' }, { source: 'c' }] }));
  await f.run();
  assert.equal(f.data['status/status.json'].system_status, 'degraded');
});

test('a source that keeps failing is parked and no longer polled', async t => {
  let attempt = 0;
  const f = fixture(t, () => {
    attempt += 1;
    return attempt <= BACKOFF_FAILURES
      ? { rows: [row], sources: ['a'], errors: [{ source: 'ThaiLottoAPI', status: 500, reason: 'http' }] }
      : { rows: [row], sources: ['a'], errors: [] };
  });
  for (let i = 0; i < BACKOFF_FAILURES; i++) await f.run();
  const status = f.data['status/status.json'];
  assert.ok(status.source_backoff.ThaiLottoAPI.until > +now, 'parked until the cooldown ends');
  assert.match(status.status_message, /พักแหล่งที่ขัดข้อง 1 รายการ/);
  await f.run();
  const parkedArg = f.calls.at(-1)[5];
  assert.ok(parkedArg.has('ThaiLottoAPI'), 'the parked source is skipped instead of retried');
});

test('everything parked with nothing delivered is still an outage', async t => {
  const f = fixture(t, () => ({ rows: [], sources: [], errors: [{ source: 'ThaiLottoAPI' }] }));
  for (let i = 0; i < BACKOFF_FAILURES; i++) await f.run();
  assert.equal(f.data['status/status.json'].system_status, 'degraded');
});

test('a source that answers again leaves the backoff map', () => {
  const at = +now;
  const parked = nextBackoff({ x: { failures: BACKOFF_FAILURES, until: at + BACKOFF_MS } }, [], ['x'], now);
  assert.deepEqual(parked, {});
});

test('backoff counters survive a parked cooldown and re-park on the next failure', () => {
  const at = +now;
  const parked = { x: { failures: BACKOFF_FAILURES, until: at + BACKOFF_MS } };
  assert.deepEqual([...parkedSources(parked, now)], ['x']);
  assert.deepEqual([...parkedSources(parked, new Date(at + BACKOFF_MS + 1))], []);
  const again = nextBackoff(parked, [{ source: 'x' }], [], new Date(at + BACKOFF_MS + 1));
  assert.ok(again.x.failures > BACKOFF_FAILURES);
  assert.ok(again.x.until > at + BACKOFF_MS);
});

test('the degraded threshold needs a majority of the tried sources', () => {
  assert.equal(mostlyDown(['a', 'b', 'c'], [{ source: 'd' }]), false);
  assert.equal(mostlyDown(['a'], [{ source: 'b' }, { source: 'c' }]), true);
  assert.equal(mostlyDown([], [{ source: 'a' }]), true, 'nothing delivered is an outage');
  assert.equal(mostlyDown([], []), false);
});

test('the published cadence matches the cron that drives it', () => {
  assert.equal(POLL_SECONDS, 300);
  const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(wrangler, /"\*\/5 \* \* \* \*"/, 'a five-minute poll needs a five-minute cron');
});

test('health reports the real poll cadence', async t => {
  t.mock.method(Date, 'now', () => +now);
  const f = fixture(t, () => ({ rows: [row], sources: ['a'], errors: [] }));
  await f.run();
  const body = await (await worker.fetch(new Request('https://local/health'), f.env)).json();
  assert.equal(body.poll_seconds, POLL_SECONDS);
});
