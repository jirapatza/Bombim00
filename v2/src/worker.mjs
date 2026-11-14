// Phase 1 only: a separate heartbeat, with no lottery data or notification sends.
export async function recordHeartbeat(db, now = new Date()) {
  const at = now.toISOString();
  await db.prepare("INSERT INTO run_log (id, started_at, finished_at, status) VALUES (?, ?, ?, 'success')")
    .bind(crypto.randomUUID(), at, at).run();
}

export async function health(db, now = Date.now()) {
  const row = await db.prepare("SELECT finished_at FROM run_log WHERE status = 'success' ORDER BY finished_at DESC LIMIT 1").first();
  const timestamp = Date.parse(row?.finished_at || '');
  const fresh = Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= 600000;
  return { status: fresh ? 'healthy' : 'degraded', last_success: row?.finished_at || null };
}

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(recordHeartbeat(env.DB)); },
  async fetch(request, env) {
    if (request.method !== 'GET' || new URL(request.url).pathname !== '/health') return new Response('Not found', { status: 404 });
    try {
      const result = await health(env.DB);
      return Response.json(result, { status: result.status === 'healthy' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return Response.json({ status: 'unavailable', last_success: null }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  },
};
