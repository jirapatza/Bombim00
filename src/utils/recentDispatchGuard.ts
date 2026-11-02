export function createRecentDispatchGuard(cooldownMs = 8000) {
  const recentDispatches = new Map();

  function prune(now = Date.now()) {
    for (const [fingerprint, expiresAt] of recentDispatches) {
      if (expiresAt <= now) recentDispatches.delete(fingerprint);
    }
  }

  return {
    isDuplicate(fingerprint: string, now = Date.now()) {
      prune(now);
      return (recentDispatches.get(fingerprint) || 0) > now;
    },
    remainingMs(fingerprint: string, now = Date.now()) {
      prune(now);
      return Math.max(0, (recentDispatches.get(fingerprint) || 0) - now);
    },
    markAccepted(fingerprint: string, now = Date.now()) {
      prune(now);
      recentDispatches.set(fingerprint, now + cooldownMs);
    },
  };
}
