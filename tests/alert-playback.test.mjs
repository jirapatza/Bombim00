import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { startSpeechPlayback } from '../src/utils/speechPlayback.ts';
import { describeWorkflowHealth, shouldDispatchForegroundCheck } from '../src/utils/workflowHealth.ts';
import { validateRanlottoResponse } from '../server/sourceValidation.ts';

test('speech resumes before speak; errors pause instead of reporting completion', () => {
  const events = []; const utterance = {};
  const stop = startSpeechPlayback({ resume: () => events.push('resume'), speak: () => events.push('speak') }, utterance,
    { onStart: () => events.push('start'), onEnd: () => events.push('end'), onError: e => events.push(e) });
  assert.deepEqual(events, ['resume', 'speak']);
  utterance.onerror({ error: 'not-allowed' });
  utterance.onend();
  assert.deepEqual(events, ['resume', 'speak', 'not-allowed']);
  stop();
});

test('silent engines time out, stopped speech cannot advance an old queue', async () => {
  const events = []; const callbacks = { onStart: () => events.push('start'), onEnd: () => events.push('end'), onError: e => events.push(e) };
  const synth = { resume() {}, speak() {} }; const first = {};
  const dispose = startSpeechPlayback(synth, first, callbacks, 10);
  await delay(25); assert.deepEqual(events, ['start-timeout']); dispose();
  const second = {}; const cancel = startSpeechPlayback(synth, second, callbacks, 10);
  const lateEnd = second.onend; cancel(); lateEnd();
  await delay(25); assert.deepEqual(events, ['start-timeout']);
});

test('long speech is allowed once it actually starts', async () => {
  const events = []; const utterance = {};
  const stop = startSpeechPlayback({ resume() {}, speak() {} }, utterance,
    { onStart: () => events.push('start'), onEnd: () => events.push('end'), onError: e => events.push(e) }, 10);
  utterance.onstart(); await delay(25); utterance.onend();
  assert.deepEqual(events, ['start', 'end']); stop();
});

test('workflow health reflects stale successes, active jobs and failed latest runs', () => {
  const now = Date.now(); const run = { id: 1, status: 'completed', conclusion: 'success', created_at: new Date(now - 60000).toISOString() };
  assert.equal(describeWorkflowHealth([run], now).status, 'healthy');
  assert.equal(describeWorkflowHealth([run], now + 60 * 60000).status, 'degraded');
  assert.equal(describeWorkflowHealth([{ ...run, conclusion: 'failure' }], now).status, 'error');
  assert.equal(describeWorkflowHealth([], now).status, 'degraded');
  assert.equal(shouldDispatchForegroundCheck([run], now), false);
  assert.equal(shouldDispatchForegroundCheck([run], now + 5 * 60000), true);
  assert.equal(shouldDispatchForegroundCheck([{ ...run, status: 'in_progress' }], now + 60 * 60000), false);
  assert.equal(shouldDispatchForegroundCheck([{ ...run, status: 'queued' }], now + 60 * 60000), false);
});

test('API reachability alone cannot pass the government result schema check', () => {
  const valid = { success: true, data: { state: 'published', date: '2026-11-01', result: { first_prize: '001234', last_two: '00' } } };
  assert.equal(validateRanlottoResponse(valid), true);
  for (const value of [null, '<html>403</html>', { success: true }, { ...valid, success: false }, { ...valid, data: { ...valid.data, state: 'draft' } }, { ...valid, data: { ...valid.data, result: { first_prize: '001234' } } }]) assert.equal(validateRanlottoResponse(value), false);
});
