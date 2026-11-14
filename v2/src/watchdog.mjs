// Pure classification only. A separately deployed scheduler, durable alert
// state and the selected email provider are required before this can alert.
export function classifyHealth(httpStatus, body, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !Number.isInteger(httpStatus) || ![200, 503].includes(httpStatus)) {
    return { state: 'unreachable' };
  }
  if (body.status === 'unavailable') return { state: 'unreachable' };
  if (!['healthy', 'degraded'].includes(body.status)) return { state: 'unreachable' };
  if (body.last_success === null) return { state: 'stale', last_success: null };
  const timestamp = typeof body.last_success === 'string' ? Date.parse(body.last_success) : NaN;
  if (!Number.isFinite(timestamp) || timestamp > now) return { state: 'unreachable' };
  // A five-minute polling interval and a four-minute threshold aim to detect
  // missed heartbeats before ten minutes under normal scheduler operation.
  // Cron and email latency mean this cannot guarantee a ten-minute delivery.
  if (now - timestamp >= 240000) return { state: 'stale', last_success: body.last_success };
  // Treat contradictory HTTP and body statuses as an unreadable check.
  if (httpStatus !== 200 || body.status !== 'healthy') return { state: 'unreachable' };
  return { state: 'healthy', last_success: body.last_success };
}
