import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeSupabase,
  readSupabaseCatalog,
  readSupabaseResults,
  readSupabaseSingleton,
  SupabaseStorageError,
  writeSupabaseCatalog,
  writeSupabaseSingleton,
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
  const requestUrls = [];
  const result = await probeSupabase({
    url: 'https://project.supabase.co',
    key: 'sb_secret_test',
    fetchImpl: async (url) => {
      requestUrls.push(String(url));
      return jsonResponse([{ id: 'main' }]);
    },
  });
  assert.equal(result.reachable, true);
  assert.equal(requestUrls.length, 8);
  for (const table of ['lottery_results', 'lottery_catalog', 'app_settings', 'system_status',
    'self_healing_history', 'notification_events', 'legacy_import_batches', 'notification_suppressions']) {
    assert.ok(requestUrls.some((url) => url.includes(`/${table}?`)), `missing probe for ${table}`);
  }
  assert.equal(JSON.stringify(result).includes('sb_secret'), false);
});

test('singleton and catalog writes use idempotent PostgREST upserts', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), method: init.method, headers: new Headers(init.headers), body: init.body });
    return new Response(null, { status: 204 });
  };
  await writeSupabaseSingleton('app_settings', { enabled: true }, {
    url: 'https://project.supabase.co', key: 'sb_secret_test', fetchImpl,
  });
  await writeSupabaseCatalog([{ id: 'hanoi-vip', name: 'Hanoi VIP' }], {
    url: 'https://project.supabase.co', key: 'sb_secret_test', fetchImpl,
  });
  assert.match(calls[0].url, /app_settings\?on_conflict=id/);
  assert.equal(calls[0].headers.get('prefer'), 'resolution=merge-duplicates,return=minimal');
  assert.deepEqual(JSON.parse(calls[0].body), [{ id: 'main', payload: { enabled: true } }]);
  assert.match(calls[1].url, /lottery_catalog\?on_conflict=lottery_id/);
  assert.deepEqual(JSON.parse(calls[1].body), [{ lottery_id: 'hanoi-vip', payload: { id: 'hanoi-vip', name: 'Hanoi VIP' } }]);
});


test('result reads paginate beyond the PostgREST default maximum row count', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    const offset = Number(new URL(String(url)).searchParams.get('offset'));
    const rows = offset === 0
      ? Array.from({ length: 1000 }, (_, id) => ({ payload: { id } }))
      : [{ payload: { id: 1000 } }, { payload: { id: 1001 } }];
    return jsonResponse(rows);
  };
  const rows = await readSupabaseResults({
    url: 'https://project.supabase.co',
    key: 'sb_secret_test',
    fetchImpl,
  });
  assert.equal(rows.length, 1002);
  assert.equal(new URL(urls[0]).searchParams.get('offset'), '0');
  assert.equal(new URL(urls[1]).searchParams.get('offset'), '1000');
});


test('Supabase health probe fails if any required table is inaccessible', async () => {
  await assert.rejects(
    () => probeSupabase({
      url: 'https://project.supabase.co',
      key: 'sb_secret_test',
      fetchImpl: async (url) => String(url).includes('/notification_suppressions?')
        ? jsonResponse({ message: 'missing relation' }, 404)
        : jsonResponse([]),
    }),
    (error) => error instanceof SupabaseStorageError && error.status === 404,
  );
});
