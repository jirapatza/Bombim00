import test from "node:test";
import assert from "node:assert/strict";

// Runs public/push-sw.js against stubs, so the offline behaviour is exercised
// rather than matched as text.
const handlers = new Map();
const cached = new Map();
const notifications = [];

globalThis.self = {
  addEventListener: (type, handler) => {
    if (!handlers.has(type)) handlers.set(type, []);
    handlers.get(type).push(handler);
  },
  skipWaiting: async () => {},
  clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => null },
  registration: { showNotification: async (title, options) => notifications.push({ title, options }) },
  location: { origin: "https://bombim00.pages.dev" },
};
globalThis.caches = {
  open: async () => ({
    add: async (url) => { cached.set(url, "offline-page"); },
    match: async (url) => cached.get(url),
  }),
  keys: async () => ["bombim00-offline-v1"],
  delete: async () => true,
  match: async (url) => cached.get(url),
};
globalThis.fetch = async () => { throw new Error("offline"); };

await import(`../public/push-sw.js?test=${Date.now()}`);

const fire = async (type, event) => {
  const pending = [];
  const wrapped = { ...event, waitUntil: (promise) => pending.push(promise) };
  for (const handler of handlers.get(type) || []) handler(wrapped);
  await Promise.all(pending);
  return wrapped;
};

test("install precaches the offline page", async () => {
  await fire("install", {});
  assert.equal(cached.get("/offline.html"), "offline-page");
});

test("a navigation that fails offline is answered with the offline page", async () => {
  let response;
  await fire("fetch", {
    request: { mode: "navigate", method: "GET" },
    respondWith: (value) => { response = value; },
  });
  assert.equal(await response, "offline-page");
});

test("data and API requests are left to the network", async () => {
  let called = false;
  await fire("fetch", {
    request: { mode: "cors", method: "GET", url: "https://bombim00.pages.dev/api/push/receipt" },
    respondWith: () => { called = true; },
  });
  assert.equal(called, false, "only navigations are intercepted");
});

test("a push message becomes an audible notification carrying its receipt", async () => {
  const message = { title: "หวยออกแล้ว", body: "579 • 86", receipt: null };
  await fire("push", {
    data: { json: () => message },
    waitUntil: (promise) => promise,
  });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].title, "หวยออกแล้ว");
  assert.equal(notifications[0].options.silent, false, "must make a sound when the tab is closed");
});
