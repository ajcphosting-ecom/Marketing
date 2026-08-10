-- Admin-side client management: invite links so the founder can onboard a
-- client user without touching a CLI, and a source tag on metrics so we can
-- tell manually-entered numbers apart from ones a future sync writes.

CREATE TABLE client_invites (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT NOT NULL,
  accepted_at TEXT
);
CREATE UNIQUE INDEX idx_client_invites_token ON client_invites (token);
CREATE INDEX idx_client_invites_client_id ON client_invites (client_id);

ALTER TABLE metrics_snapshots ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
