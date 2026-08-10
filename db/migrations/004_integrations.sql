-- Per-client connections to external data sources (Shopify, Meta Ads,
-- Google Ads, GA4, ...). Credentials are stored encrypted at the
-- application layer (see lib/crypto.js) — this column only ever holds
-- ciphertext, never plaintext secrets.

CREATE TABLE client_integrations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id             INTEGER NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  provider              TEXT NOT NULL, -- shopify | meta_ads | google_ads | ga4
  status                TEXT NOT NULL DEFAULT 'not_connected', -- not_connected | configured | error
  credentials_encrypted TEXT,
  last_synced_at        TEXT,
  last_error            TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX idx_client_integrations_client_provider ON client_integrations (client_id, provider);
