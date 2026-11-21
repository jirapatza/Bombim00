import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

mkdirSync(".harness", { recursive: true });
writeFileSync(
  ".harness/history-dom-stub.mjs",
  `globalThis.window = { localStorage: { getItem: () => null, setItem() {} } };
   globalThis.localStorage = window.localStorage;
   globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  `,
);

await build({
  entryPoints: ["src/screens/HistoryScreen.tsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".harness/history-screen.bundle.mjs",
  external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime", "lucide-react"],
  banner: { js: "import './history-dom-stub.mjs';" },
  loader: { ".css": "empty" },
});

const { HistoryScreen } = await import("../.harness/history-screen.bundle.mjs");

const render = (results) =>
  renderToStaticMarkup(React.createElement(HistoryScreen, { results, top2Stats: [], top3Stats: [] }));

const gov = { ชื่อหวย: "สลากกินแบ่งรัฐบาล", งวดวันที่: "2026-11-16", รางวัลที่_1: "645654",
  เลขท้าย_2_ตัว: "06", เลขท้าย_3_ตัว: ["938", "101", "106", "782"], แหล่งข้อมูล: "ThaiLottoAPI" };

test("history card shows the first prize next to the official three-digit prizes", () => {
  const html = render([gov]);
  assert.match(html, /รางวัลที่ 1/);
  assert.match(html, /645654/);
  assert.match(html, /เลขท้าย 3 ตัว/);
  assert.match(html, /938/);
  assert.match(html, /782/);
  assert.match(html, /2 ตัวล่าง/);
});

test("a lottery without official three-digit prizes shows no empty block", () => {
  const hanoi = { ชื่อหวย: "หวยฮานอย", งวดวันที่: "2026-11-16", เลขบน_3_ตัว: "456", เลขล่าง_2_ตัว: "85" };
  const html = render([hanoi]);
  assert.match(html, /3 ตัวบน/);
  assert.doesNotMatch(html, /เลขท้าย 3 ตัว/);
});

test("static catalog rows render their camelCase numbers", () => {
  const html = render([{ ชื่อหวย: "สลากกินแบ่งรัฐบาล", งวดวันที่: "2026-11-16", top3: "654",
    bottom2: "06", firstPrize: "645654", back3: ["938"] }]);
  assert.match(html, /645654/);
  assert.match(html, /06/);
  assert.match(html, /938/);
});
