// Exercises public/push-sw.js in a stubbed worker scope: no browser needed.
import test from "node:test";
import assert from "node:assert/strict";

const ORIGIN = "https://app.test";

function makeCache() {
  const entries = new Map();
  const keyOf = (request) => {
    const url = new URL(typeof request === "string" ? request : request.url, ORIGIN);
    url.search = "";
    return url.href;
  };
  return {
    entries,
    put: async (request, response) => { entries.set(keyOf(request), response); },
    // A real Cache returns a fresh response each time, so a body can be read twice.
    match: async (request) => entries.get(keyOf(request))?.clone(),
    add: async (url) => { entries.set(keyOf(url), new Response(`precached:${url}`)); },
    async addAll(urls) { for (const url of urls) await this.add(url); },
  };
}

function makeCaches() {
  const stores = new Map();
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, makeCache());
    return stores.get(name);
  };
  return {
    stores,
    open,
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (request) => {
      for (const cache of stores.values()) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }
      return undefined;
    },
  };
}

async function loadWorker() {
  const listeners = new Map();
  const caches = makeCaches();
  globalThis.self = {
    addEventListener: (type, handler) => listeners.set(type, handler),
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
    registration: { showNotification: async () => {} },
    location: { origin: ORIGIN },
  };
  globalThis.caches = caches;
  await import(new URL("../public/push-sw.js", import.meta.url).href);
  return { caches, listeners };
}

function event(request, network) {
  const call = { responded: false, promise: null };
  globalThis.fetch = network;
  return {
    call,
    run: () => {
      const target = { request, respondWith: (promise) => { call.responded = true; call.promise = promise; } };
      return listeners.get("fetch")(target);
    },
  };
}

// Node's Request rejects mode "navigate", so navigations use the same shape the
// worker reads: url, method, mode and destination.
const navigation = (path = "/") => ({ url: `${ORIGIN}${path}`, method: "GET", mode: "navigate", destination: "" });

let listeners;
let caches;

test.before(async () => {
  ({ listeners, caches } = await loadWorker());
  await listeners.get("install")({ waitUntil: (promise) => promise });
});

test("an online navigation is served from the network and stored", async () => {
  const html = new Response("<html>shell</html>", { headers: { "content-type": "text/html" } });
  const { call, run } = event(navigation("/"), async () => html);
  run();
  assert.equal(call.responded, true);
  assert.equal(await (await call.promise).text(), "<html>shell</html>");
  assert.equal(await (await (await caches.open("bombim00-shell-v1")).match("/")).text(), "<html>shell</html>");
});

test("a navigation with no signal falls back to the stored shell, then the offline page", async () => {
  const offline = () => Promise.reject(new TypeError("Failed to fetch"));
  const withShell = event(navigation("/history"), offline);
  withShell.run();
  assert.equal(await (await withShell.call.promise).text(), "<html>shell</html>");

  const shell = caches.stores.get("bombim00-shell-v1");
  shell.entries.delete(`${ORIGIN}/`);
  const withoutShell = event(navigation("/history"), offline);
  withoutShell.run();
  assert.equal(await (await withoutShell.call.promise).text(), "precached:/offline.html");
});

test("runtime JSON is cached without its cache-buster and served when the network fails", async () => {
  const url = `https://raw.githubusercontent.com/jirapatza/Bombim00/runtime-live/status/status.json`;
  const first = event(new Request(`${url}?v=1`), async () => new Response('{"system_status":"healthy"}'));
  first.run();
  await first.call.promise;

  const second = event(new Request(`${url}?v=2`), () => Promise.reject(new TypeError("Failed to fetch")));
  second.run();
  const body = await (await second.call.promise).json();
  assert.equal(body.system_status, "healthy");
});

test("runtime JSON with no signal and no cache stays a failure", async () => {
  const url = "https://raw.githubusercontent.com/jirapatza/Bombim00/runtime-live/lottery_previous_results.json";
  const { call, run } = event(new Request(`${url}?v=9`), () => Promise.reject(new TypeError("Failed to fetch")));
  run();
  await assert.rejects(() => call.promise);
});

test("API calls and non-GET requests are never intercepted", async () => {
  const api = event(new Request(`${ORIGIN}/api/push/register`, { method: "GET" }), async () => new Response("{}"));
  api.run();
  assert.equal(api.call.responded, false);

  const post = event(new Request(`${ORIGIN}/api/push/receipt`, { method: "POST", body: "{}" }), async () => new Response("{}"));
  post.run();
  assert.equal(post.call.responded, false);
});

test("hashed assets are served from the cache first", async () => {
  let requests = 0;
  const asset = `${ORIGIN}/assets/index-abc123.js`;
  const network = async () => { requests += 1; return new Response("bundle"); };
  const first = event(new Request(asset, { destination: "script" }), network);
  first.run();
  await first.call.promise;
  const second = event(new Request(asset, { destination: "script" }), network);
  second.run();
  assert.equal(await (await second.call.promise).text(), "bundle");
  assert.equal(requests, 1);
});
