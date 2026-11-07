// Local-only configuration. Does not deploy, change a plan, or copy credentials.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export function configuration(databaseId, accountId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId) || /^0{8}-/.test(databaseId)) throw new Error('กรุณาใส่ database_id ของ D1 ที่สร้างไว้');
  if (accountId && !/^[0-9a-f]{32}$/i.test(accountId)) throw new Error('account_id ไม่ถูกต้อง');
  const config = JSON.parse(readFileSync(new URL('./wrangler.jsonc', import.meta.url), 'utf8'));
  config.d1_databases[0].database_id = databaseId;
  if (accountId) config.account_id = accountId;
  return config;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const destination = new URL('./wrangler.local.json', import.meta.url);
  if (existsSync(destination)) throw new Error('มี wrangler.local.json แล้ว กรุณาตรวจไฟล์เดิมก่อน เพื่อรักษาการตั้งค่าปัจจุบัน');
  writeFileSync(destination, JSON.stringify(configuration(process.argv[2] || '', process.argv[3]), null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log('เตรียม wrangler.local.json แล้ว: ENABLED=false, MODE=observe ยังไม่ได้ติดตั้งหรือส่งแจ้งเตือน');
}
