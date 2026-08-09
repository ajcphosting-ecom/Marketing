-- Core waitlist table backing the public landing page signup form.
CREATE TABLE waitlist_signups (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL,
  priority     TEXT,
  source       TEXT,
  utm          TEXT,
  status       TEXT NOT NULL DEFAULT 'new', -- new | contacted | converted | unsubscribed
  contacted_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Case-insensitive uniqueness so "Foo@x.com" and "foo@x.com" collide.
CREATE UNIQUE INDEX idx_waitlist_signups_email ON waitlist_signups (email COLLATE NOCASE);
CREATE INDEX idx_waitlist_signups_created_at ON waitlist_signups (created_at);
CREATE INDEX idx_waitlist_signups_status ON waitlist_signups (status);
