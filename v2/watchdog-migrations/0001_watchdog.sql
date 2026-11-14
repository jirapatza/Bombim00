CREATE TABLE watchdog_incident (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  incident_id TEXT NOT NULL,
  condition TEXT NOT NULL CHECK(condition IN ('stale', 'unreachable')),
  status TEXT NOT NULL CHECK(status IN ('sending', 'accepted', 'rejected', 'authentication_error', 'configuration_error', 'uncertain', 'resolved')),
  updated_at TEXT NOT NULL
);
