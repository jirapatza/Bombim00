import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/data/drawSchedule.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const {
  bangkokNow,
  bangkokDayStart,
  parseClock,
  parseDrawDays,
  closeSlotOn,
  upcomingSlots,
  nextClosing,
  countdown,
  isClosingSoon,
  isBetweenCloseAndDraw,
  spokenCountdown,
  announceableResults,
} = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const item = (over = {}) => ({
  id: "lao_extra",
  name: "ลาว EXTRA",
  category: "vip",
  categoryLabel: "หวย VIP & ลาว",
  period: "morning",
  periodLabel: "หวยเช้า",
  flag: "🇱🇦",
  drawTimeStr: "08:30 น.",
  closeTimeStr: "08:20 น.",
  drawDays: "ทุกวัน (จันทร์ - อาทิตย์)",
  status: "waiting",
  top3: "",
  bottom2: "",
  firstPrize: "",
  date: "ไม่ระบุ",
  source: "ตารางกำหนดเวลา",
  ...over,
});

// A device anywhere in the world must agree with Bangkok wall-clock time.
const at = (iso) => Date.parse(iso);

test("Bangkok clock ignores the device time zone", () => {
  const p = bangkokNow(at("2026-11-14T00:30:00Z"));
  assert.equal(p.dateKey, "2026-11-14");
  assert.equal(p.minutes, 7 * 60 + 30);
  assert.equal(p.weekday, 6);
  assert.equal(bangkokDayStart(at("2026-11-14T00:30:00Z")), at("2026-11-13T17:00:00Z"));
});

test("clock and draw-day rules parse the published Thai text", () => {
  assert.equal(parseClock("08:20 น."), 8 * 60 + 20);
  assert.equal(parseClock("8.20"), 8 * 60 + 20);
  assert.equal(parseClock("25:00"), null);
  assert.equal(parseDrawDays("ทุกวัน (จันทร์ - อาทิตย์)"), null);
  const weekdays = parseDrawDays("จันทร์ - ศุกร์");
  assert.equal(weekdays.has(1), true);
  assert.equal(weekdays.has(5), true);
  assert.equal(weekdays.has(6), false);
  assert.equal(parseDrawDays("ตามประกาศวันงวดจริง (อาจเลื่อน)"), null);
  const listed = parseDrawDays("จันทร์, พุธ, ศุกร์");
  assert.deepEqual([...listed].sort(), [1, 3, 5]);
});

test("a scheduled close is resolved on the correct Bangkok day", () => {
  const slot = closeSlotOn(item(), bangkokDayStart(at("2026-11-14T03:00:00Z")));
  assert.equal(new Date(slot.closeAt).toISOString(), "2026-11-14T01:20:00.000Z");
  assert.equal(new Date(slot.drawAt).toISOString(), "2026-11-14T01:30:00.000Z");
});

test("draw days filter out lotteries that do not draw today", () => {
  // 2026-11-14 is a Saturday.
  const weekdayOnly = item({ id: "nikkei_morning", drawDays: "จันทร์ - ศุกร์" });
  assert.equal(closeSlotOn(weekdayOnly, bangkokDayStart(at("2026-11-14T03:00:00Z"))), null);
  const next = upcomingSlots(weekdayOnly, at("2026-11-14T03:00:00Z"), 1)[0];
  assert.equal(new Date(next.closeAt).toISOString(), "2026-11-16T01:20:00.000Z");
});

test("an item with no usable schedule is skipped instead of crashing", () => {
  assert.equal(closeSlotOn(item({ closeTimeStr: "ไม่ระบุ" }), bangkokDayStart(0)), null);
  assert.deepEqual(upcomingSlots(item({ closeTimeStr: "ไม่ระบุ" }), 0), []);
});

test("the next closing is the soonest one across the catalog", () => {
  const now = at("2026-11-14T00:00:00Z"); // 07:00 Bangkok
  const next = nextClosing(
    [item({ id: "later", closeTimeStr: "09:50 น.", drawTimeStr: "10:00 น." }), item()],
    now,
  );
  assert.equal(next.id, "lao_extra");
  assert.equal(next.minutesUntilClose, 80);
});

test("a close counts as urgent only inside its warning window", () => {
  const close = at("2026-11-14T01:20:00Z");
  assert.equal(isClosingSoon(close, close - 11 * 60_000, 10), false);
  assert.equal(isClosingSoon(close, close - 10 * 60_000, 10), true);
  assert.equal(isClosingSoon(close, close - 1_000, 10), true);
  assert.equal(isClosingSoon(close, close, 10), false);
  assert.equal(isClosingSoon(close, close + 1_000, 10), false);
});

test("countdown labels stay readable", () => {
  const now = at("2026-11-14T00:00:00Z");
  assert.equal(countdown(now + 45_000, now), "45 วินาที");
  assert.equal(countdown(now + 90_000, now), "1:30");
  assert.equal(countdown(now + 3_600_000, now), "1:00:00");
  assert.equal(countdown(now - 5_000, now), "0 วินาที");
});

test("spoken countdown uses Thai units", () => {
  const now = at("2026-11-14T00:00:00Z");
  assert.equal(spokenCountdown(now + 45_000, now), "อีกประมาณ 45 วินาที");
  assert.equal(spokenCountdown(now + 5 * 60_000, now), "อีกประมาณ 5 นาที");
  assert.equal(spokenCountdown(now + 10 * 60_000, now), "อีกประมาณ 10 นาที");
  assert.equal(spokenCountdown(now + 90 * 60_000, now), "อีกประมาณ 1 ชั่วโมง 30 นาที");
});

test("the gap between closing and drawing is recognised", () => {
  const now = at("2026-11-14T01:25:00Z");
  assert.equal(isBetweenCloseAndDraw(item(), now), true);
  assert.equal(isBetweenCloseAndDraw(item(), at("2026-11-14T01:20:00Z")), true);
  assert.equal(isBetweenCloseAndDraw(item(), at("2026-11-14T01:35:00Z")), false);
  assert.equal(isBetweenCloseAndDraw(item(), at("2026-11-14T01:00:00Z")), false);
});

test("a result is announced only on its own Bangkok draw date", () => {
  const drawn = item({
    status: "drawn",
    top3: "123",
    bottom2: "45",
    date: "2026-11-14",
    resultDate: "2026-11-14",
  });
  const today = at("2026-11-14T05:00:00Z");
  assert.deepEqual(
    announceableResults([drawn], today).map((r) => r.id),
    ["lao_extra"],
  );
  // Same clock time, next day: no announcement.
  assert.deepEqual(announceableResults([drawn], at("2026-11-15T05:00:00Z")), []);
  // Drawn on schedule but the numbers are still missing: nothing to read out.
  assert.deepEqual(
    announceableResults([drawn], at("2026-11-14T05:00:00Z")).length,
    1,
  );
  assert.deepEqual(
    announceableResults([item({ status: "drawn", top3: "", bottom2: "", resultDate: "2026-11-14" })], today),
    [],
  );
});
