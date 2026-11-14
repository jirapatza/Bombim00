export const INPUTS = ['config/settings.json', 'data/all_lotteries.json', 'lottery_previous_results.json', 'status/status.json'];
export const OUTPUTS = ['lottery_previous_results.json', 'status/status.json'];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Fixed endpoint labels only: never persist URLs, request bodies, tokens or transport messages.
function githubEndpoint(path) {
  if (path.startsWith('/git/ref/')) return 'ref';
  if (path === '/git/commits' || path.startsWith('/git/commits/') || path.startsWith('/git/trees')) return 'commit';
  if (path.startsWith('/contents/')) return 'contents';
  if (path.startsWith('/actions/')) return 'writer';
  if (path.startsWith('/git/refs/')) return 'publish';
  return 'other';
}
function githubTransportError(error, path) {
  if (error?.message === 'request_budget' || error?.message === 'https_required') return error;
  // An explicit abort is not evidence of a transient network failure: do not retry it.
  const kind = error?.name === 'AbortError' ? 'aborted' : error?.name === 'TimeoutError' ? 'timeout' : 'network';
  return new Error(`github_${kind}_${githubEndpoint(path)}`);
}

export class RuntimeRepository {
  constructor(repository, token, request) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !token) throw new Error('github_configuration');
    this.base = `https://api.github.com/repos/${repository}`;
    this.token = token; this.request = request;
  }
  async api(method, path, body, accept = 'application/vnd.github+json') {
    // A retry is safe only for idempotent reads. Never repeat Git writes or ntfy sends.
    const maxAttempts = method === 'GET' ? 2 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let response;
      try {
        response = await this.request(this.base + path, { method, redirect: 'manual',
          headers: { Authorization: `Bearer ${this.token}`, Accept: accept,
            'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Bombim00-Cloudflare', 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body) });
      } catch (error) {
        const safe = githubTransportError(error, path);
        if (attempt + 1 < maxAttempts && /^github_(network|timeout)_/.test(safe.message)) continue;
        throw safe;
      }
      if (!response.ok) {
        await response.body?.cancel();
        if (attempt + 1 < maxAttempts && [502, 503, 504].includes(response.status)) continue;
        // Keep the message stable; add fixed, non-secret labels so /health can show WHICH request was refused.
        throw Object.assign(new Error(`github_http_${response.status}`), { github: { method, endpoint: githubEndpoint(path) } });
      }
      try { return await response.json(); } catch { throw new Error('github_invalid_response'); }
    }
  }
  async assertWriter() {
    // The main-branch cutover marker is merged together with the PR-only
    // GitHub workflow. A missing or stale marker fails closed before ntfy sends.
    const gate = await this.api('GET', '/contents/cloudflare/PRIMARY_CHECKER.json?ref=main',
      undefined, 'application/vnd.github.raw+json');
    if (gate?.mode !== 'cloudflare' || gate?.legacy_workflow !== 'pr-only' || gate?.poll_seconds !== 60) throw new Error('writer_mode');
    // Query each active state: an old queued run must not be hidden by newer completed runs.
    for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
      const data = await this.api('GET', `/actions/workflows/lottery.yml/runs?status=${status}&per_page=100`);
      if (!Array.isArray(data.workflow_runs) || data.workflow_runs.length === 100 ||
        data.workflow_runs.some(x => x.event !== 'pull_request')) throw new Error('actions_active');
    }
  }
  async snapshot(paths = INPUTS) {
    const head = (await this.api('GET', '/git/ref/heads/runtime-live')).object.sha;
    const tree = (await this.api('GET', `/git/commits/${head}`)).tree.sha;
    const data = {};
    for (const path of paths) {
      // Raw media avoids base64 conversion in JS within the Free CPU allowance.
      data[path] = await this.api('GET', `/contents/${path}?ref=${head}`, undefined, 'application/vnd.github.raw+json');
    }
    return { head, tree, data };
  }
  async readAt(head, paths) {
    if (!/^[0-9a-f]{40}$/.test(head)) throw new Error('runtime_schema');
    const data = {};
    for (const path of paths) data[path] = await this.api('GET', `/contents/${path}?ref=${head}`, undefined, 'application/vnd.github.raw+json');
    return data;
  }
  async publish(pending, assertLease = async () => {}, prepared) {
    if (!pending || !Array.isArray(pending.rows) || !pending.status || !/^[0-9a-f]{40}$/.test(pending.baseHead)) throw new Error('runtime_schema');
    // Only today's changed rows and status live in D1. Rebuild immutable archived
    // history from the pinned Git commit on retry, avoiding D1's 2 MB row limit.
    const before = prepared?.before || await this.readAt(pending.baseHead, OUTPUTS);
    if (!Array.isArray(before[OUTPUTS[0]]) || !before[OUTPUTS[1]]) throw new Error('runtime_schema');
    const outputs = prepared?.outputs || { [OUTPUTS[0]]: mergeRows(pending.rows, before[OUTPUTS[0]]), [OUTPUTS[1]]: pending.status };
    const latest = await this.snapshot(OUTPUTS);
    if (OUTPUTS.every(path => equal(latest.data[path], outputs[path]))) return;
    if (OUTPUTS.some(path => !equal(latest.data[path], before[path]))) throw new Error('runtime_conflict');
    const tree = (await this.api('POST', '/git/trees', { base_tree: latest.tree,
      tree: OUTPUTS.map(path => ({ path, mode: '100644', type: 'blob', content: JSON.stringify(outputs[path], null, 2) })) })).sha;
    const commit = (await this.api('POST', '/git/commits', { message: 'chore(bot): update lottery results and status [skip ci] [skip render]',
      tree, parents: [latest.head] })).sha;
    await assertLease();
    await this.api('PATCH', '/git/refs/heads/runtime-live', { sha: commit, force: false });
  }
}

// One row stores the lease and durable ledger. All mutations require the current
// lease token; a resumed older invocation cannot replace a newer invocation's state.
export class DurableState {
  constructor(db, clock = Date.now) { this.db = db; this.clock = clock; this.token = crypto.randomUUID(); }
  async acquire() {
    const result = await this.db.prepare('UPDATE worker_state SET lease_token = ?, lease_until = ? WHERE id = 1 AND lease_until < ? RETURNING payload')
      .bind(this.token, this.clock() + 180000, this.clock()).first();
    if (!result) return null;
    const state = JSON.parse(result.payload);
    if (state.version !== 1 || !state.deliveries || typeof state.deliveries !== 'object' || Array.isArray(state.deliveries)) throw new Error('state_schema');
    return state;
  }
  async assertLease() {
    const row = await this.db.prepare('SELECT lease_token, lease_until FROM worker_state WHERE id = 1').first();
    if (row?.lease_token !== this.token || row.lease_until <= this.clock()) throw new Error('lease_lost');
  }
  async save(state) {
    const result = await this.db.prepare('UPDATE worker_state SET payload = ? WHERE id = 1 AND lease_token = ? AND lease_until > ?')
      .bind(JSON.stringify(state), this.token, this.clock()).run();
    if (result.meta.changes !== 1) throw new Error('lease_lost');
  }
  async release() {
    await this.db.prepare('UPDATE worker_state SET lease_token = NULL, lease_until = 0 WHERE id = 1 AND lease_token = ?').bind(this.token).run();
  }
}

export function validateSnapshot(snapshot) {
  const settings = snapshot.data['config/settings.json'], catalog = snapshot.data['data/all_lotteries.json'],
    history = snapshot.data['lottery_previous_results.json'], status = snapshot.data['status/status.json'];
  if (!settings || Array.isArray(settings) || typeof settings !== 'object' || !Array.isArray(catalog) ||
    !catalog.every(x => x && typeof x.name === 'string' && typeof x.drawDays === 'string') ||
    !Array.isArray(history) || !history.every(x => x && typeof x === 'object' && !Array.isArray(x)) ||
    !status || typeof status !== 'object' || Array.isArray(status)) throw new Error('runtime_schema');
  return { settings, catalog, history, status };
}
import { mergeRows } from './domain.js';
