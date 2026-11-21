import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../public/push-sw.js", import.meta.url), "utf8");

test("the service worker shows a result notification that can be heard", () => {
  assert.match(source, /showNotification/);
  assert.match(source, /silent:\s*false/);
  assert.match(source, /vibrate:/);
  assert.match(source, /tag:\s*'bombim00-lottery'/);
  assert.match(source, /renotify:\s*true/);
});

test("a notification click still reports the receipt and opens the app", () => {
  assert.match(source, /postReceipt\([^)]*'opened'\)/);
  assert.match(source, /openWindow\('\/'\)/);
});

test("payloads without a title and body are ignored", () => {
  assert.match(source, /typeof message\?\.title !== 'string'/);
});
