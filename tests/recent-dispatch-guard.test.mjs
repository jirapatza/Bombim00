import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecentDispatchGuard } from '../src/utils/recentDispatchGuard.ts';

test('recent dispatch guard rejects identical accepted inputs during cooldown', () => {
  const guard = createRecentDispatchGuard(8000);
  guard.markAccepted('["all","false"]', 1000);

  assert.equal(guard.isDuplicate('["all","false"]', 1001), true);
  assert.equal(guard.remainingMs('["all","false"]', 1001), 7999);
  assert.equal(guard.isDuplicate('["vip","false"]', 1001), false);
});

test('recent dispatch guard allows retry after cooldown and prunes expired entries', () => {
  const guard = createRecentDispatchGuard(8000);
  guard.markAccepted('["all","false"]', 1000);

  assert.equal(guard.isDuplicate('["all","false"]', 8999), true);
  assert.equal(guard.isDuplicate('["all","false"]', 9000), false);
  assert.equal(guard.remainingMs('["all","false"]', 9000), 0);
});

test('recent dispatch guard refreshes the cooldown after a new accepted dispatch', () => {
  const guard = createRecentDispatchGuard(8000);
  guard.markAccepted('["all","false"]', 1000);
  guard.markAccepted('["all","false"]', 5000);

  assert.equal(guard.remainingMs('["all","false"]', 9001), 0);
  assert.equal(guard.remainingMs('["all","false"]', 5001), 7999);
});
