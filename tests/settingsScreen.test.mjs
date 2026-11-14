import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync } from "node:fs";

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
