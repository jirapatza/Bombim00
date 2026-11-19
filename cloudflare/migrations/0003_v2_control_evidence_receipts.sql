CREATE TABLE IF NOT EXISTS verification_evidence (
  evidence_key TEXT PRIMARY KEY,
  draw_key TEXT NOT NULL,
  lottery_id TEXT NOT NULL,
  draw_date TEXT NOT NULL,
  source_family TEXT NOT NULL,
  top3 TEXT NOT NULL,
  bottom2 TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  raw_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS verification_evidence_draw ON verification_evidence(draw_key);
CREATE TRIGGER IF NOT EXISTS verification_evidence_retention AFTER INSERT ON verification_evidence
BEGIN
  DELETE FROM verification_evidence WHERE observed_at < (unixepoch() * 1000) - (45 * 86400000);
END;

CREATE TABLE IF NOT EXISTS verification_draws (
  draw_key TEXT PRIMARY KEY,
  lottery_id TEXT NOT NULL,
  draw_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('verified', 'waiting_for_evidence', 'conflict')),
  source_count INTEGER NOT NULL,
  sources TEXT NOT NULL CHECK (json_valid(sources)),
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS verification_draws_status ON verification_draws(status, updated_at);
CREATE TRIGGER IF NOT EXISTS verification_draws_retention AFTER INSERT ON verification_draws
BEGIN
  DELETE FROM verification_draws WHERE updated_at < (unixepoch() * 1000) - (45 * 86400000);
END;

CREATE TABLE IF NOT EXISTS coda_control_requests (
  request_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target TEXT,
  desired_value TEXT,
  evidence TEXT,
  requested_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  applied_at INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('applied', 'rejected')),
  reason TEXT
);

CREATE TABLE IF NOT EXISTS browser_push_receipts (
  delivery_id TEXT PRIMARY KEY,
  device_hash TEXT NOT NULL,
  draw_keys TEXT NOT NULL CHECK (json_valid(draw_keys)),
  accepted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  received_at INTEGER,
  opened_at INTEGER
);
CREATE INDEX IF NOT EXISTS browser_push_receipts_pending ON browser_push_receipts(received_at, expires_at);
