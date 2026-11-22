import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

const pngSize = (path) => {
  const buffer = readFileSync(join(root, path));
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", `${path} is a PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

test("the manifest describes an installable app", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "th");
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.ok(manifest.name.length > 0 && manifest.short_name.length > 0);
});

test("every icon the manifest lists exists at the size it claims", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  const sizes = new Set();
  for (const icon of manifest.icons) {
    const path = icon.src.replace(/^\//, "public/");
    assert.ok(existsSync(join(root, path)), `${path} exists`);
    assert.ok(statSync(join(root, path)).size > 0, `${path} is not empty`);
    const [width, height] = icon.sizes.split("x").map(Number);
    assert.deepEqual(pngSize(path), { width, height }, `${path} is ${icon.sizes}`);
    sizes.add(icon.sizes);
  }
  assert.ok(sizes.has("192x192") && sizes.has("512x512"), "has the sizes browsers require");
  assert.ok(
    manifest.icons.some((icon) => icon.purpose === "maskable"),
    "has a maskable icon for Android",
  );
});

test("index.html links the manifest and the iOS icon", () => {
  const html = read("index.html");
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon-180\.png" \/>/);
  assert.match(html, /<meta name="theme-color" content="#020617" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
  assert.deepEqual(pngSize("public/icons/apple-touch-icon-180.png"), { width: 180, height: 180 });
});

test("the service worker registers on load, not only when push is enabled", () => {
  const source = read("src/main.tsx");
  assert.match(source, /navigator\.serviceWorker\.register\("\/push-sw\.js"\)/);
  assert.match(source, /addEventListener\("load"/);
});

test("the service worker keeps a fetch listener so the app stays installable", () => {
  assert.match(read("public/push-sw.js"), /addEventListener\('fetch'/);
});

test("the cache only answers when the network fails", () => {
  const source = read("public/push-sw.js");
  assert.match(source, /function networkFirst/, "pages and runtime JSON are fetched first");
  assert.match(source, /request\.mode === 'navigate'/, "a navigation is never answered by cache-first");
  assert.match(source, /caches\.match\(OFFLINE_URL\)/, "falls back to the offline page");
  assert.match(source, /cache\.addAll\(\[OFFLINE_URL/, "precaches the offline page on install");
  assert.match(source, /url\.pathname\.startsWith\('\/api\/'\)/, "the API is never intercepted");
  assert.match(source, /isCacheableAsset\(request, url\)\) event\.respondWith\(cacheFirst\(request\)\)/,
    "cache-first is reserved for immutable hashed assets");
});

test("the offline page explains the state in Thai and offers a retry", () => {
  const html = read("public/offline.html");
  assert.match(html, /<html lang="th">/);
  assert.match(html, /ไม่มีการเชื่อมต่อ/);
  assert.match(html, /<a class="retry" href="\/">/, "retry is a link, because the CSP blocks inline handlers");
  assert.doesNotMatch(html, /<script/, "no scripts that would also be offline");
});

// install.ts is TypeScript, so it is bundled once with the same esbuild the app uses.
mkdirSync(join(root, ".harness"), { recursive: true });
await build({
  entryPoints: [join(root, "src/utils/install.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: join(root, ".harness/install.mjs"),
});
const { matchesIos, isInstalled } = await import(`../.harness/install.mjs?${Date.now()}`);

test("iPhone, iPad and Mac-with-touch are treated as iOS", () => {
  assert.equal(matchesIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
  assert.equal(matchesIos("Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X)"), true);
  assert.equal(matchesIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), true);
  assert.equal(matchesIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), false);
  assert.equal(matchesIos("Mozilla/5.0 (Linux; Android 14; Pixel 8)"), false);
});

test("a home-screen app counts as installed on either platform", () => {
  assert.equal(isInstalled(true, false), true);
  assert.equal(isInstalled(false, true), true);
  assert.equal(isInstalled(false, false), false);
});
