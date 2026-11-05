const REPOSITORY = 'jirapatza/Bombim00';
const RUNTIME_BRANCH = 'runtime-live';
const DATA_FILES = {
  catalog: 'data/all_lotteries.json',
  results: 'lottery_previous_results.json',
  status: 'status/status.json',
};

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function configuredOriginList(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim() === '*') return [];
  return value.split(',').map((item) => item.trim()).filter((item) => item && item !== '*');
}

function isOriginAllowed(origin, configuredOrigins) {
  if (!origin) return false;
  return configuredOriginList(configuredOrigins).includes(origin);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function readRuntimeJson(path, token) {
  const url = new URL(`https://api.github.com/repos/${REPOSITORY}/contents/${path}`);
  url.searchParams.set('ref', RUNTIME_BRANCH);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Bombim00-Live-Data-Worker',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} for an allowlisted runtime file`);
  }

  const file = await response.json();
  if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string') {
    throw new Error('GitHub returned an unsupported runtime file representation');
  }

  return JSON.parse(decodeBase64Utf8(file.content));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const configuredOrigins = env.ALLOWED_ORIGIN || '';

    if (!isOriginAllowed(origin, configuredOrigins)) {
      return jsonResponse({ error: 'Origin not allowed or origin allowlist is not configured' }, 403);
    }

    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'GET, OPTIONS', ...cors });
    }

    if (url.pathname === '/health') {
      return jsonResponse({ ok: true, service: 'Bombim00 live data API' }, 200, cors);
    }

    if (url.pathname !== '/api/live-data') {
      return jsonResponse({ error: 'Not found' }, 404, cors);
    }

    if (!env.GITHUB_TOKEN) {
      return jsonResponse({ error: 'Live data API is not configured' }, 503, cors);
    }

    try {
      const [catalog, results, status] = await Promise.all(
        Object.values(DATA_FILES).map((path) => readRuntimeJson(path, env.GITHUB_TOKEN))
      );

      if (
        !Array.isArray(catalog) ||
        !Array.isArray(results) ||
        !status ||
        typeof status !== 'object' ||
        Array.isArray(status)
      ) {
        throw new Error('Runtime data failed validation');
      }

      const safeStatus = {
        system_status: status.system_status || 'unknown',
        last_run_timestamp: status.last_run_timestamp || '',
        last_run_date_thai: status.last_run_date_thai || '',
        total_checks: Number(status.total_checks) || 0,
        last_source_used: status.last_source_used || '',
        status_message: status.status_message || '',
        active_sources_count: Number(status.active_sources_count) || 0,
        latest_draw_detected: status.latest_draw_detected || '',
        notifications_sent_today: Number(status.notifications_sent_today) || 0,
        notification_failures: Number(status.notification_failures) || 0,
        recent_logs: Array.isArray(status.recent_logs) ? status.recent_logs.slice(0, 20) : [],
      };

      return jsonResponse(
        { catalog, results, status: safeStatus, updatedAt: new Date().toISOString() },
        200,
        { ...cors, 'Cache-Control': 'public, max-age=20, stale-while-revalidate=60' }
      );
    } catch {
      // Do not return GitHub response bodies, request headers, or secret values to the browser.
      return jsonResponse({ error: 'Unable to load live lottery data' }, 502, cors);
    }
  },
};
