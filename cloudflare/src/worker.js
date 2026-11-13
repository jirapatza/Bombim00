import { bangkokDay, canonical, drawDate, drawIdentity, dueScheduleAlerts, eligible, mergeRows, normalize, numbers, previousChannels, rawName, scheduled } from './domain.js';
import { collect } from './providers.js';
import { DurableState, OUTPUTS, RuntimeRepository, validateSnapshot } from './storage.js';
import { DEFAULT_NTFY_BACKOFF_MS, PreflightError, publishNtfy } from './ntfy-gateway-v2.js';
export { retryAfterDelay } from './ntfy-gateway-v2.js';

const MAX_SENDS = 3;
const MAX_RESULT_BATCH = 6; // One ntfy message per cluster; never bulk-retry uncertain outcomes.
// A rejected token/permission needs a cooldown; repeated probes only worsen limits.
const AUTH_REJECT_BACKOFF_MS = 15 * 60 * 1000;
const UNCERTAIN_HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000;
function isOldUncertain(entry, now) {
  if (!entry || entry.state !== 'uncertain') return false;
  const recordedAt = Date.parse(entry.startedAt || `${entry.date}T23:59:59+07:00`);
  return Number.isFinite(recordedAt) && +now - recordedAt > UNCERTAIN_HEALTH_WINDOW_MS;
}
export function deliveryUncertainty(deliveries, now = new Date()) {
  let recent = 0, old = 0;
  for (const entry of Object.values(deliveries)) {
    if (entry.state !== 'sending' && entry.state !== 'uncertain') continue;
    // A sending intent remains active until the normal recovery cycle classifies it.
    if (entry.state === 'sending') { recent++; continue; }
    // Older ledgers only store the Bangkok draw date, not the attempt timestamp.
    // Use the END of that day to avoid falsely aging out an uncertain send.
    if (isOldUncertain(entry, now)) old++;
    else recent++;
  }
  return { recent, old, total: recent + old };
}
// Only raised locally before fetch begins. A transport failure must stay uncertain.
function finishPublish(state, now) {
  const status = state.pending.status;
  state.lastCheck = { status: status.system_status, notification_failures: status.notification_failures,
    message: status.status_message };
  for (const entry of Object.values(state.deliveries)) if (entry.state === 'sent') entry.published = true;
  state.pending = null; state.error = null; state.error_stage = null; state.lastSuccess = now.toISOString();
}
// 38 external calls + at most 12 D1 calls per normal cycle. No automatic retries.
export function boundedRequest(fetcher, deadline = Date.now() + 50000) {
  let calls = 0;
  return async (url, options = {}) => {
    if (++calls > 38 || Date.now() >= deadline) throw new PreflightError('request_budget');
    let target;
    try { target = new URL(url); } catch { throw new PreflightError('https_required'); }
    if (target.protocol !== 'https:' || target.username || target.password) throw new PreflightError('https_required');
    // Workers does not implement redirect: 'error'. Manual keeps credentials on
    // the original host; callers reject the returned non-2xx redirect response.
    const { timeoutMs, ...safeOptions } = options;
    const perCallMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 12000) : 7000;
    return fetcher(url, { ...safeOptions, redirect: 'manual',
      signal: AbortSignal.timeout(Math.max(1, Math.min(perCallMs, deadline - Date.now()))) });
  };
}
function resultMessage(row) {
  const name = canonical(rawName(row)), date = row.งวดวันที่ || row.วันที่จัดรูปแบบ;
  const [top, bottom] = numbers(row);
  const display = /รัฐบาล|ออมสิน|ธ\.ก\.ส/.test(name) || name.startsWith('หวย') ? name : `หวย${name}`;
  return { title: `📢 ผล${display} งวด ${date}`, message: `${name}\nงวด ${date}\n${top} - ${bottom}`,
    tags: ['loudspeaker', 'dart'] };
}
function resultBatchMessage(rows) {
  if (rows.length === 1) return resultMessage(rows[0]);
  const date = rows[0].งวดวันที่ || rows[0].วันที่จัดรูปแบบ;
  const lines = rows.map(row => {
    const name = canonical(rawName(row)).slice(0, 72);
    const [top, bottom] = numbers(row);
    return `${name}: ${top} - ${bottom}`;
  });
  return { title: `📢 ผลหวยงวด ${date} (${rows.length} รายการ)`,
    message: lines.join('\n'), tags: ['loudspeaker', 'dart'] };
}
function scheduleMessage(alert) {
  const closing = alert.kind === 'closing';
  return { title: closing ? 'ใกล้ปิดรับ' : 'หวยรายการถัดไป',
    message: `${alert.name} ${closing ? 'ปิดรับ' : 'ออกผลตามตาราง'} เวลา ${alert.clock} น.`,
    tags: ['alarm_clock'] };
}
// Several lotteries can share a closing/draw minute. One ntfy send for all of
// them (instead of one per lottery) cuts schedule-alert volume without
// changing per-lottery delivery tracking below. A single-alert batch keeps the
// exact prior title/message so existing behavior for the common case is unchanged.
function scheduleBatchMessage(alerts) {
  if (alerts.length === 1) return scheduleMessage(alerts[0]);
  const lines = alerts.map(a => `${a.name} ${a.kind === 'closing' ? 'ปิดรับ' : 'ออกผลตามตาราง'} เวลา ${a.clock} น.`);
  return { title: `แจ้งเตือนตามตาราง (${alerts.length} รายการ)`, message: lines.join('\n'), tags: ['alarm_clock'] };
}
// Fixed labels only (never URLs, bodies or error text) so /health can show why a send was not accepted.
export const sendNotification = (settings, row, topic, request, detail, token) => publishNtfy(settings, resultMessage(row), topic, request, detail, token);
const safeError = error => /^(github_http_\d{3}|github_network|github_invalid_response|github_(network|timeout|aborted)_(ref|commit|contents|writer|publish|other)|writer_mode|actions_active|runtime_(encoding|schema|conflict|output_paths)|state_schema|lease_lost|request_budget|https_required|notification_configuration|pending_requires_deliver)$/.test(error?.message) ? error.message : 'cycle_failed';
function makeStatus(previous, rows, live, sources, checks, sent, alerts, uncertainCounts, deliveries, now) {
  const { recent: uncertain, old: oldUncertain, total: allUncertain } = uncertainCounts;
  const day = bangkokDay(now), time = new Date(+now + 7 * 3600000).toISOString().replace('Z', '+07:00');
  const thaiDate = `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
  // Old unknown outcomes stay visible in history, but are not current-cycle failures.
  // An old failed delivery from a prior draw is likewise not a current-day failure.
  const failed = rows.filter(x => {
    if (drawDate(x) !== day) return false;
    if (!['failed', 'partial', 'queued', 'uncertain'].includes(x.สถานะการแจ้งเตือน)) return false;
    return !isOldUncertain(deliveries[drawIdentity(x)], now);
  }).length;
  const healthy = !checks.errors.length && !failed && !alerts.failed && !uncertain;
  const sameDay = String(previous.last_run_date_thai || '').split(' ')[0] === thaiDate;
  const message = `Cloudflare ตรวจทุกนาที พบผลวันนี้ ${rows.length} รายการ ส่งสำเร็จ ${sent} รายการ` +
    (alerts.sent ? ` ส่งเตือนตามตาราง ${alerts.sent} รายการ` : '') +
    (alerts.failed ? ` ส่งเตือนตามตารางไม่สำเร็จ ${alerts.failed} รายการ` : '') +
    (failed ? ` ค้างส่ง ${failed} รายการ` : '') + (uncertain ? ` ต้องตรวจสอบการส่งที่ไม่ทราบผล ${uncertain} รายการ` : '') +
    (checks.waiting.length ? ` รอผลจากแหล่งข้อมูล ${checks.waiting.length} รายการ` : '') +
    (checks.errors.length ? ` แหล่งข้อมูลขัดข้อง ${checks.errors.length} คำขอ` : '') + (!live ? ' ยังไม่พบผลสด' : '');
  return { ...previous, system_status: healthy ? 'healthy' : 'degraded', last_run_timestamp: time,
    last_run_date_thai: `${thaiDate} ${time.slice(11, 19)}`, total_checks: (Number(previous.total_checks) || 0) + 1,
    last_source_used: sources.join(' + ') || previous.last_source_used || 'Cloudflare', status_message: message,
    active_sources_count: sources.length, latest_draw_detected: rows[0]?.งวดวันที่ || previous.latest_draw_detected || '',
    notifications_sent_today: (sameDay ? Number(previous.notifications_sent_today) || 0 : 0) + sent,
    schedule_alerts_sent_today: (sameDay ? Number(previous.schedule_alerts_sent_today) || 0 : 0) + alerts.sent,
    schedule_alert_failures: alerts.failed, source_checks: checks,
    notification_failures: failed, uncertain_deliveries: allUncertain,
    active_uncertain_deliveries: uncertain, old_uncertain_deliveries: oldUncertain, checker_mode: 'cloudflare', poll_interval_seconds: 60,
    recent_logs: [{ timestamp: time, level: healthy ? 'INFO' : 'WARNING', message }, ...(Array.isArray(previous.recent_logs) ? previous.recent_logs : [])].slice(0, 20) };
}
export async function cycle(env, dependencies = {}) {
  if (env.ENABLED !== 'true') return { paused: true };
  const now = dependencies.now || new Date(), today = bangkokDay(now);
  const request = dependencies.request || boundedRequest(fetch);
  const remote = dependencies.remote || new RuntimeRepository(env.GITHUB_REPOSITORY, env.LOTTERY_RUNTIME_TOKEN, request);
  const store = dependencies.store || new DurableState(env.DB);
  const state = await store.acquire();
  if (!state) return { busy: true };
  let stage = 'writer';
  try {
    const observing = env.MODE !== 'deliver';
    if (!observing) await remote.assertWriter();
    // Publication retries use the durable output, without querying providers/sending again.
    if (state.pending) {
      if (observing) throw new Error('pending_requires_deliver');
      stage = 'publish';
      await remote.publish(state.pending, () => store.assertLease());
      finishPublish(state, now);
      await store.save(state);
      return { recoveredPublish: true };
    }
    stage = 'snapshot';
    const snapshot = await remote.snapshot();
    stage = 'validate';
    const { settings, catalog, history, status } = validateSnapshot(snapshot);
    const active = settings.channels?.ntfy?.enabled !== false;
    const topic = String(env.NTFY_TOPIC || '').trim();
    if (!observing && active && !/^[A-Za-z0-9_-]{1,64}$/.test(topic)) throw new Error('notification_configuration');
    // Optional: a Worker secret (wrangler secret put NTFY_TOKEN), never a
    // committed setting. Empty means anonymous ntfy.sh, same as before.
    const ntfyToken = String(env.NTFY_TOKEN || '').trim();
    // Keep unresolved sends indefinitely. Successful/definitely rejected entries older
    // than 14 days are already in runtime history and cannot be today's candidates.
    const cutoff = new Date(+now - 14 * 86400000).toISOString().slice(0, 10);
    for (const [key, entry] of Object.entries(state.deliveries)) {
      if (entry.state === 'sending') entry.state = 'uncertain';
      if (['sent', 'failed'].includes(entry.state) && entry.date < cutoff) delete state.deliveries[key];
    }
    stage = 'sources';
    const { rows: fetched, sources, errors, waiting = [] } = await (dependencies.collect || collect)(settings, today, now, request);
    stage = 'process';
    // Group once instead of repeatedly normalizing the entire historical archive
    // for every live row. The same Python matching rules run within each bucket.
    const historyByDraw = new Map();
    const historyKey = row => JSON.stringify([normalize(rawName(row)), drawDate(row)]);
    for (const old of history) {
      if (drawDate(old) !== today) continue;
      const key = historyKey(old);
      if (!historyByDraw.has(key)) historyByDraw.set(key, []);
      historyByDraw.get(key).push(old);
    }
    const rows = [], seenDraws = new Set();
    // A failed prior result remains retryable when a provider is temporarily absent.
    const liveDraws = new Set(fetched.map(x => JSON.stringify([canonical(rawName(x)), drawDate(x)])));
    const retries = history.filter(x => ['failed', 'partial', 'queued', 'uncertain'].includes(x.สถานะการแจ้งเตือน) && drawDate(x) === today &&
      !liveDraws.has(JSON.stringify([canonical(rawName(x)), drawDate(x)])));
    for (const source of [...fetched, ...retries]) {
      if (drawDate(source) !== today || !numbers(source).every(Boolean)) continue;
      const row = structuredClone(source), key = drawIdentity(row);
      if (seenDraws.has(key)) continue;
      seenDraws.add(key); rows.push(row);
      [row.เลขบน_3_ตัว, row.เลขล่าง_2_ตัว] = numbers(row);
    }
    let sent = 0, attempts = 0;
    // keys: one delivery key, or several when one ntfy send covers multiple
    // schedule alerts at once. Every key gets the same outcome and counts as
    // a single attempt against MAX_SENDS, since only one HTTP call was made.
    async function recordDelivery(keys, send, kind) {
      attempts++;
      stage = 'delivery';
      const startedAt = now.toISOString();
      for (const key of keys) state.deliveries[key] = { state: 'sending', date: today, kind, startedAt };
      await store.save(state); // Persist intent before touching ntfy.
      const detail = {};
      const result = await send(detail);
      for (const key of keys) {
        const entry = state.deliveries[key];
        entry.state = result;
        if (detail.code) entry.code = detail.code;
      }
      if (detail.code === 'http_429' || detail.quota_until) {
        // A 429 is a definite rejection. A successful send with zero remaining
        // quota stays 'sent', but future sends pause before triggering a 429.
        const until = detail.retry_after_until || detail.quota_until ||
          new Date(Date.now() + (detail.retry_after_ms || DEFAULT_NTFY_BACKOFF_MS)).toISOString();
        if (!(Date.parse(state.ntfyBackoffUntil || '') > Date.parse(until))) {
          state.ntfyBackoffUntil = until;
        }
        state.ntfyBackoffReason = 'rate_limit';
      } else if (detail.code === 'http_401' || detail.code === 'http_403') {
        const until = Date.now() + AUTH_REJECT_BACKOFF_MS;
        // Never shorten a longer cooldown that is already in effect.
        if (!(Date.parse(state.ntfyBackoffUntil || '') > until)) {
          state.ntfyBackoffUntil = new Date(until).toISOString();
          state.ntfyBackoffReason = 'auth_rejected';
        }
      }
      await store.save(state); // A lost write leaves 'sending', never an implicit retry.
      stage = 'process';
      return result;
    }
    // Why something is still 'queued' after this cycle, for /health: a 429
    // cooldown in effect, or the per-cycle MAX_SENDS budget already spent.
    // (observe mode queues everything too, but that already shows as
    // status: 'observing' and needs no extra reason here.)
    const queuedBy = { backoff: 0, quota: 0 };
    const batchedResults = [];
    for (const row of rows) {
      const key = drawIdentity(row), entry = state.deliveries[key];
      row.notification_channels = previousChannels(row, historyByDraw.get(historyKey(row)) || []);
      if (entry?.state === 'sent') row.notification_channels.ntfy = 'sent';
      if (!scheduled(row, catalog, today)) { row.สถานะการแจ้งเตือน = row.notification_channels.ntfy === 'sent' ? 'sent' : 'not_scheduled'; continue; }
      if (row.notification_channels.ntfy === 'sent') { row.สถานะการแจ้งเตือน = 'sent'; continue; }
      // Restore unresolved delivery even if config is disabled: it must remain visible.
      if (entry?.state === 'uncertain') { row.notification_channels.ntfy = 'uncertain'; row.สถานะการแจ้งเตือน = 'uncertain'; continue; }
      row.สถานะการแจ้งเตือน = 'pending';
      if (!eligible(settings, row)) { row.สถานะการแจ้งเตือน = 'not_eligible'; continue; }
      if (!active) { row.สถานะการแจ้งเตือน = 'disabled'; continue; }
      if (observing) { row.สถานะการแจ้งเตือน = 'queued'; continue; }
      if (Date.parse(state.ntfyBackoffUntil || '') > Date.now()) { row.สถานะการแจ้งเตือน = 'queued'; queuedBy.backoff++; continue; }
      // Existing injected single-send tests still exercise the individual delivery path.
      if (dependencies.send) {
        if (attempts >= MAX_SENDS) { row.สถานะการแจ้งเตือน = 'queued'; queuedBy.quota++; continue; }
        const result = await recordDelivery([key], detail => dependencies.send(settings, row, topic, request, detail, ntfyToken), 'result');
        row.notification_channels.ntfy = result; row.สถานะการแจ้งเตือน = result;
        if (result === 'sent') sent++;
      } else {
        batchedResults.push(row);
      }
    }
    // Production sends at most MAX_SENDS requests per cycle, but bundles multiple
    // results in each publish to avoid the ntfy.sh daily message/request limits.
    // Each row still has a distinct durable key. If a batch times out, every key
    // remains uncertain and is NEVER automatically re-sent.
    for (let i = 0; i < batchedResults.length; i += MAX_RESULT_BATCH) {
      const batch = batchedResults.slice(i, i + MAX_RESULT_BATCH);
      if (Date.parse(state.ntfyBackoffUntil || '') > Date.now()) {
        for (const row of batch) row.สถานะการแจ้งเตือน = 'queued';
        queuedBy.backoff += batch.length;
        continue;
      }
      if (attempts >= MAX_SENDS) {
        for (const row of batch) row.สถานะการแจ้งเตือน = 'queued';
        queuedBy.quota += batch.length;
        continue;
      }
      const result = await recordDelivery(batch.map(drawIdentity), detail =>
        dependencies.sendBatch
          ? dependencies.sendBatch(batch, detail)
          : publishNtfy(settings, resultBatchMessage(batch), topic, request, detail, ntfyToken), 'result');
      for (const row of batch) {
        row.notification_channels.ntfy = result;
        row.สถานะการแจ้งเตือน = result;
      }
      if (result === 'sent') sent += batch.length;
    }
    // Reserve the existing send budget for results first and use the time after provider I/O.
    if (!observing && active && settings.notifications?.enabled !== false) {
      const clock = () => +(dependencies.now || new Date());
      const dueAlerts = dueScheduleAlerts(catalog, today, new Date(clock())).filter(alert => {
        const entry = state.deliveries[alert.key];
        return !(entry && entry.state !== 'failed') && clock() < alert.at;
      });
      // One ntfy send per cycle for every alert due right now, instead of one
      // send per lottery. Order is kept (dueScheduleAlerts sorts by time) so
      // the combined message still lists closings before upcoming draws.
      if (dueAlerts.length) {
        if (Date.parse(state.ntfyBackoffUntil || '') > Date.now()) queuedBy.backoff += dueAlerts.length;
        else if (attempts >= MAX_SENDS) queuedBy.quota += dueAlerts.length;
        else {
          await recordDelivery(dueAlerts.map(a => a.key),
            detail => publishNtfy(settings, scheduleBatchMessage(dueAlerts), topic, request, detail, ntfyToken), 'schedule');
        }
      }
    }
    // Overwritten every deliver cycle (not an array, so no retention/growth
    // concern); stays from the last deliver cycle if a later cycle is
    // observe/paused, which is fine since nothing is attempted there anyway.
    state.lastQueueSummary = { at: now.toISOString(), backoff: queuedBy.backoff, quota: queuedBy.quota };
    const merged = mergeRows(rows, history);
    const uncertainCounts = deliveryUncertainty(state.deliveries, now);
    const uncertain = uncertainCounts.recent;
    const todayDeliveries = Object.values(state.deliveries).filter(x => x.date === today);
    const unpublished = todayDeliveries.filter(x => x.state === 'sent' && !x.published);
    const alerts = { sent: unpublished.filter(x => x.kind === 'schedule').length,
      failed: todayDeliveries.filter(x => x.kind === 'schedule' && x.state === 'failed').length };
    const outputs = { 'lottery_previous_results.json': merged, 'status/status.json': makeStatus(status, rows,
      fetched.some(x => scheduled(x, catalog, today)), sources, { waiting, errors }, unpublished.length - alerts.sent, alerts, uncertainCounts, state.deliveries, now) };
    if (observing) {
      state.lastObservation = { at: now.toISOString(), results: fetched.length,
        scheduled: fetched.filter(x => scheduled(x, catalog, today)).length, sourceErrors: errors.length,
        candidates: rows.filter(x => x.สถานะการแจ้งเตือน === 'queued').length };
      state.error = null; state.error_stage = null;
      await store.save(state);
      return { observing: true, ...state.lastObservation };
    }
    stage = 'publish';
    state.pending = { baseHead: snapshot.head, rows, status: outputs[OUTPUTS[1]] };
    await store.save(state);
    await remote.publish(state.pending, () => store.assertLease(), {
      before: Object.fromEntries(OUTPUTS.map(path => [path, snapshot.data[path]])), outputs,
    });
    finishPublish(state, now);
    await store.save(state);
    return { sent, queued: rows.filter(x => x.สถานะการแจ้งเตือน === 'queued').length, uncertain };
  } catch (error) {
    state.error = safeError(error);
    state.error_stage = stage;
    // Failed save cannot be treated as successful delivery. The prior durable intent
    // remains authoritative; do not overwrite it from a catch handler.
    if (!['lease_lost', 'state_schema'].includes(state.error)) {
      try { await store.save(state); } catch { /* Health will expose stale success. */ }
    }
    throw new Error(state.error);
  } finally { await store.release(); }
}

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(cycle(env)); },
  async fetch(request, env) {
    if (request.method !== 'GET' || new URL(request.url).pathname !== '/health') return new Response('Not found', { status: 404 });
    try {
      const row = await env.DB.prepare('SELECT payload FROM worker_state WHERE id = 1').first();
      const state = JSON.parse(row.payload);
      const fresh = state.lastSuccess && Date.now() - Date.parse(state.lastSuccess) < 5 * 60000;
      const paused = env.ENABLED !== 'true', uncertainty = deliveryUncertainty(state.deliveries);
      const uncertain = uncertainty.recent;
      const healthy = !paused && fresh && !state.error && !state.pending && !uncertain && state.lastCheck?.status === 'healthy';
      const delivery_codes = {};
      for (const x of Object.values(state.deliveries)) if (['failed', 'sending', 'uncertain'].includes(x.state)) {
        const code = /^(http_\d{3}|timeout|network|request_budget|https_required)$/.test(x.code) ? x.code : 'unknown';
        delivery_codes[code] = (delivery_codes[code] || 0) + 1;
      }
      const observing = env.MODE !== 'deliver', observed = state.lastObservation;
      const ready = !paused && (observing ? observed && Date.now() - Date.parse(observed.at) < 5 * 60000 && !observed.sourceErrors && !state.error : healthy);
      // Why items are queued, not just that they are: an active ntfy 429
      // cooldown (and when it lifts), and/or how many hit the per-cycle
      // MAX_SENDS budget last cycle. Both were already tracked internally;
      // this only exposes them. Null fields mean "not currently applicable",
      // not "unknown".
      const backoffActive = Date.parse(state.ntfyBackoffUntil || '') > Date.now();
      return Response.json({ status: paused ? 'paused' : observing ? 'observing' : healthy ? 'healthy' : 'degraded', last_success: state.lastSuccess,
        last_observation: observed || null, last_check: state.lastCheck || null, error: state.error, error_stage: state.error_stage || null,
        publish_pending: Boolean(state.pending), uncertain_deliveries: uncertainty.total,
        active_uncertain_deliveries: uncertain, old_uncertain_deliveries: uncertainty.old,
        delivery_codes, poll_seconds: 60,
        ntfy_backoff_until: backoffActive ? state.ntfyBackoffUntil : null,
        ntfy_backoff_reason: backoffActive ? (state.ntfyBackoffReason || 'rate_limit') : null,
        last_queue_summary: state.lastQueueSummary || null },
      { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
    } catch { return Response.json({ status: 'unavailable' }, { status: 503 }); }
  },
};