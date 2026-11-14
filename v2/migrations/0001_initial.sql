PRAGMA foreign_keys = ON;
CREATE TABLE draws (id TEXT PRIMARY KEY, lottery_type TEXT NOT NULL, draw_date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','confirmed','conflict')), confirmed_at TEXT, UNIQUE(lottery_type, draw_date));
CREATE TABLE results (id INTEGER PRIMARY KEY, draw_id TEXT NOT NULL REFERENCES draws(id), prize TEXT NOT NULL, numbers TEXT NOT NULL, source TEXT NOT NULL, fetched_at TEXT NOT NULL, UNIQUE(draw_id, prize, source));
CREATE TABLE source_fetches (id INTEGER PRIMARY KEY, source TEXT NOT NULL, fetched_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('ok','error','malformed')), duration_ms INTEGER, error TEXT);
CREATE TABLE notifications (id INTEGER PRIMARY KEY, draw_id TEXT NOT NULL REFERENCES draws(id), channel TEXT NOT NULL, recipient TEXT NOT NULL, dedupe_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK(status IN ('sending','sent','failed','uncertain')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE run_log (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL CHECK(status IN ('running','success','failed')), failed_stage TEXT);
CREATE INDEX run_log_status_finished ON run_log(status, finished_at DESC);
CREATE TABLE subscriptions (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL);
