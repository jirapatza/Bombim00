// Explicit operator reconciliation; never guesses whether ntfy accepted a send.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const deliveryId = key => createHash('sha256').update(key).digest('hex');
const sqlString = value => "'" + String(value).replaceAll("'", "''") + "'";
export function resolutionSQL(key, state, evidence, now) {
  if (!['sent', 'failed'].includes(state) || typeof evidence !== 'string' || evidence.trim().length < 5 || evidence.length > 500) throw new Error('ต้องระบุ sent หรือ failed และหลักฐานการตรวจ ntfy');
  return `UPDATE worker_state SET payload = json_patch(payload, json_object('deliveries', json_object(${sqlString(key)}, json_object('state', ${sqlString(state)}, 'published', json('false'), 'evidence', ${sqlString(evidence)}))))
WHERE id = 1 AND lease_until < ${Math.floor(now)} AND json_extract(payload, '$.pending') IS NULL
AND EXISTS (SELECT 1 FROM json_each(payload, '$.deliveries') WHERE key = ${sqlString(key)} AND json_extract(value, '$.state') IN ('sending', 'uncertain'));`;
}
function query(sql, local, config) {
  const scratch = mkdtempSync(join(tmpdir(), 'lottery-recovery-'));
  try {
    const file = join(scratch, 'query.sql'); writeFileSync(file, sql, { mode: 0o600 });
    const result = spawnSync(join(dirname(fileURLToPath(import.meta.url)), 'node_modules/.bin/wrangler'),
      ['d1', 'execute', 'DB', '--config', config, local ? '--local' : '--remote', '--file', file, '--json'],
      { cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8' });
    if (result.status !== 0) throw new Error('D1 query failed; inspect account/configuration without printing credentials');
    return JSON.parse(result.stdout);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, id, state, evidence] = process.argv.slice(2).filter(x => x !== '--local');
  const local = process.argv.includes('--local'), config = local ? 'wrangler.jsonc' : 'wrangler.local.json';
  const response = query("SELECT key, value FROM worker_state, json_each(worker_state.payload, '$.deliveries') WHERE json_extract(value, '$.state') IN ('uncertain', 'sending')", local, config);
  const entries = response.flatMap(x => x.results || []);
  if (command === 'status') {
    console.log(JSON.stringify(entries.map(x => ({ id: deliveryId(x.key), draw: JSON.parse(x.key), ...JSON.parse(x.value) })), null, 2));
  } else if (command === 'resolve') {
    const entry = entries.find(x => deliveryId(x.key) === id);
    if (!entry) throw new Error('ไม่พบรายการที่ยังไม่ทราบผล');
    const result = query(resolutionSQL(entry.key, state, evidence, Date.now()), local, config);
    if (result.reduce((n, x) => n + Number(x.meta?.changes || 0), 0) !== 1) throw new Error('ยังมี lease หรือ pending: หยุด Worker และตรวจสถานะก่อน');
    console.log('บันทึกผลตรวจสอบแล้ว ไม่มีการส่ง ntfy จากคำสั่งนี้');
  } else throw new Error('ใช้: node recovery.mjs status หรือ node recovery.mjs resolve <id> <sent|failed> "หลักฐานการตรวจ"');
}
