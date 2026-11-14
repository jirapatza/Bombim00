import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { cycle, boundedRequest, deliveryUncertainty } from '../src/worker.js';
import { DurableState, RuntimeRepository, validateSnapshot, OUTPUTS } from '../src/storage.js';
import { database } from './state-helper.js';
import { drawDate, dueScheduleAlerts, scheduled, numbers, mergeRows } from '../src/domain.js';
import { readFileSync } from 'node:fs';

const now = new Date('2026-11-07T08:00:00Z'), today = '2026-11-07';
const catalog = JSON.parse(readFileSync(new URL('../../data/all_lotteries.json', import.meta.url)));
const result = (id = 'lao_tv', name = 'ลาว TV', top = '007') => ({ หวย: id, ชื่อหวย: name, หมวดหวย: 'lao',
  งวดวันที่: today, วันที่จัดรูปแบบ: today, เลขบน_3_ตัว: top, เลขล่าง_2_ตัว: '90', รางวัลที่_1: top, เลขท้าย_2_ตัว: '90' });
function fixture(t, extra = {}) {
  const db = database(); t.after(() => db.close());
  const env = { ENABLED: 'true', MODE: 'deliver', DB: db,  };
  const data = { 'config/settings.json': { channels: { browser_push: { enabled: true } } },
    'data/all_lotteries.json': catalog, 'lottery_previous_results.json': [], 'status/status.json': { total_checks: 1 } };
  const sends = [], published = [];
  const remote = {
    assertWriter: async () => {}, snapshot: async () => ({ head: 'a'.repeat(40), data: structuredClone(data) }),
    publish: async p => { published.push(structuredClone(p)); Object.assign(data, { [OUTPUTS[0]]: mergeRows(p.rows, data[OUTPUTS[0]]), [OUTPUTS[1]]: structuredClone(p.status) }); },
  };
  const dependencies = { now, remote, collect: async () => ({ rows: [result()], sources: ['synthetic'], errors: [] }),
    send: async (_s, row) => { sends.push(row.หวย); return 'sent'; }, ...extra };
  return { env, db, data, sends, published, remote, dependencies, run: () => cycle(env, dependencies) };
}
test('persists result/status, preserves UTF-8/leading zeroes, never resends on next cycle or restart', async t => {
  const f = fixture(t);
  assert.equal((await f.run()).sent, 1);
  assert.equal((await f.run()).sent, 0);
  assert.deepEqual(f.sends, ['lao_tv']);
  assert.deepEqual(numbers(f.data[OUTPUTS[0]][0]), ['007', '90']);
  assert.equal(f.data[OUTPUTS[1]].notifications_sent_today, 1);
});
test('already delivered Python/legacy history is never sent again, even when notifications disabled', async t => {
  const f = fixture(t);
  f.data[OUTPUTS[0]] = [{ ...result(), สถานะการแจ้งเตือน: 'sent' }];
  f.data['config/settings.json'].notifications = { enabled: false };
  await f.run(); assert.deepEqual(f.sends, []);
  assert.equal(f.data[OUTPUTS[0]][0].notification_channels.ntfy, 'sent');
});
test('mode and active Actions runs stop all source reads and notifications', async t => {
  const f = fixture(t);
  f.remote.assertWriter = async () => { throw new Error('actions_active'); };
  await assert.rejects(f.run(), /actions_active/); assert.deepEqual(f.sends, []);
});
test('pending publication survives failure, retry publishes identical data without sending', async t => {
  const f = fixture(t), publish = f.remote.publish;
  f.remote.publish = async () => { throw new Error('github_http_503'); };
  await assert.rejects(f.run(), /github_http_503/);
  const pending = f.db.state().pending;
  f.remote.publish = publish;
  assert.deepEqual(await f.run(), { recoveredPublish: true });
  assert.deepEqual(f.published[0], pending); assert.equal(f.sends.length, 1);
});
test('crash after ntfy acceptance and before saving result leaves durable uncertainty, does not resend', async t => {
  const f = fixture(t);
  f.dependencies.send = async () => { f.sends.push('accepted-but-lost'); throw new Error('simulated_crash'); };
  await assert.rejects(f.run(), /cycle_failed/);
  f.dependencies.send = async () => { assert.fail('uncertain send must never retry'); };
  const outcome = await f.run();
  assert.equal(outcome.uncertain, 1); assert.equal(f.sends.length, 1);
  assert.equal(f.data[OUTPUTS[0]][0].สถานะการแจ้งเตือน, 'uncertain');
});
test('definite rejection is retried without refetching the missing draw', async t => {
  const f = fixture(t); let attempt = 0;
  f.dependencies.send = async () => ++attempt === 1 ? 'failed' : 'sent';
  await f.run();
  f.dependencies.collect = async () => ({ rows: [], sources: [], errors: ['synthetic timeout'] });
  await f.run(); await f.run();
  assert.equal(attempt, 2); assert.equal(f.data[OUTPUTS[0]][0].notification_channels.browser_push, 'sent');
});
test('limits a result burst to three sends, keeps remaining results queued and drains next minute', async t => {
  const f = fixture(t);
  f.dependencies.collect = async () => ({ rows: [['lao_tv', 'ลาว TV'], ['lao_hd', 'ลาว HD'], ['lao_star', 'ลาว STAR'], ['lao_extra', 'ลาว EXTRA']]
    .map(([id, name]) => result(id, name)), sources: ['synthetic'], errors: [] });
  assert.equal((await f.run()).queued, 1); assert.equal(f.sends.length, 3);
  await f.run(); assert.equal(f.sends.length, 4);
});
test('strict off-day, old-date, future-date and irregular government rules', async t => {
  const f = fixture(t);
  const friday = { id: 'synthetic_friday', name: 'หวยทดสอบวันศุกร์', drawDays: 'ศุกร์' };
  f.data['data/all_lotteries.json'].push(friday);
  f.dependencies.collect = async () => ({ rows: [result(friday.id, friday.name),
    { ...result(), งวดวันที่: '2026-11-06' }, { ...result(), งวดวันที่: '2026-11-08' }], sources: [], errors: [] });
  await f.run(); assert.equal(f.sends.length, 0);
  assert.equal(scheduled({ ชื่อหวย: 'สลากกินแบ่งรัฐบาล', งวดวันที่: today, รางวัลที่_1: '007', เลขท้าย_2_ตัว: '90' }, catalog, today), false);
  assert.equal(drawDate({ งวดวันที่: '2026-02-30' }), '');
});
test('invalid history fails closed before sources or sends', async t => {
  const f = fixture(t); f.data[OUTPUTS[0]] = {};
  await assert.rejects(f.run(), /runtime_schema/); assert.equal(f.sends.length, 0);
  assert.throws(() => validateSnapshot({ data: {} }), /runtime_schema/);
});
test('diagnostics identify safe stages without exposing arbitrary exception messages', async t => {
  const f = fixture(t);
  f.remote.snapshot = async () => { throw new Error('synthetic private diagnostic'); };
  await assert.rejects(f.run(), /cycle_failed/);
  const state = f.db.state();
  assert.equal(state.error_stage, 'snapshot');
  assert.equal(state.error, 'cycle_failed');
  assert.ok(!JSON.stringify(state).includes('synthetic private diagnostic'));
  const response = await worker.fetch(new Request('https://local/health'), f.env);
  assert.equal((await response.json()).error_stage, 'snapshot');
});
test('GitHub transport and invalid JSON failures are classified without revealing request details', async () => {
  const remote = new RuntimeRepository('owner/repo', 'synthetic-token', async () => { throw new Error('synthetic private diagnostic'); });
  await assert.rejects(remote.api('GET', '/path'), { message: 'github_network_other' });
  await assert.rejects(remote.api('GET', '/git/ref/heads/runtime-live'), { message: 'github_network_ref' });
  remote.request = async () => { const error = new Error('sensitive URL or token must not be logged'); error.name = 'TimeoutError'; throw error; };
  await assert.rejects(remote.api('GET', '/contents/config/settings.json'), { message: 'github_timeout_contents' });
  remote.request = async () => { const error = new Error('manual abort'); error.name = 'AbortError'; throw error; };
  await assert.rejects(remote.api('GET', '/git/ref/heads/runtime-live'), { message: 'github_aborted_ref' });
  remote.request = async () => { throw new Error('request_budget'); };
  await assert.rejects(remote.api('GET', '/git/ref/heads/runtime-live'), { message: 'request_budget' });
  remote.request = async () => new Response('invalid private diagnostic', { status: 200 });
  await assert.rejects(remote.api('GET', '/path'), { message: 'github_invalid_response' });
  remote.request = async () => new Response('', { status: 401 });
  await assert.rejects(remote.api('GET', '/path'), { message: 'github_http_401' });
});
test('transient GitHub read failures retry once but non-idempotent writes never retry', async () => {
  let calls = 0;
  const remote = new RuntimeRepository('owner/repo', 'synthetic-token', async () => {
    if (++calls === 1) throw new TypeError('transient private network detail');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  assert.deepEqual(await remote.api('GET', '/git/ref/heads/runtime-live'), { ok: true });
  assert.equal(calls, 2);
  calls = 0;
  remote.request = async () => {
    calls++;
    throw new TypeError('private network failure');
  };
  await assert.rejects(remote.api('POST', '/git/commits', { message: 'test' }), { message: 'github_network_commit' });
  assert.equal(calls, 1);
});

test('GitHub explicit abort is not retried, unlike transient transport failures', async () => {
  let calls = 0;
  const remote = new RuntimeRepository('owner/repo', 'synthetic-token', async () => {
    calls++;
    const error = new Error('private abort reason');
    error.name = 'AbortError';
    throw error;
  });
  await assert.rejects(remote.api('GET', '/git/ref/heads/runtime-live'), { message: 'github_aborted_ref' });
  assert.equal(calls, 1);
});

test('GitHub GET retries temporary 503 but never retries authorization rejection', async () => {
  let calls = 0;
  const remote = new RuntimeRepository('owner/repo', 'synthetic-token', async () => {
    calls++;
    return new Response(JSON.stringify({ ok: true }), { status: calls === 1 ? 503 : 200 });
  });
  assert.deepEqual(await remote.api('GET', '/git/ref/heads/runtime-live'), { ok: true });
  assert.equal(calls, 2);
  calls = 0;
  remote.request = async () => {
    calls++;
    return new Response('', { status: 403 });
  };
  await assert.rejects(remote.api('GET', '/git/ref/heads/runtime-live'), { message: 'github_http_403' });
  assert.equal(calls, 1);
});

test('worker health persists only safe GitHub timeout labels and failing stage', async t => {
  const f = fixture(t);
  f.remote.snapshot = async () => { throw new Error('github_timeout_contents'); };
  await assert.rejects(f.run(), { message: 'github_timeout_contents' });
  assert.equal(f.db.state().error_stage, 'snapshot');
  assert.equal(f.db.state().error, 'github_timeout_contents');
  assert.equal(f.sends.length, 0);
});

test('D1 lease serializes overlap and rejects a stale resumed invocation', async t => {
  const db = database(); t.after(() => db.close()); let clock = 1000;
  const a = new DurableState(db, () => clock), b = new DurableState(db, () => clock);
  const state = await a.acquire(); assert.ok(state); assert.equal(await b.acquire(), null);
  clock += 180001; assert.ok(await b.acquire());
  await assert.rejects(a.save(state), /lease_lost/); await assert.rejects(a.assertLease(), /lease_lost/);
  await a.release(); await b.assertLease(); await b.release();
});
test('paused default, anonymous health only, no secrets or history in public responses', async t => {
  const f = fixture(t); f.env.ENABLED = 'false';
  assert.deepEqual(await f.run(), { paused: true });
  const health = await worker.fetch(new Request('https://local/health'), f.env);
  assert.equal(health.status, 503); assert.equal((await health.json()).status, 'paused');
  const response = await worker.fetch(new Request('https://local/admin/retry', { method: 'POST' }), f.env);
  assert.equal(response.status, 404);
});
test('observation checks full feeds and history without disabling Actions, publishing or sending', async t => {
  const f = fixture(t); f.env.MODE = 'observe';
  f.remote.assertWriter = async () => { assert.fail('observation must allow the existing Actions writer'); };
  const outcome = await f.run();
  assert.equal(outcome.observing, true); assert.equal(outcome.candidates, 1);
  assert.equal(f.sends.length, 0); assert.equal(f.published.length, 0);
  assert.deepEqual(f.db.state().deliveries, {});
});
test('public health distinguishes successful execution from degraded source/delivery status', async t => {
  t.mock.method(Date, 'now', () => +now);
  const f = fixture(t); await f.run();
  assert.equal((await worker.fetch(new Request('https://local/health'), f.env)).status, 200);
  f.dependencies.collect = async () => ({ rows: [result()], sources: [], errors: ['synthetic unavailable source'] });
  await f.run();
  assert.equal((await worker.fetch(new Request('https://local/health'), f.env)).status, 503);
});
test('waiting for a draw publishes diagnostics without degrading a successful check', async t => {
  const waiting = [{ source: 'LotteryChecks Lao/Hanoi', lottery: 'ลาว TV', status: 404 }];
  const f = fixture(t, { collect: async () => ({ rows: [], sources: [], errors: [], waiting }) });
  await f.run();
  const status = f.data[OUTPUTS[1]];
  assert.equal(status.system_status, 'healthy');
  assert.match(status.status_message, /รอผลจากแหล่งข้อมูล 1 รายการ/);
  assert.doesNotMatch(status.status_message, /ขัดข้อง/);
  assert.deepEqual(status.source_checks, { waiting, errors: [] });
});
const scheduledLottery = { id: 'scheduled-test', name: 'หวยทดสอบ', drawDays: 'อังคาร-เสาร์',
  closeTimeStr: '15:20 น.', drawTimeStr: '15:30 น.' };
const bangkok = (time, date = today) => new Date(`${date}T${time}:00+07:00`);

test('schedule alerts honor Bangkok day, individual deadlines and confirmed schedule rules', () => {
  const catalog = [scheduledLottery,
    { ...scheduledLottery, id: 'weekday', drawDays: 'จันทร์ - ศุกร์' },
    { ...scheduledLottery, id: 'irregular', drawDays: 'ตามประกาศวันงวดจริง (อาจเลื่อน)' },
    { ...scheduledLottery, id: 'invalid', closeTimeStr: '15:60 น.', drawTimeStr: '25:30 น.' }];
  const kinds = time => dueScheduleAlerts(catalog, today, bangkok(time)).map(alert => alert.kind);
  assert.deepEqual(kinds('15:09'), []);
  assert.deepEqual(kinds('15:10'), ['closing']);
  assert.deepEqual(kinds('15:20'), []);
  assert.deepEqual(kinds('15:24'), []);
  assert.deepEqual(kinds('15:25'), ['upcoming']);
  assert.deepEqual(kinds('15:30'), []);
  assert.deepEqual(dueScheduleAlerts(catalog, today, bangkok('00:00', '2026-11-08')), []);
});

function scheduleFixture(t, responses = []) {
  const messages = [], headers = [];
  const f = fixture(t, {
    now: bangkok('15:10'),
    collect: async () => ({ rows: [], sources: [], errors: ['synthetic unavailable source'] }),
    sendSchedule: async (message, detail) => {
      messages.push(message);
      const status = responses.shift() ?? 200;
      if (status === 429) detail.code = 'http_429';
      return status === 429 ? 'failed' : status >= 500 ? 'uncertain' : 'sent';
    },
  });
  f.data['data/all_lotteries.json'] = [scheduledLottery];
  return { ...f, messages, headers };
}

test('sends each schedule alert once via ntfy even with no source result, independently of the result ledger', async t => {
  const f = scheduleFixture(t);
  f.env.MODE = 'observe';
  await f.run();
  assert.equal(f.messages.length, 0);
  f.env.MODE = 'deliver';
  f.data['config/settings.json'].notifications = { enabled: false };
  await f.run();
  assert.equal(f.messages.length, 0);
  f.data['config/settings.json'].notifications.enabled = true;
  await f.run();
  await f.run();
  f.dependencies.now = bangkok('15:25');
  await f.run();
  await f.run();
  assert.deepEqual(f.messages.map(({ title, message }) => [title, message]), [
    ['ใกล้ปิดรับ', 'หวยทดสอบ ปิดรับ เวลา 15:20 น.'],
    ['หวยรายการถัดไป', 'หวยทดสอบ ออกผลตามตาราง เวลา 15:30 น.'],
  ]);
  assert.deepEqual(f.data[OUTPUTS[0]], []);
  assert.equal(f.data[OUTPUTS[1]].notifications_sent_today, 0);
  assert.equal(f.data[OUTPUTS[1]].schedule_alerts_sent_today, 2);
});

test('retries a definite schedule rejection only after 429 cooldown and never repeats an uncertain send', async t => {
  let clock = +bangkok('15:10');
  t.mock.method(Date, 'now', () => clock);
  const f = scheduleFixture(t, [429, 503]);
  await f.run();
  assert.equal(f.data[OUTPUTS[1]].schedule_alert_failures, 1);
  // Cooldown is exactly 60 seconds when Retry-After is missing.
  clock = +bangkok('15:10') + 30000;
  f.dependencies.now = new Date(clock);
  await f.run();
  assert.equal(f.messages.length, 1);
  clock = +bangkok('15:11');
  f.dependencies.now = new Date(clock);
  await f.run();
  f.dependencies.now = bangkok('15:12');
  clock = +f.dependencies.now;
  assert.equal((await f.run()).uncertain, 1);
  assert.equal(f.messages.length, 2);
  assert.equal(f.data[OUTPUTS[1]].schedule_alerts_sent_today, 0);
});
test('schedule alerts due in the same cycle for multiple lotteries go out as one combined ntfy send', async t => {
  const second = { ...scheduledLottery, id: 'scheduled-test-2', name: 'หวยทดสอบสอง' };
  const f = scheduleFixture(t);
  f.data['data/all_lotteries.json'] = [scheduledLottery, second];
  const result = await f.run();
  assert.equal(f.messages.length, 1); // one HTTP call, not one per lottery
  assert.deepEqual(f.messages[0], { title: 'แจ้งเตือนตามตาราง (2 รายการ)',
    message: 'หวยทดสอบ ปิดรับ เวลา 15:20 น.\nหวยทดสอบสอง ปิดรับ เวลา 15:20 น.', tags: ['alarm_clock'] });
  assert.equal(result.sent, 0);
  assert.equal(f.data[OUTPUTS[1]].schedule_alerts_sent_today, 2); // both lotteries still tracked as sent
});

test('request budget and redirects prevent unbounded subrequests or token forwarding', async () => {
  const options = [], request = boundedRequest(async (_url, o) => { options.push(o); return new Response(''); });
  for (let i = 0; i < 38; i++) await request('https://example.test');
  await assert.rejects(request('https://example.test'), /request_budget/);
  assert.ok(options.every(x => x.redirect === 'manual'));
});
test('a redirect response is rejected without forwarding the GitHub authorization', async () => {
  const calls = [];
  const request = boundedRequest(async (url, options) => {
    calls.push({ url, redirect: options.redirect });
    return new Response(null, { status: 302, headers: { Location: 'https://other.example.test/' } });
  });
  const remote = new RuntimeRepository('owner/repo', 'synthetic-token', request);
  await assert.rejects(remote.api('GET', '/git/ref/heads/runtime-live'), { message: 'github_http_302' });
  assert.deepEqual(calls, [{ url: 'https://api.github.com/repos/owner/repo/git/ref/heads/runtime-live', redirect: 'manual' }]);
});
test('GitHub publish preserves config tree, writes only two files and never forces the runtime ref', async () => {
  const calls = [], before = Object.fromEntries(OUTPUTS.map(x => [x, []])), outputs = { ...before, [OUTPUTS[1]]: { changed: true } };
  const remote = new RuntimeRepository('owner/repo', 'synthetic', null);
  const pending = { baseHead: 'a'.repeat(40), rows: [], status: outputs[OUTPUTS[1]] };
  remote.snapshot = async () => ({ data: before, head: 'head', tree: 'tree' });
  remote.readAt = async () => before;
  remote.api = async (method, path, body) => { calls.push({ method, path, body }); return { sha: 'new' }; };
  await remote.publish(pending);
  assert.deepEqual(calls[0].body.tree.map(x => x.path), OUTPUTS);
  assert.equal(calls[0].body.base_tree, 'tree');
  assert.equal(calls[2].path, '/git/refs/heads/runtime-live'); assert.equal(calls[2].body.force, false);
  remote.snapshot = async () => ({ data: outputs }); calls.length = 0;
  await remote.publish(pending); assert.equal(calls.length, 0);
  remote.snapshot = async () => ({ data: {} });
  await assert.rejects(remote.publish(pending), /runtime_conflict/); assert.equal(calls.length, 0);
});
test('reviewed main-branch Cloudflare gate and every active Actions status protect the writer', async () => {
  const remote = new RuntimeRepository('owner/repo', 'synthetic', null), paths = [];
  const gate = { mode: 'cloudflare', legacy_workflow: 'pr-only', poll_seconds: 60 };
  remote.api = async (_method, path) => { paths.push(path); return path.includes('PRIMARY_CHECKER.json') ? gate : { workflow_runs: [] }; };
  await remote.assertWriter(); assert.equal(paths.length, 6);
  assert.equal(paths[0], '/contents/cloudflare/PRIMARY_CHECKER.json?ref=main');
  remote.api = async () => ({ mode: 'github-actions' });
  await assert.rejects(remote.assertWriter(), /writer_mode/);
  remote.api = async (_method, path) => path.includes('PRIMARY_CHECKER.json') ? gate : { workflow_runs: [{ event: 'schedule' }] };
  await assert.rejects(remote.assertWriter(), /actions_active/);
});
test('worst-case source fallback cycle fits 38 network calls and at most 12 D1 operations', async t => {
  const db = database(); t.after(() => db.close());
  let sqlCalls = 0, calls = 0, notifications = 0;
  const original = db.prepare; db.prepare = sql => { sqlCalls++; return original(sql); };
  const data = { 'config/settings.json': { sources: Object.fromEntries(['thailottoapi', 'pholhuay', 'glo', 'lotterychecks', 'ranlotto'].map(x => [x, { enabled: true }])) },
    'data/all_lotteries.json': catalog, 'lottery_previous_results.json': [], 'status/status.json': {} };
  const request = boundedRequest(async (url, options = {}) => {
    calls++;
    if (url.startsWith('https://api.github.com/')) {
      const path = new URL(url).pathname;
      if (path.endsWith('/contents/cloudflare/PRIMARY_CHECKER.json')) return Response.json({ mode: 'cloudflare', legacy_workflow: 'pr-only', poll_seconds: 60 });
      if (path.endsWith('/runs')) return Response.json({ workflow_runs: [] });
      if (path.endsWith('/git/ref/heads/runtime-live')) return Response.json({ object: { sha: 'a'.repeat(40) } });
      if (path.includes('/git/commits/') && options.method === 'GET') return Response.json({ tree: { sha: 'tree' } });
      if (path.includes('/contents/')) return Response.json(data[path.split('/contents/')[1]]);
      return Response.json({ sha: 'b'.repeat(40) });
    }
    if (url.includes('thailottoapi')) return Response.json({ ok: false });
    if (url.includes('xn--t3cmiit')) return new Response('');
    if (url.includes('api.pholhuay')) return Response.json({ first: '900007', last2: '90', date: today });
    if (url.includes('glo.or.th')) return Response.json({ firstPrize: '900007', last2: '90', date: today });
    if (url.includes('ranlotto')) return Response.json({ data: { state: 'published', date: today, result: { first_prize: '900007', last_two: '90' } } });
    const slug = new URL(url).searchParams.get('lottery');
    return Response.json({ success: true, data: [{ lottery: slug, drawDate: today, status: 'complete', pendingPrizes: [],
      prizes: slug === 'thai-government' ? [{ slug: 'first-prize', numbers: ['900007'] }, { slug: 'last-two-digit', numbers: ['90'] }] :
        [{ name: '3 ตัวบน', numbers: ['007'] }, { name: '2 ตัวล่าง', numbers: ['90'] }] }] });
  });
  const outcome = await cycle({ ENABLED: 'true', MODE: 'deliver', DB: db, GITHUB_REPOSITORY: 'owner/repo',
    LOTTERY_RUNTIME_TOKEN: 'synthetic' }, { now, request, sendBatch: async () => { notifications++; return 'sent'; } });
  assert.ok(outcome.sent > 3, `batched results delivered: ${outcome.sent}`);
  assert.ok(notifications > 0 && notifications <= 3, `push batches: ${notifications}`);
  assert.ok(calls <= 38, `network calls: ${calls}`);
  assert.ok(sqlCalls <= 12, `D1 operations: ${sqlCalls}`);
});
test('durable pending stores changes and an immutable Git base, not the growing archive', async t => {
  const f = fixture(t);
  f.data[OUTPUTS[0]] = [{ ...result(), งวดวันที่: '2026-11-01', archive: 'x'.repeat(2_000_001) }];
  f.remote.publish = async () => { throw new Error('github_http_503'); };
  await assert.rejects(f.run());
  assert.ok(JSON.stringify(f.db.state()).length < 20000);
  assert.equal(f.db.state().pending.baseHead, 'a'.repeat(40));
});
test('health counts unresolved delivery codes without exposing text, topic or history', async t => {
  const f = fixture(t);
  f.dependencies.send = async (_s, _row, _r, detail) => { detail.code = 'http_429'; return 'failed'; };
  await f.run();
  assert.equal(f.db.state().deliveries[Object.keys(f.db.state().deliveries)[0]].code, 'http_429');
  const state = f.db.state();
  state.deliveries.legacy = { state: 'uncertain', date: today, kind: 'result' };
  state.deliveries.hostile = { state: 'failed', date: today, kind: 'result', code: 'https://secret.example/token' };
  state.deliveries.ok = { state: 'sent', date: today, kind: 'result', code: 'http_200' };
  f.db.setState(state);
  const body = await (await worker.fetch(new Request('https://local/health'), f.env)).json();
  assert.deepEqual(body.delivery_codes, { http_429: 1, unknown: 2 });
  assert.ok(!JSON.stringify(body).includes('secret.example') && !JSON.stringify(body).includes('synthetic-local-topic'));
});

test('ntfy 429 persists cooldown and does not send again until it expires', async t => {
  let current = +now;
  t.mock.method(Date, 'now', () => current);
  const f = fixture(t);
  let attempts = 0;
  f.dependencies.send = async (_settings, _row, _request, detail) => {
    attempts++;
    if (attempts === 1) { detail.code = 'http_429'; detail.retry_after_ms = 120000; return 'failed'; }
    detail.code = 'http_200'; return 'sent';
  };
  await f.run();
  assert.equal(attempts, 1);
  assert.equal(f.db.state().pushBackoffUntil, new Date(+now + 120000).toISOString());
  current = +now + 60000;
  f.dependencies.now = new Date(current);
  await f.run();
  assert.equal(attempts, 1);
  current = +now + 121000;
  f.dependencies.now = new Date(current);
  await f.run();
  assert.equal(attempts, 2);
});

test('/health explains a queue: how many hit the per-cycle send quota last cycle', async t => {
  const f = fixture(t);
  f.dependencies.collect = async () => ({ rows: [['lao_tv', 'ลาว TV'], ['lao_hd', 'ลาว HD'], ['lao_star', 'ลาว STAR'], ['lao_extra', 'ลาว EXTRA']]
    .map(([id, name]) => result(id, name)), sources: ['synthetic'], errors: [] });
  assert.equal((await f.run()).queued, 1); // 3 sent, 1 over MAX_SENDS
  const body = await (await worker.fetch(new Request('https://local/health'), f.env)).json();
  assert.equal(body.push_backoff_until, null); // no 429 here, so no backoff reason
  assert.equal(body.last_queue_summary.quota, 1);
  assert.equal(body.last_queue_summary.backoff, 0);
});

test('/health explains a queue: an active ntfy 429 cooldown and exactly when it lifts', async t => {
  t.mock.method(Date, 'now', () => +now);
  const f = fixture(t);
  f.dependencies.send = async (_s, _row, _r, detail) => { detail.code = 'http_429'; detail.retry_after_ms = 120000; return 'failed'; };
  await f.run();
  const body = await (await worker.fetch(new Request('https://local/health'), f.env)).json();
  assert.equal(body.push_backoff_until, new Date(+now + 120000).toISOString());
  assert.equal(body.last_queue_summary.backoff, 0); // the row that triggered the 429 is 'failed', not 'queued'
});

test('ntfy 401 starts a 15-minute cooldown instead of retrying every cycle', async t => {
  let current = +now;
  t.mock.method(Date, 'now', () => current);
  const f = fixture(t);
  f.dependencies.collect = async () => ({ rows: [['lao_tv', 'ลาว TV'], ['lao_hd', 'ลาว HD']].map(([id, name]) => result(id, name)), sources: ['synthetic'], errors: [] });
  let attempts = 0, code = 'http_401';
  f.dependencies.send = async (_s, _row, _r, detail) => { attempts++; detail.code = code; return code === 'http_200' ? 'sent' : 'failed'; };
  await f.run();
  assert.equal(attempts, 1); // the second result is held back, not also rejected
  assert.equal(f.db.state().pushBackoffUntil, new Date(+now + 15 * 60000).toISOString());
  assert.equal(f.db.state().pushBackoffReason, 'auth_rejected');
  current = +now + 14 * 60000; f.dependencies.now = new Date(current);
  await f.run();
  assert.equal(attempts, 1); // still cooling down
  current = +now + 15 * 60000 + 1000; f.dependencies.now = new Date(current); code = 'http_200';
  await f.run();
  assert.ok(attempts >= 2); // retried once the cooldown lifted, so a fixed token recovers by itself
});

test('/health names the cooldown reason: auth_rejected for 403, rate_limit for 429', async t => {
  t.mock.method(Date, 'now', () => +now);
  for (const [code, reason] of [['http_403', 'auth_rejected'], ['http_429', 'rate_limit']]) {
    const f = fixture(t);
    f.dependencies.send = async (_s, _row, _r, detail) => { detail.code = code; detail.retry_after_ms = 120000; return 'failed'; };
    await f.run();
    const body = await (await worker.fetch(new Request('https://local/health'), f.env)).json();
    assert.equal(body.push_backoff_reason, reason);
  }
});

test('an expired rate-limit cooldown is replaced by the auth cooldown when the next send is rejected with 401', async t => {
  t.mock.method(Date, 'now', () => +now);
  const f = fixture(t);
  const state = f.db.state();
  state.pushBackoffUntil = new Date(+now - 1000).toISOString(); // already lifted
  state.pushBackoffReason = 'rate_limit';
  f.db.setState(state);
  f.dependencies.send = async (_s, _row, _r, detail) => { detail.code = 'http_401'; return 'failed'; };
  await f.run();
  assert.equal(f.db.state().pushBackoffReason, 'auth_rejected');
  assert.equal(f.db.state().pushBackoffUntil, new Date(+now + 15 * 60000).toISOString());
});

test('old uncertain delivery is retained but does not degrade current health', async t => {
  t.mock.method(Date, 'now', () => +now);
  const f = fixture(t);
  const state = f.db.state();
  state.deliveries.old = { state: 'uncertain', date: '2026-11-01', kind: 'result', code: 'timeout' };
  state.deliveries.oldFailed = { state: 'failed', date: '2026-11-01', kind: 'result', code: 'http_429' };
  f.db.setState(state);
  await f.run();
  const persisted = f.db.state();
  assert.ok(persisted.deliveries.old);
  assert.ok(persisted.deliveries.oldFailed);
  assert.equal(f.data[OUTPUTS[1]].notification_failures, 0);
  assert.equal(f.data[OUTPUTS[1]].system_status, 'healthy');
  const health = await worker.fetch(new Request('https://local/health'), f.env);
  assert.equal(health.status, 200);
  const body = await health.json();
  assert.equal(body.old_uncertain_deliveries, 1);
  assert.equal(body.active_uncertain_deliveries, 0);
  assert.equal(body.uncertain_deliveries, 1);
});
test('recent uncertain stays degraded; missing timestamps use conservative Bangkok date', () => {
  assert.deepEqual(deliveryUncertainty({
    new: { state: 'uncertain', date: today, startedAt: now.toISOString() },
    legacy: { state: 'uncertain', date: today },
    historic: { state: 'uncertain', date: '2026-11-01' },
  }, now), { recent: 2, old: 1, total: 3 });
});

test('stale uncertain on an otherwise current result stays recorded but does not degrade makeStatus', async t => {
  t.mock.method(Date, 'now', () => +now);
  const f = fixture(t);
  const old = { state: 'uncertain', date: today, kind: 'result',
    startedAt: new Date(+now - 48 * 3600000).toISOString(), code: 'timeout' };
  const state = f.db.state();
  // Use the same stable identity as the synthetic row.
  const { drawIdentity } = await import('../src/domain.js');
  const key = drawIdentity(result());
  state.deliveries[key] = old;
  f.db.setState(state);
  f.dependencies.send = async () => assert.fail('old uncertain must not be resent');
  await f.run();
  assert.equal(f.data[OUTPUTS[1]].system_status, 'healthy');
  assert.equal(f.data[OUTPUTS[1]].notification_failures, 0);
  assert.equal(f.data[OUTPUTS[1]].old_uncertain_deliveries, 1);
  assert.equal(f.db.state().deliveries[key].state, 'uncertain');
});

test('production result batches reduce ntfy requests and persist sent status per draw', async t => {
  const f = fixture(t), groups = [];
  delete f.dependencies.send;
  f.dependencies.collect = async () => ({ rows: [
    result('lao_tv', 'ลาว TV'),
    result('lao_hd', 'ลาว HD'),
    result('lao_star', 'ลาว STAR'),
    result('lao_extra', 'ลาว EXTRA'),
  ], sources: ['synthetic'], errors: [] });
  f.dependencies.sendBatch = async (rows, detail) => {
    groups.push(rows.map(row => row.หวย));
    detail.code = 'http_200';
    return 'sent';
  };
  assert.equal((await f.run()).sent, 4);
  assert.deepEqual(groups, [['lao_tv', 'lao_hd', 'lao_star', 'lao_extra']]);
  assert.equal((await f.run()).sent, 0);
  assert.equal(groups.length, 1, 'already sent rows must not be resent');
  assert.equal(Object.values(f.db.state().deliveries).filter(entry => entry.state === 'sent').length, 4);
});

test('uncertain batch persists all identities without automatic retry', async t => {
  const f = fixture(t), groups = [];
  delete f.dependencies.send;
  f.dependencies.collect = async () => ({ rows: [
    result('lao_tv', 'ลาว TV'), result('lao_hd', 'ลาว HD'),
  ], sources: ['synthetic'], errors: [] });
  f.dependencies.sendBatch = async (rows, detail) => {
    groups.push(rows.map(row => row.หวย));
    detail.code = 'timeout';
    return 'uncertain';
  };
  assert.equal((await f.run()).uncertain, 2);
  f.dependencies.sendBatch = async () => assert.fail('ambiguous ntfy acceptance must never retry');
  assert.equal((await f.run()).uncertain, 2);
  assert.equal(groups.length, 1);
  assert.equal(Object.values(f.db.state().deliveries).filter(entry => entry.state === 'uncertain').length, 2);
});

test('timeout opens a durable circuit breaker before later sends, without retrying uncertain result', async t => {
  let current = +now;
  t.mock.method(Date, 'now', () => current);
  const f = fixture(t);
  f.dependencies.collect = async () => ({ rows: [
    result('lao_tv', 'ลาว TV'),
    result('lao_hd', 'ลาว HD'),
    result('lao_star', 'ลาว STAR'),
  ], sources: ['synthetic'], errors: [] });
  let calls = 0;
  f.dependencies.send = async (_settings, _row, _request, detail) => {
    calls++;
    detail.code = 'timeout';
    return 'uncertain';
  };
  const first = await f.run();
  assert.equal(calls, 1, 'no more HTTP calls after first ambiguous send');
  assert.equal(first.uncertain, 1);
  assert.equal(f.db.state().lastQueueSummary.backoff, 2);
  assert.equal(f.db.state().pushBackoffReason, 'transport_uncertain');
  assert.equal(f.db.state().pushBackoffUntil, new Date(current + 15 * 60_000).toISOString());

  current += 60_000;
  f.dependencies.now = new Date(current);
  await f.run();
  assert.equal(calls, 1, 'the uncertain send must not repeat on subsequent cycles');
  assert.equal(f.db.state().pushBackoffReason, 'transport_uncertain');
});

test('batched 429 holds subsequent results during Retry-After and retries definite rejection', async t => {
  let time = +now;
  t.mock.method(Date, 'now', () => time);
  const f = fixture(t);
  delete f.dependencies.send;
  f.dependencies.collect = async () => ({ rows: [
    result('lao_tv', 'ลาว TV'), result('lao_hd', 'ลาว HD'),
  ], sources: ['synthetic'], errors: [] });
  const batches = [];
  f.dependencies.sendBatch = async (rows, detail) => {
    batches.push(rows.map(row => row.หวย));
    detail.code = 'http_429';
    detail.retry_after_until = new Date(time + 120000).toISOString();
    return 'failed';
  };
  await f.run();
  assert.equal(batches.length, 1);
  assert.equal((await f.run()).queued, 2);
  assert.equal(batches.length, 1, 'backoff must suppress another publish');
  time += 120001;
  f.dependencies.sendBatch = async rows => { batches.push(rows.map(row => row.หวย)); return 'sent'; };
  assert.equal((await f.run()).sent, 2);
  assert.equal(batches.length, 2);
});

test('a GitHub 403 names the refused request via fixed labels while the message stays github_http_403', async t => {
  const remote = new RuntimeRepository('owner/repo', 'token', async () => new Response('', { status: 403 }));
  await assert.rejects(remote.api('POST', '/git/commits', { message: 'x' }), error => {
    assert.equal(error.message, 'github_http_403');
    assert.deepEqual(error.github, { method: 'POST', endpoint: 'commit' });
    assert.ok(!JSON.stringify(error.github).includes('token'));
    return true;
  });
  await assert.rejects(remote.api('GET', '/actions/workflows/lottery.yml/runs?status=queued'),
    error => error.github.method === 'GET' && error.github.endpoint === 'writer');
});

test('/health shows error_request for a refused GitHub request and clears it after a successful cycle', async t => {
  t.mock.method(Date, 'now', () => +now);
  const f = fixture(t), publish = f.remote.publish;
  f.remote.publish = async () => { throw Object.assign(new Error('github_http_403'), { github: { method: 'PATCH', endpoint: 'publish' } }); };
  await assert.rejects(f.run(), /github_http_403/);
  assert.equal(f.db.state().error_request, 'PATCH publish');
  let body = await (await worker.fetch(new Request('https://local/health'), f.env)).json();
  assert.equal(body.error, 'github_http_403');
  assert.equal(body.error_request, 'PATCH publish');
  f.remote.publish = publish;
  await f.run();
  body = await (await worker.fetch(new Request('https://local/health'), f.env)).json();
  assert.equal(body.error_request, null);
});

test('error_request ignores unknown or unsafe labels', async t => {
  t.mock.method(Date, 'now', () => +now);
  const f = fixture(t);
  f.remote.publish = async () => { throw Object.assign(new Error('github_http_403'), { github: { method: 'DELETE', endpoint: 'https://secret.example/?t=abc' } }); };
  await assert.rejects(f.run(), /github_http_403/);
  assert.equal(f.db.state().error_request, null);
});
