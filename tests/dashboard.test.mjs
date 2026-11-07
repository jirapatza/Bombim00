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
const { dashboardData, drawState, drawTimestamp, countdown, publishedSummaryResults, sortDailyRows } = await import(
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
test("latest three use scheduled draw time, not repeated provider detection timestamps", () => {
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
    ["unknown", "tie", "late"],
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

test("summary and sharing exclude results before draw time and from another Bangkok day", () => {
  const rows = [
    item("early", "20:00 น.", { status: "drawn", resultDate: "2026-11-07", top3: "111" }),
    item("ready", "14:00 น.", { status: "drawn", resultDate: "2026-11-07", top3: "222" }),
    item("old", "13:00 น.", { status: "drawn", resultDate: "2026-11-06", top3: "333" }),
    item("waiting", "14:30 น.", { status: "waiting", resultDate: "2026-11-07" }),
  ];
  assert.deepEqual(publishedSummaryResults(rows, now).map((x) => x.id), ["ready"]);
  assert.deepEqual(publishedSummaryResults(rows, new Date("2026-11-07T13:00:00Z")).map((x) => x.id), ["early", "ready"]);
  assert.deepEqual(publishedSummaryResults(rows, new Date("2026-11-07T17:00:00Z")), []);
});

test("overdue filter shows the most recent missed draw first while all rows stay chronological", () => {
  const atNight = new Date("2026-11-07T16:11:00Z"); // 23:11 Bangkok
  const items = [
    item("midnight", "00:30 น.", { name: "ดาวโจนส์ VIP" }),
    item("one", "01:30 น.", { name: "ดาวโจนส์ STAR" }),
    item("four", "04:00 น.", { name: "ดาวโจนส์" }),
    item("evening", "20:30 น.", { name: "ลาวสามัคคี" }),
    item("late", "22:30 น.", { name: "ฮานอย EXTRA" }),
    item("future", "23:30 น.", { name: "ลาวกาชาด" }),
  ];
  assert.deepEqual(sortDailyRows(items.filter(x => drawState(x, atNight) === "pending"), "pending", atNight).map(x => x.id),
    ["late", "evening", "four", "one", "midnight"]);
  assert.deepEqual(sortDailyRows(items, "all", atNight).map(x => x.id),
    ["midnight", "one", "four", "evening", "late", "future"]);
  assert.equal(drawState(items[0], atNight), "pending");
  assert.equal(drawState(items[5], atNight), "upcoming");
});
test("results with identical poll timestamps still follow their scheduled draw order", () => {
  const items = [
    item("older", "17:30 น.", { name: "ฮานอยพิเศษ", status: "drawn", resultDate: "2026-11-07", detectedAt: "2026-11-07T16:10:00Z" }),
    item("newer", "20:30 น.", { name: "ลาวสามัคคี", status: "drawn", resultDate: "2026-11-07", detectedAt: "2026-11-07T16:10:00Z" }),
  ];
  assert.deepEqual(dashboardData(items, new Date("2026-11-07T16:11:00Z")).latest.map(x => x.id),
    ["newer", "older"]);
});
