import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({
  entryPoints: ["src/utils/statistics.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { resolveNumbers, toDraws, digitFrequency, hottest, coldest, longestGap, backtest } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
// newest-first, like the stored checker results
const fixture = [
  { ชื่อหวย: "ฮานอย", วันที่จัดรูปแบบ: "17/11/2569", เลขบน_3_ตัว: "123", เลขล่าง_2_ตัว: "45" },
  { ชื่อหวย: "ฮานอย", วันที่จัดรูปแบบ: "16/11/2569", เลขบน_3_ตัว: "123", เลขล่าง_2_ตัว: "45" },
  { ชื่อหวย: "ลาว", วันที่จัดรูปแบบ: "15/11/2569", เลขบน_3_ตัว: "456", เลขล่าง_2_ตัว: "67" },
];
test("counts a number once per draw and totals equal usable draws", () => {
  const stats = digitFrequency(fixture, "top3");
  const map = new Map(stats.map((s) => [s.number, s]));
  assert.equal(map.get("123").count, 2);
  assert.equal(map.get("456").count, 1);
  assert.equal(stats.reduce((a, s) => a + s.count, 0), 3);
});
test("repeated digits inside one draw are counted once", () => {
  const rows = [
    { ชื่อหวย: "x", วันที่จัดรูปแบบ: "02/11/2569", เลขหน้า_3_ตัว: ["777", "777"], เลขท้าย_3_ตัว: ["777"] },
    { ชื่อหวย: "x", วันที่จัดรูปแบบ: "01/11/2569", เลขท้าย_3_ตัว: ["777"] },
  ];
  const stats = digitFrequency(rows, "back3");
  assert.equal(stats.length, 1);
  assert.equal(stats[0].count, 2);
  assert.equal(stats[0].percentage, 100);
});
test("percentage uses draws that actually had that kind of number", () => {
  const stats = digitFrequency(fixture, "bottom2");
  const s45 = stats.find((s) => s.number === "45");
  assert.equal(s45.count, 2);
  assert.ok(Math.abs(s45.percentage - 66.67) < 0.01);
});
test("gap rounds count draws since the latest hit, newest-first", () => {
  const stats = digitFrequency(fixture, "top3");
  const map = new Map(stats.map((s) => [s.number, s]));
  assert.equal(map.get("123").gapRounds, 0); // appeared in the newest draw
  assert.equal(map.get("456").gapRounds, 2); // skipped two newer draws
  assert.equal(map.get("123").latestDate, "17/11/2569");
});
test("front3 and back3 read their arrays and drop wrong lengths", () => {
  const rows = [
    {
      ชื่อหวย: "test",
      วันที่จัดรูปแบบ: "01/01/2569",
      เลขหน้า_3_ตัว: ["111", "22", "333"],
      เลขท้าย_3_ตัว: ["444"],
    },
  ];
  const front = digitFrequency(rows, "front3").map((s) => s.number).sort();
  assert.deepEqual(front, ["111", "333"]);
  assert.deepEqual(digitFrequency(rows, "back3").map((s) => s.number), ["444"]);
});
test("top3 never invents a three-digit result from a longer first prize", () => {
  const sixDigitFirstPrize = { ชื่อหวย: "สลากกินแบ่งรัฐบาล", รางวัลที่_1: "011781", เลขล่าง_2_ตัว: "48" };
  assert.deepEqual(resolveNumbers(sixDigitFirstPrize, "top3"), []);
  assert.deepEqual(resolveNumbers(sixDigitFirstPrize, "bottom2"), ["48"]);
  assert.deepEqual(resolveNumbers({ รางวัลที่_1: "781", เลขล่าง_2_ตัว: "48" }, "top3"), ["781"]);
});
test("rows without a usable number are skipped instead of padded", () => {
  const rows = [
    { ชื่อหวย: "x", วันที่จัดรูปแบบ: "02/11/2569" },
    { ชื่อหวย: "x", วันที่จัดรูปแบบ: "01/11/2569", เลขบน_3_ตัว: "999" },
  ];
  const draws = toDraws(rows, "top3");
  assert.equal(draws.length, 1);
  assert.equal(draws[0].date, "01/11/2569");
  assert.equal(draws[0].lottery, "x");
});
test("empty or partial input returns no fabricated stats", () => {
  assert.deepEqual(digitFrequency([], "top3"), []);
  assert.deepEqual(digitFrequency([{ ชื่อหวย: "x" }], "top3"), []);
  const anonymous = digitFrequency([{ เลขบน_3_ตัว: "111" }], "top3")[0];
  assert.equal(anonymous.number, "111");
  assert.equal(anonymous.latestLottery, "");
  assert.equal(anonymous.latestDate, "");
  const empty = backtest([], "top3");
  assert.equal(empty.rounds, 0);
  assert.equal(empty.hits, 0);
  assert.equal(empty.hitRate, 0);
});
test("rankings do not mutate the input and stay consistent", () => {
  const stats = digitFrequency(fixture, "top3");
  const snapshot = stats.map((s) => s.number).sort();
  assert.equal(hottest(stats, 1)[0].number, "123");
  assert.deepEqual(stats.map((s) => s.number).sort(), snapshot);
  assert.ok(hottest(stats, 99).length <= stats.length);
});
test("sorts mixed Thai and ISO draw dates before computing latest gap and backtest", () => {
  const rows = [
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "01 พฤศจิกายน 2569", เลขบน_3_ตัว: "111" },
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "2026-11-03", เลขบน_3_ตัว: "222" },
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "02/11/2569", เลขบน_3_ตัว: "111" },
  ];
  assert.deepEqual(toDraws(rows, "top3").map((draw) => draw.numbers[0]), ["222", "111", "111"]);
  const stats = digitFrequency(rows, "top3");
  assert.equal(stats.find((stat) => stat.number === "111").gapRounds, 1);
  assert.equal(stats.find((stat) => stat.number === "111").latestDate, "02/11/2569");
  const report = backtest(rows, "top3", { pick: 1, window: 1 });
  assert.equal(report.rounds, 2);
  assert.equal(report.hits, 1);
});
test("rejects non-digit prizes and falls back to valid two-digit result", () => {
  const row = { เลขบน_3_ตัว: "12x", รางวัลที่_1: "123456", เลขล่าง_2_ตัว: "x2", เลขท้าย_2_ตัว: "09", เลขหน้า_3_ตัว: ["123", "abc"] };
  assert.deepEqual(resolveNumbers(row, "top3"), []);
  assert.deepEqual(resolveNumbers(row, "bottom2"), ["09"]);
  assert.deepEqual(resolveNumbers(row, "front3"), ["123"]);
  assert.deepEqual(resolveNumbers({ เลขล่าง_2_ตัว: "xx", เลขท้าย_2_ตัว: "yy" }, "bottom2"), []);
});
test("backtest does not score rows without an orderable draw date", () => {
  const rows = [
    { ชื่อหวย: "A", เลขบน_3_ตัว: "111" },
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "2026-11-03", เลขบน_3_ตัว: "111" },
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "2026-11-02", เลขบน_3_ตัว: "111" },
  ];
  assert.equal(backtest(rows, "top3", { pick: 1 }).rounds, 1);
});
test("splits comma- and space-separated three-digit prizes without padding or inventing numbers", () => {
  const row = {
    เลขหน้า_3_ตัว: ["123, 045", " 678\t901 ", "12", "x34"],
    เลขท้าย_3_ตัว: ["234; 567", "890 012"],
  };
  assert.deepEqual(resolveNumbers(row, "front3"), ["123", "045", "678", "901"]);
  assert.deepEqual(resolveNumbers(row, "back3"), ["234", "567", "890", "012"]);
});
test("a number first seen in the oldest draw has a gap spanning the recorded history", () => {
  const rows = [
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "2026-11-03", เลขบน_3_ตัว: "111" },
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "2026-11-02", เลขบน_3_ตัว: "222" },
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "2026-11-01", เลขบน_3_ตัว: "333" },
  ];
  const stats = digitFrequency(rows, "top3");
  assert.equal(stats.find((stat) => stat.number === "333").gapRounds, 2);
  assert.equal(longestGap(stats, 1)[0].number, "333");
});
test("cold and gap rankings include unseen values from the complete prize range", () => {
  const rows = [
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "2026-11-03", เลขบน_3_ตัว: "111" },
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "2026-11-02", เลขบน_3_ตัว: "222" },
  ];
  const stats = digitFrequency(rows, "top3");
  const cold = coldest(stats, 3, "top3");
  const gap = longestGap(stats, 1, "top3")[0];
  assert.deepEqual(cold.map((stat) => stat.number), ["000", "001", "002"]);
  assert.deepEqual(cold.map((stat) => stat.count), [0, 0, 0]);
  assert.equal(gap.number, "000");
  assert.equal(gap.count, 0);
  assert.equal(gap.gapRounds, 1);
  assert.equal(hottest(stats, 1)[0].number, "222");
  assert.equal(coldest(rows, 1, "bottom2")[0].number, "00");
  assert.equal(longestGap(rows, 1, "front3")[0].number, "000");
});
test("never-drawn values use the real draw count as their gap", () => {
  const twoDraws = [
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "2026-11-03", เลขบน_3_ตัว: "111" },
    { ชื่อหวย: "A", วันที่จัดรูปแบบ: "2026-11-02", เลขบน_3_ตัว: "222" },
  ];
  const repeated = Array.from({ length: 5 }, (_, index) => ({
    ชื่อหวย: "A",
    วันที่จัดรูปแบบ: `2026-11-0${index + 1}`,
    เลขบน_3_ตัว: "111",
  }));
  const twoStats = digitFrequency(twoDraws, "top3");
  const repeatStats = digitFrequency(repeated, "top3");
  assert.equal(longestGap(twoStats, 1, "top3", 2)[0].gapRounds, 2);
  assert.equal(longestGap(twoStats, 1, "top3", 2)[0].count, 0);
  assert.equal(longestGap(twoStats, 1)[0].gapRounds, 1);
  assert.equal(longestGap(repeatStats, 1, "top3", 5)[0].gapRounds, 5);
  assert.equal(coldest(repeatStats, 1, "top3", 5)[0].count, 0);
  assert.equal(repeatStats[0].gapRounds, 0);
});
test("backtest reports only rounds it could actually score", () => {
  const rows = [];
  for (let i = 6; i >= 1; i--) {
    rows.push({ ชื่อหวย: "x", วันที่จัดรูปแบบ: `${i}/11/2569`, เลขบน_3_ตัว: "777" });
  }
  const result = backtest(rows, "top3", { pick: 1, window: 3 });
  assert.equal(result.rounds, 5);
  assert.equal(result.hits, 5);
  assert.equal(result.hitRate, 100);
  assert.equal(result.pick, 1);
  assert.equal(result.window, 3);
  assert.equal(result.kind, "top3");
});
test("backtest hit rate falls when the predicted set cannot match", () => {
  const rows = [];
  for (let i = 1; i <= 6; i++) {
    rows.push({
      ชื่อหวย: "x",
      วันที่จัดรูปแบบ: `${i}/11/2569`,
      เลขบน_3_ตัว: i % 2 === 0 ? "111" : "222",
    });
  }
  // newest-first input, so chronological order alternates 222,111,222,...
  const result = backtest(rows, "top3", { pick: 1, window: 2 });
  assert.equal(result.rounds, 5);
  assert.ok(result.hitRate > 0 && result.hitRate < 100);
});
