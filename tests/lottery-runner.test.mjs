import test from 'node:test';
import assert from 'node:assert/strict';
import { createLotteryRunner } from '../server/lotteryRunner.ts';

test('all callers share a gate and overlapping requests never start another process', async () => {
  let finish;
  let calls = 0;
  const runner = createLotteryRunner('.', async ({ target, forceNotify }) => {
    calls++;
    assert.equal(target, 'hanoi');
    assert.equal(forceNotify, true);
    await new Promise(resolve => { finish = resolve; });
    return { stdout: 'checked', stderr: '' };
  });
  const first = runner('hanoi', true);
  const overlapping = await runner('all');
  assert.equal(overlapping.busy, true);
  assert.equal(overlapping.success, false);
  assert.equal(calls, 1);
  finish();
  assert.equal((await first).stdout, 'checked');
});

test('process failure preserves diagnostics and releases the gate for retry', async () => {
  let calls = 0;
  const runner = createLotteryRunner('.', async () => {
    if (++calls === 1) throw Object.assign(new Error('exit 1'), { stdout: 'started', stderr: 'failed feed' });
    return { stdout: 'retry complete', stderr: '' };
  });
  const failed = await runner();
  assert.equal(failed.success, false);
  assert.equal(failed.stdout, 'started');
  assert.equal(failed.stderr, 'failed feed');
  assert.equal((await runner()).success, true);
});

test('invalid target cannot execute a checker', async () => {
  const runner = createLotteryRunner('.', async () => { assert.fail('must not execute'); });
  assert.equal((await runner('unsupported')).success, false);
});

test('real subprocess failures are reported instead of fabricated success', async () => {
  const runner = createLotteryRunner('/tmp');
  const failed = await runner();
  assert.equal(failed.success, false);
  assert.match(failed.error, /lottery_checker/);
});
