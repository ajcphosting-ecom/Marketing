-- Billing (Whop). See README "Billing (Whop)" for how this is wired up and
-- what's best-effort vs. verified.

ALTER TABLE clients ADD COLUMN billing_status TEXT NOT NULL DEFAULT 'none'; -- none | active | past_due | cancelled
ALTER TABLE clients ADD COLUMN whop_checkout_url TEXT;
ALTER TABLE clients ADD COLUMN whop_membership_id TEXT;

-- Every webhook delivery gets logged here, verified or not, mapped or not —
-- this is the safety net for confirming Whop's real payload shape once
-- live traffic exists, since it couldn't be verified against live docs
-- while building this.
CREATE TABLE webhook_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  provider     TEXT NOT NULL, -- e.g. 'whop'
  event_type   TEXT,
  verified     INTEGER NOT NULL DEFAULT 0, -- signature check passed
  needs_review INTEGER NOT NULL DEFAULT 0, -- couldn't confidently map to a client/status
  client_id    INTEGER REFERENCES clients (id) ON DELETE SET NULL,
  payload      TEXT NOT NULL, -- raw JSON body, verbatim
  received_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_webhook_events_provider_received ON webhook_events (provider, received_at DESC);
