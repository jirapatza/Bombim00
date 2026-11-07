CREATE TABLE worker_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);
INSERT INTO worker_state (id, payload) VALUES
  (1, '{"version":1,"deliveries":{},"pending":null,"lastSuccess":null,"error":null}');
