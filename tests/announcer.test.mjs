import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// Pure planner: no DOM, no timers, no browser APIs.
const bundle = await build({
  entryPoints: ["src/utils/announcer.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const {
  planAnnouncements,
  announcementText,
  unseenAnnouncements,
  closingHeadline,
  closingQueue,
} = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// Monday 16 Nov 2026, 08:20 Bangkok = 01:20 UTC. Weekday rules matter, so every
// fixture below is pinned to a real Bangkok day.
const at = (iso) => Date.parse(iso);

const catalog = [
  {
    id: "lao_extra",
    name: "ลาว EXTRA",
    drawTimeStr: "08:30 น.",
    closeTimeStr: "08:20 น.",
    drawDays: "ทุกวัน (จันทร์ - อาทิตย์)",
    top3: "",
    bottom2: "",
    firstPrize: "",
    status: "waiting",
    date: "ไม่ระบุ",
  },
  {
    id: "hanoi_asean",
    name: "ฮานอยอาเซียน",
    drawTimeStr: "09:30 น.",
    closeTimeStr: "09:05 น.",
    drawDays: "ทุกวัน (จันทร์ - อาทิตย์)",
    top3: "",
    bottom2: "",
    firstPrize: "",
    status: "waiting",
    date: "ไม่ระบุ",
  },
];

test("nothing is planned outside a warning window", () => {
  const plan = planAnnouncements(catalog, at("2026-11-16T00:00:00.000Z"));
  assert.deepEqual(plan, []);
});

test("a ten-minute warning keeps one key for the whole window, so it is spoken once", () => {
  const closeAt = at("2026-11-16T01:20:00.000Z");
  const first = planAnnouncements(catalog, closeAt - 10 * 60_000);
  const later = planAnnouncements(catalog, closeAt - 7 * 60_000);

  const ten = first.filter((a) => a.kind === "closing-soon" && a.minutes === 10);
  assert.equal(ten.length, 1);
  assert.equal(ten[0].lotteryId, "lao_extra");

  // Seven minutes out is still inside the ten-minute window, and the planner
  // keeps the larger window, so the key is unchanged and dedupe stays silent.
  const laterTen = later.filter((a) => a.kind === "closing-soon");
  assert.equal(laterTen.length, 1);
  assert.equal(laterTen[0].key, ten[0].key);
});

test("the five-minute warning has its own key, so both are heard", () => {
  const closeAt = at("2026-11-16T01:20:00.000Z");
  const ten = planAnnouncements(catalog, closeAt - 10 * 60_000);
  const five = planAnnouncements(catalog, closeAt - 5 * 60_000);
  const key = (a) => a.key;

  assert.notEqual(
    key(ten.find((a) => a.minutes === 10)),
    key(five.find((a) => a.minutes === 5)),
  );
});

test("a closed draw is announced between close and draw time", () => {
  const plan = planAnnouncements(catalog, at("2026-11-16T01:25:00.000Z"));
  const closed = plan.find((a) => a.kind === "closed");
  assert.ok(closed, "expected a closed announcement");
  assert.equal(closed.lotteryId, "lao_extra");
});

test("a closed draw is not announced again after its result is published", () => {
  const withResult = catalog.map((item) =>
    item.id === "lao_extra"
      ? { ...item, status: "drawn", top3: "123", bottom2: "45", firstPrize: "123456", resultDate: "2026-11-16" }
      : item,
  );
  // 08:35 Bangkok: close (08:20) and draw (08:30) have both passed, so the numbers
  // are out and only the result may be spoken.
  const plan = planAnnouncements(withResult, at("2026-11-16T01:35:00.000Z"));
  assert.equal(plan.find((a) => a.kind === "closed"), undefined);
  assert.ok(plan.find((a) => a.kind === "result"));
});

test("a published result is announced on its own draw date only", () => {
  const withResult = catalog.map((item) =>
    item.id === "lao_extra"
      ? { ...item, status: "drawn", top3: "123", bottom2: "45", firstPrize: "123456", resultDate: "2026-11-16" }
      : item,
  );
  const sameDay = planAnnouncements(withResult, at("2026-11-16T03:00:00.000Z"));
  assert.ok(sameDay.some((a) => a.kind === "result" && a.lotteryId === "lao_extra"));

  const nextDay = planAnnouncements(withResult, at("2026-11-17T03:00:00.000Z"));
  assert.equal(nextDay.some((a) => a.kind === "result"), false);
});

test("the next draw is announced after a close, and not as a bare repeat", () => {
  const plan = planAnnouncements(catalog, at("2026-11-16T01:25:00.000Z"));
  const next = plan.find((a) => a.kind === "next-draw");
  assert.ok(next, "expected a next-draw announcement");
  assert.notEqual(next.lotteryId, "lao_extra");

  const idle = planAnnouncements(catalog, at("2026-11-16T00:00:00.000Z"));
  assert.equal(idle.some((a) => a.kind === "next-draw"), false);
});

test("announcements run in speaking order", () => {
  const plan = planAnnouncements(catalog, at("2026-11-16T01:25:00.000Z"));
  const rank = { "closing-soon": 0, closed: 1, result: 2, "next-draw": 3 };
  const ranks = plan.map((a) => rank[a.kind]);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

test("dedupe keeps only keys that were never seen", () => {
  const plan = planAnnouncements(catalog, at("2026-11-16T01:25:00.000Z"));
  const first = unseenAnnouncements(plan, []);
  const second = unseenAnnouncements(
    plan,
    first.map((a) => a.key),
  );
  assert.ok(first.length > 0);
  assert.equal(second.length, 0);
});

test("spoken text names the lottery, the countdown and the close time", () => {
  const plan = planAnnouncements(catalog, at("2026-11-16T01:15:00.000Z"));
  const soon = plan.find((a) => a.kind === "closing-soon");
  const text = announcementText(soon, catalog, at("2026-11-16T01:15:00.000Z"));
  assert.match(text, /ลาว EXTRA/);
  assert.match(text, /๕|5/);
  assert.match(text, /๐๘:๒๐|08:20/);
});

test("a closed announcement points at the draw that follows", () => {
  const plan = planAnnouncements(catalog, at("2026-11-16T01:25:00.000Z"));
  const closed = plan.find((a) => a.kind === "closed");
  const text = announcementText(closed, catalog, at("2026-11-16T01:25:00.000Z"));
  assert.match(text, /ปิดรับแล้ว/);
  assert.match(text, /ลาว EXTRA/);
});

test("the result announcement reads the winning numbers", () => {
  const withResult = catalog.map((item) =>
    item.id === "lao_extra"
      ? { ...item, status: "drawn", top3: "123", bottom2: "45", firstPrize: "123456", resultDate: "2026-11-16" }
      : item,
  );
  const plan = planAnnouncements(withResult, at("2026-11-16T03:00:00.000Z"));
  const result = plan.find((a) => a.kind === "result");
  const text = announcementText(result, withResult, at("2026-11-16T03:00:00.000Z"));
  assert.match(text, /ประกาศผล/);
  assert.match(text, /123456|๑๒๓๔๕๖/);
});

test("the queue lists every close still ahead, soonest first", () => {
  const now = at("2026-11-16T00:00:00.000Z");
  const headline = closingHeadline(catalog, now);
  assert.ok(headline);
  assert.equal(headline.slot.id, "lao_extra");

  const queue = closingQueue(catalog, now, 4);
  assert.deepEqual(
    queue.map((s) => `${s.id}@${new Date(s.closeAt).toISOString()}`),
    [
      "lao_extra@2026-11-16T01:20:00.000Z",
      "hanoi_asean@2026-11-16T02:05:00.000Z",
      "lao_extra@2026-11-17T01:20:00.000Z",
      "hanoi_asean@2026-11-17T02:05:00.000Z",
    ],
  );
});
