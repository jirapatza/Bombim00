export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const origin = 'https://bombim00.pages.dev';
  if (url.origin !== origin || request.headers.get('Sec-Fetch-Site') !== 'same-origin') {
    return new Response(null, { status: 403 });
  }
  if (!env.CHECKER) return new Response(null, { status: 503 });
  const headers = new Headers(request.headers);
  headers.set('Origin', origin);
  const path = url.pathname.replace(/^\/api/, '');
  return env.CHECKER.fetch(new Request('https://checker.internal' + path, {
    method: request.method, headers, body: request.body,
  }));
}
