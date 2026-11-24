// How often every source is polled. A 60s cycle issued 1,440 requests per source
// per day, which exhausted the free D1 read quota behind ThaiLottoAPI and left it
// answering HTTP 500 for the rest of the day. Five minutes still lands a result
// well inside a draw window at a fifth of the load.
export const POLL_SECONDS = 300;

// A source that fails this many cycles in a row is parked instead of retried, so
// an origin that is already refusing us is not asked again every cycle.
export const BACKOFF_FAILURES = 3;
export const BACKOFF_MS = 30 * 60 * 1000;

// Provider errors arrive either as a name or as {source, status, reason}.
export function sourceName(entry) {
  return typeof entry === 'string' ? entry : entry?.source;
}

export function parkedSources(backoff, now) {
  return new Set(Object.entries(backoff || {})
    .filter(([, entry]) => Number(entry?.until) > +now)
    .map(([name]) => name));
}

export function nextBackoff(previous, errors, delivered, now) {
  const at = +now, failed = new Set(errors.map(sourceName).filter(Boolean)), next = {};
  for (const name of parkedSources(previous, now)) next[name] = previous[name];
  for (const name of failed) {
    const failures = (Number(previous?.[name]?.failures) || 0) + 1;
    const until = failures >= BACKOFF_FAILURES ? at + BACKOFF_MS : Number(previous?.[name]?.until) || 0;
    next[name] = { failures, until };
  }
  // A source that answered is healthy again, even if it had failed before.
  for (const name of delivered) if (!failed.has(name)) delete next[name];
  return next;
}

// Degraded only when most of the sources that were tried are failing, not when a
// single third-party endpoint is down while the others still deliver results.
export function mostlyDown(sources, errors) {
  const failed = new Set(errors.map(sourceName).filter(Boolean));
  const tried = new Set([...sources, ...failed]);
  return tried.size > 0 && failed.size * 2 >= tried.size;
}
