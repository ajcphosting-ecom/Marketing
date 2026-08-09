-- Phase 2 foundation: the client portal. These tables exist so the portal
-- has somewhere real to read/write, but nothing here is wired to a live ad
-- platform yet — see README "Phase 2: client portal" for status.

CREATE TABLE clients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX idx_clients_slug ON clients (slug);

CREATE TABLE client_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     INTEGER NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX idx_client_users_email ON client_users (email COLLATE NOCASE);

-- One row per CRO/paid-media experiment run for a client.
CREATE TABLE experiments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'cro', -- cro | paid-media | creative
  status      TEXT NOT NULL DEFAULT 'running', -- running | won | lost | paused
  lift_pct    REAL, -- null while running
  started_at  TEXT NOT NULL,
  ended_at    TEXT
);
CREATE INDEX idx_experiments_client_id ON experiments (client_id);

-- Daily blended performance snapshot per client, feeds the portal chart.
CREATE TABLE metrics_snapshots (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  date      TEXT NOT NULL, -- YYYY-MM-DD
  roas      REAL NOT NULL,
  ad_spend  REAL NOT NULL,
  revenue   REAL NOT NULL
);
CREATE UNIQUE INDEX idx_metrics_snapshots_client_date ON metrics_snapshots (client_id, date);
