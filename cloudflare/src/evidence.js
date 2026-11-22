const encoder = new TextEncoder();

async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
// Evidence is content-addressed, so a repeated observation carries no new
// information. Writing it again every cycle (once a minute) burned D1 row-write
// quota without changing a single row.
export async function recordConsensus(db, report, now = new Date()) {
  if (!db?.batch) return;
  const at = +now, evidence = [];
  for (const item of report.evidence) {
    const canonical = JSON.stringify([item.lotteryId, item.drawDate, item.sourceFamily, item.top3, item.bottom2]);
    const hash = await sha256(canonical);
    evidence.push({ key: hash, drawKey: item.drawKey, lotteryId: item.lotteryId, drawDate: item.drawDate,
      sourceFamily: item.sourceFamily, top3: item.top3, bottom2: item.bottom2, at, hash });
  }
  const draws = [];
  for (const [status, groups] of [['verified', report.verified], ['waiting_for_evidence', report.pending], ['conflict', report.conflicts]]) {
    for (const group of groups) draws.push({ key: group.key, lotteryId: group.item.id, drawDate: group.date,
      status, sourceCount: group.sourceFamilies.length, sources: group.sourceFamilies, at });
  }
  const statements = [];
  if (evidence.length) statements.push(db.prepare(`INSERT INTO verification_evidence
    (evidence_key, draw_key, lottery_id, draw_date, source_family, top3, bottom2, observed_at, raw_hash)
    SELECT json_extract(value, '$.key'), json_extract(value, '$.drawKey'), json_extract(value, '$.lotteryId'),
      json_extract(value, '$.drawDate'), json_extract(value, '$.sourceFamily'), json_extract(value, '$.top3'),
      json_extract(value, '$.bottom2'), json_extract(value, '$.at'), json_extract(value, '$.hash') FROM json_each(?) WHERE true
    ON CONFLICT(evidence_key) DO NOTHING`)
    .bind(JSON.stringify(evidence)));
  if (draws.length) statements.push(db.prepare(`INSERT INTO verification_draws
    (draw_key, lottery_id, draw_date, status, source_count, sources, updated_at)
    SELECT json_extract(value, '$.key'), json_extract(value, '$.lotteryId'), json_extract(value, '$.drawDate'),
      json_extract(value, '$.status'), json_extract(value, '$.sourceCount'), json_extract(value, '$.sources'),
      json_extract(value, '$.at') FROM json_each(?) WHERE true
    ON CONFLICT(draw_key) DO UPDATE SET status = excluded.status, source_count = excluded.source_count,
      sources = excluded.sources, updated_at = excluded.updated_at
    WHERE verification_draws.status <> excluded.status
      OR verification_draws.source_count <> excluded.source_count
      OR verification_draws.sources <> excluded.sources`)
    .bind(JSON.stringify(draws)));
  if (statements.length) await db.batch(statements);
}
