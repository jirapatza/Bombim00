// This database must be independent of the watched D1 database.
export function createStore(db, now = () => new Date().toISOString()) {
  return {
    async claimAlert(condition) {
      const id = crypto.randomUUID();
      const result = await db.prepare(`INSERT INTO watchdog_incident (id, incident_id, condition, status, updated_at)
        VALUES (1, ?, ?, 'sending', ?) ON CONFLICT(id) DO UPDATE SET
        incident_id = excluded.incident_id, condition = excluded.condition,
        status = excluded.status, updated_at = excluded.updated_at
        WHERE watchdog_incident.status = 'resolved'`).bind(id, condition, now()).run();
      return result.meta.changes === 1 ? id : null;
    },
    async finishAlert(id, status) {
      await db.prepare('UPDATE watchdog_incident SET status = ?, updated_at = ? WHERE id = 1 AND incident_id = ? AND status = ?')
        .bind(status, now(), id, 'sending').run();
    },
    async resolve() {
      // Do not clear ambiguous or in-flight sends: they require reconciliation.
      await db.prepare("UPDATE watchdog_incident SET status = 'resolved', updated_at = ? WHERE id = 1 AND status IN ('accepted', 'rejected', 'authentication_error', 'configuration_error')")
        .bind(now()).run();
    },
  };
}
