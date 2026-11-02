import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeSupabase,
  readSupabaseCatalog,
  readSupabaseResults,
  readSupabaseSingleton,
  SupabaseStorageError,
} from '../server/supabaseStorage.ts';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

test('Supabase secret key is sent as apikey and never as a Bearer token', async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, headers: new Headers(init.headers) };
    return jsonResponse([{ payload: { ok: true } }]);
  };
  const rows = await readSupabaseResults({
    url: 'https://project.supabase.co',
    key: 'sb_secret_test_only',
    fetchImpl,
  });
  assert.deepEqual(rows, [{ ok: true }]);
  assert.equal(seen.headers.get('apikey'), 'sb_secret_test_only');
  assert.equal(seen.headers.has('authorization'), false);
  assert.match(seen.url, /lottery_results\?select=payload/);
});

test('legacy service_role JWT uses the server-only Bearer header', async () => {
  let seen;
  const fetchImpl = async (_url, init) => {
    seen = new Headers(init.headers);
    return jsonResponse([{ payload: { id: 'x' } }]);
  };
  await readSupabaseCatalog({
    url: 'https://project.supabase.co',
    key: 'legacy-service-role-jwt',
    fetchImpl,
  });
  assert.equal(seen.get('authorization'), 'Bearer legacy-service-role-jwt');
});

test('singleton reads return payload and missing audit history is an empty list', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('self_healing_history')) return jsonResponse([]);
    return jsonResponse([{ payload: { enabled: true } }]);
  };
  assert.deepEqual(await readSupabaseSingleton('app_settings', {
    url: 'https://project.supabase.co', key: 'sb_secret_test', fetchImpl,
  }), { enabled: true });
  assert.deepEqual(await readSupabaseSingleton('self_healing_history', {
    url: 'https://project.supabase.co', key: 'sb_secret_test', fetchImpl,
  }), []);
});

test('Supabase configuration rejects non-HTTPS URLs and reports missing credentials safely', async () => {
  await assert.rejects(
    () => probeSupabase({ url: 'http://project.supabase.co', key: 'sb_secret_test', fetchImpl: async () => jsonResponse([]) }),
    (error) => error instanceof SupabaseStorageError && error.code === 'SUPABASE_URL_INVALID',
  );
  await assert.rejects(
    () => probeSupabase({ url: 'https://project.supabase.co', key: '' }),
    (error) => error instanceof SupabaseStorageError && error.code === 'SUPABASE_NOT_CONFIGURED',
  );
});

test('probe checks a server-side table without returning credentials', async () => {
  let requestUrl = '';
  const result = await probeSupabase({
    url: 'https://project.supabase.co',
    key: 'sb_secret_test',
    fetchImpl: async (url) => {
      requestUrl = String(url);
      return jsonResponse([{ id: 'main' }]);
    },
  });
  assert.equal(result.reachable, true);
  assert.match(requestUrl, /app_settings\?select=id/);
  assert.equal(JSON.stringify(result).includes('sb_secret'), false);
});
