const ACTIONS = new Set([
  'pause_all', 'resume_all', 'quarantine_lottery', 'unquarantine_lottery',
  'disable_source', 'enable_source', 'run_probe', 'send_test_push',
  'retry_failed_delivery', 'resolve_uncertain_sent', 'resolve_uncertain_failed',
]);
const SOURCES = new Set(['thailottoapi', 'pholhuay', 'lotterychecks', 'glo', 'ranlotto']);
const MAX_CONTROLS_PER_CYCLE = 5;
const MAX_RESPONSE = 1_000_000;
const DASHBOARD_SYNC_INTERVAL = 5 * 60000;

function config(env) {
  const values = {
    token: String(env.CODA_API_TOKEN || '').trim(),
    doc: String(env.CODA_DOC_ID || '').trim(),
    table: String(env.CODA_CONTROL_TABLE_ID || '').trim(),
  };
  if (!values.token || !values.doc || !values.table) return null;
  if (![values.doc, values.table].every(x => /^[A-Za-z0-9_-]{2,128}$/.test(x))) return null;
  return values;
}
function controls(state) {
  if (!state.controls || typeof state.controls !== 'object' || Array.isArray(state.controls)) {
    state.controls = { paused: false, quarantined: [], disabledSources: [] };
  }
  state.controls.quarantined = [...new Set(Array.isArray(state.controls.quarantined) ? state.controls.quarantined : [])];
  state.controls.disabledSources = [...new Set(Array.isArray(state.controls.disabledSources) ? state.controls.disabledSources : [])];
  return state.controls;
}

function activeUncertain(state, now) {
  return Object.values(state.deliveries || {}).some(entry => {
    if (!['sending', 'uncertain'].includes(entry?.state)) return false;
    const at = Date.parse(entry.startedAt || `${entry.date}T23:59:59+07:00`);
    return !Number.isFinite(at) || +now - at <= 86400000;
  });
}

function requestedRow(item) {
  const values = item?.values;
  if (!item?.id || !values || typeof values !== 'object' || String(values.Status || '').toLowerCase() !== 'requested') return null;
  const action = String(values.Action || '').trim().toLowerCase();
  const requestedAt = Date.parse(values['Requested At']);
  const expiresAt = Date.parse(values['Expires At']);
  return { requestId: item.id, action, target: String(values.Target || '').trim(),
    desiredValue: String(values['Desired Value'] || '').trim(), evidence: String(values.Evidence || '').trim(),
    requestedAt, expiresAt };
}

function apply(control, state, now) {
  const current = controls(state), add = (name, value) => { current[name] = [...new Set([...current[name], value])]; },
    remove = (name, value) => { current[name] = current[name].filter(x => x !== value); };
  if (!ACTIONS.has(control.action)) return { result: 'rejected', reason: 'unknown_action' };
  if (!Number.isFinite(control.requestedAt) || !Number.isFinite(control.expiresAt) || control.requestedAt > +now + 60000 || control.expiresAt <= +now) {
    return { result: 'rejected', reason: 'expired_request' };
  }
  if (control.action === 'pause_all') current.paused = true;
  else if (control.action === 'resume_all') {
    if (state.pending || activeUncertain(state, now)) return { result: 'rejected', reason: 'health_gate' };
    current.paused = false;
  } else if (['quarantine_lottery', 'unquarantine_lottery'].includes(control.action)) {
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(control.target)) return { result: 'rejected', reason: 'invalid_target' };
    (control.action === 'quarantine_lottery' ? add : remove)('quarantined', control.target);
  } else if (['disable_source', 'enable_source'].includes(control.action)) {
    if (!SOURCES.has(control.target)) return { result: 'rejected', reason: 'invalid_target' };
    (control.action === 'disable_source' ? add : remove)('disabledSources', control.target);
  } else if (control.action === 'send_test_push') {
    if (state.controlTestPush?.requestedAt && +now - Date.parse(state.controlTestPush.requestedAt) < 60000) {
      return { result: 'rejected', reason: 'rate_limited' };
    }
    state.controlTestPush = { requestId: control.requestId, requestedAt: now.toISOString() };
  } else if (control.action === 'retry_failed_delivery') {
    const delivery = state.deliveries?.[control.target];
    if (!delivery || delivery.state !== 'failed') return { result: 'rejected', reason: 'not_failed' };
    delivery.retryRequestedAt = now.toISOString();
  } else if (control.action.startsWith('resolve_uncertain_')) {
    const delivery = state.deliveries?.[control.target];
    if (!delivery || !['sending', 'uncertain'].includes(delivery.state)) return { result: 'rejected', reason: 'not_uncertain' };
    if (control.evidence.length < 5 || control.evidence.length > 500) return { result: 'rejected', reason: 'evidence_required' };
    delivery.state = control.action.endsWith('_sent') ? 'sent' : 'failed';
    delivery.resolutionEvidence = control.evidence;
    delivery.resolvedAt = now.toISOString();
  } else if (control.action === 'run_probe') state.controlProbeRequestedAt = now.toISOString();
  current.lastRevision = control.requestId;
  return { result: 'applied', reason: null };
}

async function body(response) {
  const text = await response.text();
  if (text.length > MAX_RESPONSE) throw new Error('coda_invalid_response');
  return JSON.parse(text);
}

async function acknowledge(request, cfg, requestId, result, reason) {
  const url = `https://coda.io/apis/v1/docs/${cfg.doc}/tables/${cfg.table}/rows/${requestId}`;
  const cells = [{ column: 'Status', value: result }, { column: 'Result', value: reason || result }];
  const response = await request(url, { method: 'PUT', timeoutMs: 3000,
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ row: { cells } }) });
  if (!response.ok) { await response.body?.cancel(); throw new Error('coda_ack_failed'); }
}

export async function syncCodaControls(env, state, request, now = new Date()) {
  const cfg = config(env);
  if (!cfg) return { configured: false, applied: 0, rejected: 0 };
  const url = `https://coda.io/apis/v1/docs/${cfg.doc}/tables/${cfg.table}/rows?useColumnNames=true&limit=100&sortBy=createdAt&direction=desc`;
  let response;
  try {
    response = await request(url, { method: 'GET', timeoutMs: 3000,
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/json' } });
    if (!response.ok) { await response.body?.cancel(); throw new Error('coda_http'); }
    const data = await body(response);
    if (!Array.isArray(data.items)) throw new Error('coda_invalid_response');
    const prior = await env.DB.prepare('SELECT request_id FROM coda_control_requests ORDER BY requested_at DESC LIMIT 200').all();
    const seen = new Set(prior.results.map(x => x.request_id));
    const candidates = data.items.map(requestedRow).filter(Boolean).filter(x => !seen.has(x.requestId)).slice(0, MAX_CONTROLS_PER_CYCLE);
    const statements = [], acknowledgements = []; let applied = 0, rejected = 0;
    for (const control of candidates) {
      const outcome = apply(control, state, now);
      outcome.result === 'applied' ? applied++ : rejected++;
      statements.push(env.DB.prepare(`INSERT OR IGNORE INTO coda_control_requests
        (request_id, action, target, desired_value, evidence, requested_at, expires_at, applied_at, result, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(control.requestId, control.action, control.target || null, control.desiredValue || null,
          control.evidence || null, control.requestedAt, control.expiresAt, +now, outcome.result, outcome.reason));
      acknowledgements.push({ requestId: control.requestId, ...outcome });
    }
    if (statements.length) await env.DB.batch(statements);
    for (const ack of acknowledgements) {
      try { await acknowledge(request, cfg, ack.requestId, ack.result, ack.reason); } catch { /* D1 audit is authoritative; retry is manual. */ }
    }
    state.codaSync = { at: now.toISOString(), status: 'ok', applied, rejected };
    return { configured: true, applied, rejected };
  } catch {
    state.codaSync = { at: now.toISOString(), status: 'error', applied: 0, rejected: 0 };
    return { configured: true, applied: 0, rejected: 0, error: 'coda_sync' };
  }
}

export function applyControlOverrides(settings, state) {
  const result = structuredClone(settings), disabled = new Set(controls(state).disabledSources);
  for (const [name, source] of Object.entries(result.sources || {})) if (disabled.has(name)) source.enabled = false;
  return result;
}

export function isQuarantined(state, lotteryId) {
  return controls(state).quarantined.includes(lotteryId);
}

function dashboardConfig(env) {
  const base = config(env), tables = {
    lotteries: String(env.CODA_LOTTERIES_TABLE_ID || '').trim(),
    verification: String(env.CODA_VERIFICATION_TABLE_ID || '').trim(),
    incidents: String(env.CODA_INCIDENTS_TABLE_ID || '').trim(),
  };
  if (!base || !Object.values(tables).every(x => /^[A-Za-z0-9_-]{2,128}$/.test(x))) return null;
  return { ...base, tables };
}

const cells = values => Object.entries(values).map(([column, value]) => ({ column, value }));
async function upsertRows(request, cfg, table, rows, keyColumn) {
  if (!rows.length) return;
  const response = await request(`https://coda.io/apis/v1/docs/${cfg.doc}/tables/${table}/rows`, {
    method: 'POST', timeoutMs: 4000, headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: rows.map(values => ({ cells: cells(values) })), keyColumns: [keyColumn] }),
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error('coda_dashboard_write'); }
}

export async function syncCodaDashboard(env, state, report, request, now = new Date()) {
  const cfg = dashboardConfig(env);
  if (!cfg) return { configured: false };
  if (Date.parse(state.codaDashboardSync?.at || '') + DASHBOARD_SYNC_INTERVAL > +now) return { configured: true, skipped: true };
  const groups = [...report.verified.map(x => ['verified', x]), ...report.pending.map(x => ['waiting_for_evidence', x]),
    ...report.conflicts.map(x => ['conflict', x])];
  const verification = groups.map(([status, group]) => ({
    'Draw Key': group.key, 'Lottery ID': group.item.id, 'Draw Date': group.date, Status: status,
    'Source Count': group.sourceFamilies.length, Sources: group.sourceFamilies.join(', '), 'Updated At': now.toISOString(),
  }));
  const lotteries = groups.map(([status, group]) => ({
    'Lottery ID': group.item.id, Name: group.item.name, 'Draw Date': group.date, Status: status,
    'Source Count': group.sourceFamilies.length, Sources: group.sourceFamilies.join(', '),
    'Top 3': group.row?.เลขบน_3_ตัว || '', 'Bottom 2': group.row?.เลขล่าง_2_ตัว || '', 'Updated At': now.toISOString(),
  }));
  const incidents = [
    ...report.conflicts.map(group => ({ 'Incident Key': `conflict:${group.key}`, Type: 'result_conflict',
      'Lottery ID': group.item.id, 'Draw Date': group.date, Details: group.values.join(' | '), Status: 'open', 'Updated At': now.toISOString() })),
    ...report.unmapped.map((item, index) => ({ 'Incident Key': `unmapped:${item.reason}:${index}:${now.toISOString().slice(0, 10)}`,
      Type: 'unmapped_evidence', 'Lottery ID': item.row?.หวย || '', 'Draw Date': item.row ? String(item.row.วันที่จัดรูปแบบ || '') : '',
      Details: item.reason, Status: 'open', 'Updated At': now.toISOString() })),
  ];
  try {
    await upsertRows(request, cfg, cfg.tables.lotteries, lotteries, 'Lottery ID');
    await upsertRows(request, cfg, cfg.tables.verification, verification, 'Draw Key');
    await upsertRows(request, cfg, cfg.tables.incidents, incidents, 'Incident Key');
    state.codaDashboardSync = { at: now.toISOString(), status: 'ok', rows: verification.length };
    return { configured: true, rows: verification.length };
  } catch {
    state.codaDashboardSync = { at: now.toISOString(), status: 'error', rows: 0 };
    return { configured: true, error: 'coda_dashboard_sync' };
  }
}
