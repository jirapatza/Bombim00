import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, ".harness"), { recursive: true });
await build({
  entryPoints: [join(root, "src/utils/freshness.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: join(root, ".harness/freshness.mjs"),
});
const { parseThaiDate, expectedGapDays, assessFreshness, bangkokDayNumber, formatThaiDate } = await import(
  `../.harness/freshness.mjs?${Date.now()}`
);

// 21 Nov 22:00 UTC is already 22 Nov 05:00 in Bangkok, the day the app shows.
const sunday = new Date("2026-11-21T22:00:00Z");

test("Thai result dates parse from both long and short month names", () => {
  assert.deepEqual(parseThaiDate("21 พฤศจิกายน 2569"), { year: 2026, month: 11, day: 21 });
  assert.deepEqual(parseThaiDate("4 พ.ย. 2569"), { year: 2026, month: 11, day: 4 });
  assert.equal(parseThaiDate(""), null);
  assert.equal(parseThaiDate("ไม่มีวันที่"), null);
});

test("each draw schedule knows its longest legitimate gap", () => {
  assert.equal(expectedGapDays("ทุกวัน (จันทร์ - อาทิตย์)"), 1);
  assert.equal(expectedGapDays("จันทร์ - ศุกร์"), 3);
  assert.equal(expectedGapDays("อังคาร - เสาร์"), 3);
  assert.equal(expectedGapDays("จันทร์, พุธ, ศุกร์"), 3);
  assert.equal(expectedGapDays("ตามประกาศวันงวดจริง (อาจเลื่อน)"), 16);
});

test("a weekend gap on a weekday lottery is not reported as stale", () => {
  const friday = assessFreshness("20 พฤศจิกายน 2569", "จันทร์ - ศุกร์", sunday);
  assert.equal(friday.days, 2);
  assert.equal(friday.stale, false, "Friday to Sunday is normal for a Mon-Fri draw");
  assert.equal(friday.label, "2 วันก่อน");
});

test("a daily lottery one day behind is not stale", () => {
  const daily = assessFreshness("21 พฤศจิกายน 2569", "ทุกวัน (จันทร์ - อาทิตย์)", sunday);
  assert.equal(daily.stale, false);
});

test("a twice-monthly draw is not stale in the middle of the month", () => {
  const monthly = assessFreshness("16 พฤศจิกายน 2569", "ตามประกาศวันงวดจริง (อาจเลื่อน)", sunday);
  assert.equal(monthly.days, 6);
  assert.equal(monthly.stale, false);
});

test("a weekday lottery three weeks behind is reported as stale", () => {
  const russia = assessFreshness("4 พฤศจิกายน 2569", "จันทร์ - ศุกร์", sunday);
  assert.equal(russia.days, 18);
  assert.equal(russia.stale, true);
  assert.equal(russia.label, "18 วันก่อน");
});

test("today is counted in Bangkok, not on the device clock", () => {
  const eveningUtc = new Date("2026-11-21T22:00:00Z");
  const morningUtc = new Date("2026-11-21T02:00:00Z");
  assert.equal(bangkokDayNumber(eveningUtc) - bangkokDayNumber(morningUtc), 1);
  assert.equal(assessFreshness("4 พฤศจิกายน 2569", "จันทร์ - ศุกร์", eveningUtc).label, "18 วันก่อน");
});

test("an ISO date from a fresh detection renders as a Thai Buddhist date", () => {
  assert.equal(formatThaiDate("2026-11-22"), "22 พฤศจิกายน 2569");
  assert.equal(formatThaiDate("21 พฤศจิกายน 2569"), "21 พฤศจิกายน 2569");
  assert.equal(formatThaiDate("4 พ.ย. 2569"), "4 พฤศจิกายน 2569");
  assert.equal(formatThaiDate("ไม่ระบุ"), "ไม่ระบุ", "unknown stays as written");
});

test("an ISO date still drives the freshness calculation", () => {
  const state = assessFreshness("2026-11-04", "จันทร์ - ศุกร์", sunday);
  assert.equal(state.days, 18);
  assert.equal(state.stale, true);
});
