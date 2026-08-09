-- AI-assisted automation: experiment suggestions Claude proposes (never
-- auto-applied — an admin approves or dismisses each one), and a log of
-- weekly report sends for observability/debugging.

CREATE TABLE experiment_suggestions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       INTEGER NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'cro',
  rationale       TEXT,
  expected_impact TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | dismissed
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_experiment_suggestions_client_status ON experiment_suggestions (client_id, status);

CREATE TABLE report_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id  INTEGER NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  status     TEXT NOT NULL, -- sent | failed | skipped_no_users | skipped_no_data
  detail     TEXT,
  sent_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_report_log_client_sent ON report_log (client_id, sent_at DESC);
