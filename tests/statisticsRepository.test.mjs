import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/data/lotteryRepository.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { LotteryRepository: R } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const rows = [
  { ชื่อหวย: 'A', งวดวันที่: '2026-11-05', เลขบน_3_ตัว: '111', เลขล่าง_2_ตัว: '22' },
  { ชื่อหวย: 'A', งวดวันที่: '2026-11-04', เลขบน_3_ตัว: '111', เลขล่าง_2_ตัว: '22' },
  { ชื่อหวย: 'A', งวดวันที่: '2026-11-03', เลขบน_3_ตัว: '222', เลขล่าง_2_ตัว: '33' },
];

test('getDetailedStats returns per-draw digit statistics for the requested kind', () => {
  R.results = rows;
  const stats = R.getDetailedStats('top3');
  const map = new Map(stats.map((s) => [s.number, s]));
  assert.equal(map.get('111').count, 2);
  assert.equal(map.get('111').gapRounds, 0);
  assert.equal(map.get('222').gapRounds, 2);
  assert.equal(map.get('111').latestDate, '2026-11-05');
});

test('hot, cold and gap ranking helpers are consistent with the base stats', () => {
  R.results = rows;
  assert.equal(R.getHottestNumbers('top3', 1)[0].number, '111');
  assert.equal(R.getColdestNumbers('top3', 1)[0].number, '000');
  assert.equal(R.getLongestGapNumbers('top3', 1)[0].number, '000');
});

test('cold and gap helpers report never-drawn values with the real draw count', () => {
  R.results = rows;
  const cold = R.getColdestNumbers('top3', 1);
  const gap = R.getLongestGapNumbers('top3', 1);
  assert.equal(cold[0].number, '000');
  assert.equal(cold[0].count, 0);
  assert.equal(cold[0].gapRounds, 3);
  assert.equal(gap[0].number, '000');
  assert.equal(gap[0].gapRounds, 3);
  assert.equal(R.getAnalysisDrawCount('top3'), 3);
});

test('getBacktestReport reports measured rounds and hit rate without inventing data', () => {
  R.results = rows;
  const report = R.getBacktestReport('top3', { pick: 1, window: 5 });
  assert.equal(report.rounds, 2);
  assert.equal(report.pick, 1);
  assert.equal(report.window, 5);
  assert.equal(report.kind, 'top3');
  assert.ok(report.hitRate >= 0 && report.hitRate <= 100);
});

test('analysis is scoped to one lottery, not the next draw of another lottery', () => {
  R.results = [
    { ชื่อหวย: 'A', งวดวันที่: '2026-11-03', เลขบน_3_ตัว: '111' },
    { ชื่อหวย: 'B', งวดวันที่: '2026-11-02', เลขบน_3_ตัว: '222' },
    { ชื่อหวย: 'A', งวดวันที่: '2026-11-01', เลขบน_3_ตัว: '111' },
  ];
  assert.equal(R.getDetailedStats('top3', 'A').find((s) => s.number === '111').count, 2);
  assert.equal(R.getDetailedStats('top3', 'A').some((s) => s.number === '222'), false);
  assert.equal(R.getBacktestReport('top3', { pick: 1 }, 'A').rounds, 1);
  assert.equal(R.getBacktestReport('top3', { pick: 1 }, 'A').hits, 1);
  assert.deepEqual(R.getDetailedStats('top3', 'missing'), []);
});

test('empty results yield empty rankings and a zeroed backtest', () => {
  R.results = [];
  assert.deepEqual(R.getDetailedStats('top3'), []);
  assert.deepEqual(R.getHottestNumbers('top3'), []);
  const report = R.getBacktestReport('bottom2', { pick: 5, window: 10 });
  assert.equal(report.rounds, 0);
  assert.equal(report.hits, 0);
  assert.equal(report.hitRate, 0);
});
