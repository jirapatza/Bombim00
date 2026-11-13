CREATE TABLE IF NOT EXISTS browser_push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  subscription TEXT NOT NULL,
  tested_at INTEGER NOT NULL DEFAULT 0
);
