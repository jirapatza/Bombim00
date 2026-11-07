import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/utils/siteDiagnostics.ts', 'utf8');
async function loadDiagnostics(key, host) {
  const { code } = await transform(source, {
    loader: 'ts',
    format: 'esm',
    target: 'es2020',
    define: {
      'import.meta.env.VITE_POSTHOG_PROJECT_TOKEN': JSON.stringify(key),
      'import.meta.env.VITE_POSTHOG_HOST': JSON.stringify(host),
    },
  });
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

test('diagnostics stay disabled when build configuration is absent', async () => {
  const oldWindow = globalThis.window;
  const oldFetch = globalThis.fetch;
  let requests = 0;
  try {
    globalThis.window = { addEventListener() {} };
    globalThis.fetch = async () => { requests++; return { ok: true }; };
    const { trackDiagnostic, installBrowserDiagnostics } = await loadDiagnostics(
      '%VITE_POSTHOG_PROJECT_TOKEN%', '%VITE_POSTHOG_HOST%',
    );
    installBrowserDiagnostics();
    trackDiagnostic('frontend_render_error');
    assert.equal(requests, 0);
  } finally {
    globalThis.window = oldWindow;
    globalThis.fetch = oldFetch;
  }
});

test('diagnostics capture only allowlisted anonymous events without cookies or URLs', async () => {
  const oldWindow = globalThis.window;
  const oldFetch = globalThis.fetch;
  const handlers = {};
  const requests = [];
  try {
    globalThis.window = { addEventListener(type, handler) { handlers[type] = handler; } };
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return { ok: true };
    };
    const { trackDiagnostic, installBrowserDiagnostics } = await loadDiagnostics(
      'phc_test123', 'https://us.i.posthog.com',
    );
    installBrowserDiagnostics();
    handlers.error(new Error('PRIVATE_ERROR_TEXT'));
    handlers.unhandledrejection({ reason: 'PRIVATE_REJECTION_TEXT' });
    trackDiagnostic('frontend_render_error');
    assert.equal(requests.length, 4);
    assert.deepEqual(requests.map(x => JSON.parse(x.options.body).event), [
      'frontend_started', 'frontend_runtime_error', 'frontend_promise_error', 'frontend_render_error',
    ]);
    for (const { url, options } of requests) {
      assert.equal(url, 'https://us.i.posthog.com/capture/');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.referrerPolicy, 'no-referrer');
      const payload = JSON.parse(options.body);
      assert.deepEqual(Object.keys(payload).sort(), ['api_key', 'distinct_id', 'event', 'properties']);
      assert.equal(payload.properties.$geoip_disable, true);
      assert.equal(payload.properties.$process_person_profile, false);
      assert.equal(payload.properties.$ip, null);
      assert.doesNotMatch(options.body, /PRIVATE_ERROR_TEXT|PRIVATE_REJECTION_TEXT|https:\/\/bombim00/);
    }
  } finally {
    globalThis.window = oldWindow;
    globalThis.fetch = oldFetch;
  }
});

test('diagnostics reject unknown ingestion hosts', async () => {
  const oldWindow = globalThis.window;
  const oldFetch = globalThis.fetch;
  let requests = 0;
  try {
    globalThis.window = { addEventListener() {} };
    globalThis.fetch = async () => { requests++; return { ok: true }; };
    const { installBrowserDiagnostics } = await loadDiagnostics(
      'phc_test123', 'https://other.example.com',
    );
    installBrowserDiagnostics();
    assert.equal(requests, 0);
  } finally {
    globalThis.window = oldWindow;
    globalThis.fetch = oldFetch;
  }
});
