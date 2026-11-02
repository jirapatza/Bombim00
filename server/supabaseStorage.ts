import { createHash } from 'node:crypto';

export class SupabaseStorageError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = 'SUPABASE_STORAGE_ERROR') {
    super(message);
    this.name = 'SupabaseStorageError';
    this.status = status;
    this.code = code;
  }
}

type SupabaseOptions = {
  url?: string;
  key?: string;
  fetchImpl?: typeof fetch;
};

function config(options: SupabaseOptions = {}) {
  const url = (options.url || process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (options.key || process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !key) {
    throw new SupabaseStorageError('Supabase server credentials are not configured.', 503, 'SUPABASE_NOT_CONFIGURED');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SupabaseStorageError('SUPABASE_URL is invalid.', 500, 'SUPABASE_URL_INVALID');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new SupabaseStorageError('SUPABASE_URL must be an HTTPS project origin.', 500, 'SUPABASE_URL_INVALID');
  }
  return { url, key, fetchImpl: options.fetchImpl || fetch };
}

async function request<T>(path: string, init: RequestInit = {}, options: SupabaseOptions = {}): Promise<T> {
  const { url, key, fetchImpl } = config(options);
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('Accept', 'application/json');
  // Legacy service_role keys are JWTs. Modern sb_secret keys are standalone API keys.
  if (!key.startsWith('sb_secret_')) headers.set('Authorization', `Bearer ${key}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetchImpl(`${url}/rest/v1/${path}`, {
      ...init,
      headers,
      signal: init.signal || AbortSignal.timeout(12000),
    });
  } catch (error: any) {
    throw new SupabaseStorageError(
      error?.name === 'TimeoutError' ? 'Supabase request timed out.' : 'Supabase request failed.',
      502,
      'SUPABASE_NETWORK_ERROR',
    );
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new SupabaseStorageError(`Supabase request failed (HTTP ${response.status}). ${detail}`.trim(), response.status);
  }
  if (response.status === 204) return undefined as T;
  try {
    return await response.json() as T;
  } catch {
    throw new SupabaseStorageError('Supabase returned invalid JSON.', 502, 'SUPABASE_INVALID_JSON');
  }
}

async function readPayload(table: string, query: string, options?: SupabaseOptions) {
  const rows = await request<Array<{ payload: unknown }>>(
    `${table}?select=payload&${query}`,
    {},
    options,
  );
  if (!Array.isArray(rows)) throw new SupabaseStorageError(`Supabase table ${table} returned an invalid shape.`);
  return rows.map((row) => row.payload);
}

export async function readSupabaseResults(options?: SupabaseOptions): Promise<any[]> {
  return readPayload('lottery_results', 'order=created_at.desc&limit=1000', options) as Promise<any[]>;
}

export async function readSupabaseCatalog(options?: SupabaseOptions): Promise<any[]> {
  return readPayload('lottery_catalog', 'order=lottery_id.asc&limit=1000', options) as Promise<any[]>;
}

export async function readSupabaseSingleton(table: 'app_settings' | 'system_status' | 'self_healing_history', options?: SupabaseOptions): Promise<any> {
  const rows = await readPayload(table, 'id=eq.main&limit=1', options);
  if (rows.length === 0) {
    if (table === 'self_healing_history') return [];
    throw new SupabaseStorageError(`Supabase ${table} record is missing.`, 404, 'SUPABASE_RECORD_NOT_FOUND');
  }
  return rows[0];
}

export async function probeSupabase(options?: SupabaseOptions): Promise<{ configured: true; reachable: true; tables: string[] }> {
  await request('app_settings?select=id&limit=1', {}, options);
  return {
    configured: true,
    reachable: true,
    tables: ['lottery_results', 'lottery_catalog', 'app_settings', 'system_status', 'self_healing_history'],
  };
}

export function resultFingerprint(row: Record<string, unknown>): string {
  const name = String(row['ชื่อหวย'] || row.lottery_name || row['หวย'] || row.id || 'หวยไม่ระบุชื่อ')
    .trim().toLocaleLowerCase('th-TH').replace(/\s+/g, ' ');
  const date = String(row['งวดวันที่'] || row['วันที่จัดรูปแบบ'] || row.draw_date || '').trim();
  const top = String(row['เลขบน_3_ตัว'] || row.top3 || row['รางวัลที่_1'] || '').trim();
  const bottom = String(row['เลขท้าย_2_ตัว'] || row['เลขล่าง_2_ตัว'] || row.bottom2 || '').trim();
  return createHash('sha256').update([name, date, top.slice(-3), bottom.slice(-2)].join('|')).digest('hex');
}
