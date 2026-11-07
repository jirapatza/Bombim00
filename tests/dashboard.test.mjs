import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({
  entryPoints: ["src/data/dashboard.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { dashboardData, drawState, drawTimestamp, countdown } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const now = new Date("2026-11-07T08:00:00Z"); // 15:00 Bangkok
const item = (id, time, extra = {}) => ({
  id,
  drawTimeStr: time,
  status: "waiting",
  ...extra,
});
test("next draw uses announcement time with Thai suffix, not close time or catalog order", () => {
  const data = dashboardData(
    [
      item("later", "18:30 น."),
      item("past", "14:00 น."),
      item("next", "15:10 น.", { closeTimeStr: "14:30" }),
    ],
    now,
  );
  assert.equal(data.next.id, "next");
  assert.equal(data.pending, 1);
  assert.equal(data.upcoming, 2);
  assert.equal(countdown(drawTimestamp(data.next, now), +now), "00 : 10 : 00");
});
test("latest three use detection timestamp, scheduled time breaks tied polls, do not mutate source", () => {
  const items = [
    item("old", "10:00", {
      status: "drawn",
      resultDate: "2026-11-07",
      detectedAt: "2026-11-07T14:00:00+07:00",
    }),
    item("late", "11:00", {
      status: "drawn",
      resultDate: "2026-11-07",
      detectedAt: "2026-11-07T14:59:00+07:00",
    }),
    item("tie", "12:00", {
      status: "drawn",
      resultDate: "2026-11-07",
      detectedAt: "2026-11-07T14:00:00+07:00",
    }),
    item("unknown", "13:00", { status: "drawn", resultDate: "2026-11-07" }),
    item("yesterday", "20:00", { status: "drawn", resultDate: "2026-11-06" }),
  ];
  assert.deepEqual(
    dashboardData(items, now).latest.map((x) => x.id),
    ["late", "tie", "old"],
  );
  assert.equal(items[0].id, "old");
});
test("results cannot appear before their scheduled time or on another Bangkok day", () => {
  const early = item("early", "20:00", {
    status: "drawn",
    resultDate: "2026-11-07",
  });
  assert.equal(drawState(early, now), "upcoming");
  assert.equal(dashboardData([early], now).drawn, 0);
  assert.deepEqual(dashboardData([early], now).latest, []);
  assert.equal(drawState(early, new Date("2026-11-07T13:00:00Z")), "drawn"); // 20:00 Bangkok
  assert.equal(drawState(early, new Date("2026-11-07T17:00:00Z")), "upcoming"); // next Bangkok day; no stale result
  assert.equal(drawState(item("invalid", "ตามประกาศ", {
    status: "drawn", resultDate: "2026-11-07",
  }), now), "pending");
  assert.equal(drawState(item("invalid", "25:00", {
    status: "drawn", resultDate: "2026-11-07",
  }), now), "pending");
  assert.equal(dashboardData([item("past", "01:30 น.")], now).next, null);
  assert.equal(countdown(1, 2), "00 : 00 : 00");
});
