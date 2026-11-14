import { runWatchdog } from './watchdog-cycle.mjs';
import { createStore } from './watchdog-store.mjs';
import { sendWatchdogAlert } from './gmail.mjs';

async function readBounded(response) {
  if (!response.body) throw new Error('missing_health_body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) throw new Error('oversized_health_response');
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
}

export async function checkOnce(env, request = fetch) {
  const target = new URL(env.HEALTH_URL);
  if (target.protocol !== 'https:' || target.username || target.password) throw new Error('invalid_health_url');
  const store = createStore(env.WATCHDOG_DB);
  return runWatchdog({
    ...store,
    readHealth: async () => {
      const response = await request(target.href, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
      if (![200, 503].includes(response.status)) return { status: response.status, body: null };
      const text = await readBounded(response);
      return { status: response.status, body: JSON.parse(text) };
    },
    sendAlert: state => sendWatchdogAlert({ clientId: env.GMAIL_CLIENT_ID, clientSecret: env.GMAIL_CLIENT_SECRET,
      refreshToken: env.GMAIL_REFRESH_TOKEN, recipient: env.ALERT_RECIPIENT }, state, request),
  });
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(checkOnce(env).then(result => console.log(JSON.stringify({ event: 'watchdog_check', ...result }))));
  },
};
