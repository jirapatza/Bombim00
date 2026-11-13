import { initializeWebPush } from '../../../cloudflare/src/web-push.js';

// Same-origin Cloudflare Pages Function, not a new paid external service.
// Never expose the VAPID private JWK or subscriber URLs to the browser.
export async function onRequestGet({ env }) {
  if (!env.PUSH_DB) return Response.json({ available: false }, { status: 503 });
  try {
    const publicKey = await initializeWebPush(env.PUSH_DB);
    return Response.json({ available: true, publicKey }, {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return Response.json({ available: false }, { status: 503 });
  }
}
