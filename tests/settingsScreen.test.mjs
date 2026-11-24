import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync(".harness", { recursive: true });

// SettingsScreen pulls in browser-only helpers, so it is bundled with a minimal
// DOM stub and rendered through react-dom/server: no browser, no timers.
writeFileSync(
  ".harness/settings-dom-stub.mjs",
  `globalThis.window = { speechSynthesis: null, localStorage: { getItem: () => null, setItem() {} } };
   globalThis.localStorage = window.localStorage;
   globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  `,
);

await build({
  entryPoints: ["src/screens/SettingsScreen.tsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".harness/settings-screen.bundle.mjs",
  external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime", "lucide-react"],
  banner: { js: "import './settings-dom-stub.mjs';" },
  loader: { ".css": "empty" },
});

const { SettingsScreen } = await import("./../.harness/settings-screen.bundle.mjs");
const React = (await import("react")).default;
const { renderToStaticMarkup } = await import("react-dom/server");

const status = {
  system_status: "ok",
  last_run_timestamp: "2026-11-15T00:00:00+07:00",
  total_checks: 10,
  notification_failures: 0,
};

const closes = [
  {
    id: "lao_extra",
    name: "ลาว EXTRA",
    closeAt: Date.parse("2026-11-16T01:20:00.000Z"),
    minutesUntilClose: 5,
  },
];

test("the settings panel lists the spoken schedule with a Bangkok close time", () => {
  const html = renderToStaticMarkup(
    React.createElement(SettingsScreen, {
      status,
      watchedNumbers: [],
      isVoiceEnabled: true,
      nextCloses: closes,
      onToggleVoice() {},
      onAddWatchedNumber() {},
      onRemoveWatchedNumber() {},
    }),
  );

  assert.match(html, /ตารางประกาศเสียง/);
  assert.match(html, /ก่อนปิดรับ 10 และ 5 นาที/);
  assert.match(html, /ลาว EXTRA/);
  assert.match(html, /08:20/);
});

test("no schedule block is rendered when nothing is closing", () => {
  const html = renderToStaticMarkup(
    React.createElement(SettingsScreen, {
      status,
      watchedNumbers: [],
      isVoiceEnabled: false,
      nextCloses: [],
      onToggleVoice() {},
      onAddWatchedNumber() {},
      onRemoveWatchedNumber() {},
    }),
  );
  assert.equal(html.includes("ตารางประกาศเสียง"), false);
});

test("a parked source is named with the time left before it is retried", () => {
  const until = Date.now() + 18 * 60000;
  const html = renderToStaticMarkup(
    React.createElement(SettingsScreen, {
      status: {
        ...status,
        system_status: "healthy",
        last_run_timestamp: new Date().toISOString(),
        degraded_sources: ["ThaiLottoAPI"],
        source_backoff: { ThaiLottoAPI: { failures: 3, until } },
      },
      watchedNumbers: [],
      isVoiceEnabled: false,
      nextCloses: [],
      onToggleVoice() {},
      onAddWatchedNumber() {},
      onRemoveWatchedNumber() {},
    }),
  );

  assert.match(html, /แหล่งข้อมูลที่พักไว้ชั่วคราว \(1\)/);
  assert.match(html, /ThaiLottoAPI · ล้มติดกัน 3 ครั้ง · พักอีก 18 นาที/);
  assert.match(html, /แหล่งอื่นยังทำงานปกติ/);
});

test("nothing parked means no parked block", () => {
  const html = renderToStaticMarkup(
    React.createElement(SettingsScreen, {
      status: { ...status, source_backoff: { ThaiLottoAPI: { failures: 3, until: Date.now() - 60000 } } },
      watchedNumbers: [],
      isVoiceEnabled: false,
      nextCloses: [],
      onToggleVoice() {},
      onAddWatchedNumber() {},
      onRemoveWatchedNumber() {},
    }),
  );

  assert.equal(html.includes("แหล่งข้อมูลที่พักไว้ชั่วคราว"), false);
});

test("results behind their own schedule are named with their last draw", () => {
  const html = renderToStaticMarkup(
    React.createElement(SettingsScreen, {
      status: { ...status, system_status: "healthy", last_run_timestamp: new Date().toISOString() },
      staleItems: [
        { id: "nikkei_afternoon", name: "นิเคอิรอบบ่าย", date: "20 พฤศจิกายน 2569" },
        { id: "russia", name: "รัสเซีย", date: "4 พฤศจิกายน 2569" },
      ],
      watchedNumbers: [],
      isVoiceEnabled: false,
      nextCloses: [],
      onToggleVoice() {},
      onAddWatchedNumber() {},
      onRemoveWatchedNumber() {},
    }),
  );

  assert.match(html, /ผลที่ค้างตามกำหนด \(2\)/);
  assert.match(html, /นิเคอิรอบบ่าย · ผลล่าสุด 20 พฤศจิกายน 2569/);
  assert.match(html, /รัสเซีย · ผลล่าสุด 4 พฤศจิกายน 2569/);
  assert.match(html, /ระบบไม่เติมผลแทน/);
});

test("nothing behind schedule means no stale block", () => {
  const html = renderToStaticMarkup(
    React.createElement(SettingsScreen, {
      status,
      staleItems: [],
      watchedNumbers: [],
      isVoiceEnabled: false,
      nextCloses: [],
      onToggleVoice() {},
      onAddWatchedNumber() {},
      onRemoveWatchedNumber() {},
    }),
  );

  assert.equal(html.includes("ผลที่ค้างตามกำหนด"), false);
});
