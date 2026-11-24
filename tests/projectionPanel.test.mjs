import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

mkdirSync(".harness", { recursive: true });
writeFileSync(
  ".harness/projection-dom-stub.mjs",
  `globalThis.window = { localStorage: { getItem: () => null, setItem() {} } };
   globalThis.localStorage = window.localStorage;
   globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  `,
);

await build({
  entryPoints: ["src/components/ProjectionPanel.tsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".harness/projection-panel.bundle.mjs",
  external: ["react", "react/jsx-runtime", "react-dom", "react-dom/server"],
  banner: { js: "import './projection-dom-stub.mjs';" },
  loader: { ".css": "empty" },
});

const { ProjectionPanel, upcomingDraws, closeMinutes } = await import(
  "../.harness/projection-panel.bundle.mjs"
);

const items = [
  {
    id: "hanoi_hd",
    name: "ฮานอย HD",
    flag: "🇻🇳",
    closeTimeStr: "18:00 น.",
    drawDays: "ทุกวัน (จันทร์ - อาทิตย์)",
  },
  {
    id: "lao_samakki",
    name: "ลาวสามัคคี",
    flag: "🇱🇦",
    closeTimeStr: "20:00 น.",
    drawDays: "ทุกวัน (จันทร์ - อาทิตย์)",
  },
];

const results = [
  // three usable draws for ฮานอย HD, so its own history is enough
  { หวย: "hanoi_hd", ชื่อหวย: "ฮานอย HD", วันที่จัดรูปแบบ: "20/11/2569", เลขล่าง_2_ตัว: "45" },
  { หวย: "hanoi_hd", ชื่อหวย: "ฮานอย HD", วันที่จัดรูปแบบ: "19/11/2569", เลขล่าง_2_ตัว: "45" },
  { หวย: "hanoi_hd", ชื่อหวย: "ฮานอย HD", วันที่จัดรูปแบบ: "18/11/2569", เลขล่าง_2_ตัว: "67" },
  // a single draw for ลาวสามัคคี: too thin, so the panel falls back to the pool
  { หวย: "lao_samakki", ชื่อหวย: "ลาวสามัคคี", วันที่จัดรูปแบบ: "20/11/2569", เลขล่าง_2_ตัว: "89" },
];

const html = renderToStaticMarkup(
  React.createElement(ProjectionPanel, {
    items,
    results,
    now: new Date("2026-11-24T09:00:00+07:00"),
  }),
);

test("the panel projects each upcoming draw from its own history", () => {
  assert.match(html, /คาดการณ์งวดถัดไป/);
  assert.match(html, /ฮานอย HD/);
  assert.match(html, /45 · 67/, "hottest first, then the runner-up");
  assert.match(html, /3 งวดของรายการนี้/);
});

test("a lottery with too little history borrows the pooled ranking and says so", () => {
  assert.match(html, /ลาวสามัคคี/);
  assert.match(html, /รวม 4 งวดทุกประเภท \(รายการนี้ยังมีประวัติไม่พอ\)/);
});

test("the panel states the chance and refuses to look like a result", () => {
  assert.match(html, /โอกาสตามทฤษฎี 2\.00% \(2 เลขจาก 100\)/);
  assert.match(html, /สุ่ม 15 เลขล้วนได้ 15\.00% ต่องวด/);
  assert.match(html, /ไม่ใช่ผลรางวัลและไม่รับประกันผล/);
});

test("close times are read as minutes so the order follows the schedule", () => {
  assert.equal(closeMinutes("18:00 น."), 18 * 60);
  assert.equal(closeMinutes("00:05 น."), 5);
  assert.equal(closeMinutes(""), Number.MAX_SAFE_INTEGER, "unreadable sorts last");
});

test("a draw whose close passed is not offered again as the next one", () => {
  const now = new Date("2026-11-24T18:30:00+07:00");
  // 18:00 closed half an hour ago and 18:00 tomorrow is past the horizon, so
  // only 20:00 is still ahead.
  assert.deepEqual(upcomingDraws(items, now, 5).map((item) => item.id), ["lao_samakki"]);
});

test("a draw closing after midnight counts as minutes away, not a day away", () => {
  const afterMidnight = [
    { id: "dowjones", name: "ดาวโจนส์", flag: "🇺🇸", closeTimeStr: "01:00 น." },
    { id: "hanoi_hd", name: "ฮานอย HD", flag: "🇻🇳", closeTimeStr: "18:00 น." },
  ];
  const now = new Date("2026-11-24T23:58:00+07:00");
  // 01:00 is two minutes away; 18:00 is eighteen hours away and off the panel.
  assert.deepEqual(upcomingDraws(afterMidnight, now, 5).map((item) => item.id), ["dowjones"]);
});
