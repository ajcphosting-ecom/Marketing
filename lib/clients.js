// Admin-side data access for client management: creating clients, inviting
// their users, logging experiments, entering performance numbers by hand,
// and connecting (eventually) real data-source integrations.
//
// Read paths used by the client-facing portal (auth, dashboard) live in
// lib/portal.js; this module is the admin/management side. Both work off
// the same `clients`/`experiments`/`metrics_snapshots` tables.

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { getDb } = require("../db");
const { encrypt, decrypt } = require("./crypto");
const { PROVIDERS, NotImplementedError } = require("./integrations");

const INVITE_TTL_DAYS = 7;

// ---- clients ---------------------------------------------------------------

function listClients() {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         clients.*,
         (SELECT COUNT(*) FROM client_users WHERE client_users.client_id = clients.id) AS user_count,
         (SELECT COUNT(*) FROM experiments WHERE experiments.client_id = clients.id) AS experiment_count,
         (SELECT roas FROM metrics_snapshots
            WHERE metrics_snapshots.client_id = clients.id
            ORDER BY date DESC LIMIT 1) AS latest_roas
       FROM clients
       ORDER BY clients.created_at DESC`
    )
    .all();
}

function getClientById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function createClient({ name }) {
  const db = getDb();
  const baseSlug = slugify(name) || "client";
  let slug = baseSlug;
  let n = 2;
  while (db.prepare("SELECT 1 FROM clients WHERE slug = ?").get(slug)) {
    slug = `${baseSlug}-${n++}`;
  }
  const info = db.prepare("INSERT INTO clients (name, slug) VALUES (?, ?)").run(name, slug);
  return getClientById(info.lastInsertRowid);
}

// ---- client users + invites -------------------------------------------------

function getClientUsers(clientId) {
  const db = getDb();
  return db
    .prepare("SELECT id, email, created_at FROM client_users WHERE client_id = ? ORDER BY created_at ASC")
    .all(clientId);
}

function listPendingInvites(clientId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM client_invites
       WHERE client_id = ? AND accepted_at IS NULL AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
       ORDER BY created_at DESC`
    )
    .all(clientId);
}

function createInvite(clientId, email) {
  const db = getDb();
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400000).toISOString();
  db.prepare(
    "INSERT INTO client_invites (client_id, email, token, expires_at) VALUES (?, ?, ?, ?)"
  ).run(clientId, email, token, expiresAt);
  return { token, expiresAt };
}

function getInviteByToken(token) {
  const db = getDb();
  return db
    .prepare(
      `SELECT client_invites.*, clients.name AS client_name
       FROM client_invites JOIN clients ON clients.id = client_invites.client_id
       WHERE token = ?`
    )
    .get(token);
}

function isInviteValid(invite) {
  return Boolean(invite) && !invite.accepted_at && new Date(invite.expires_at) > new Date();
}

/** Accepts an invite: creates the client_user, marks the invite used. Returns the new user id. */
function acceptInvite(token, password) {
  const db = getDb();
  const invite = getInviteByToken(token);
  if (!isInviteValid(invite)) {
    throw new Error("This invite link is invalid or has expired.");
  }

  const existing = db
    .prepare("SELECT id FROM client_users WHERE email = ? COLLATE NOCASE")
    .get(invite.email);
  if (existing) {
    throw new Error("An account with this email already exists. Try logging in instead.");
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const run = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO client_users (client_id, email, password_hash) VALUES (?, ?, ?)")
      .run(invite.client_id, invite.email, passwordHash);
    db.prepare("UPDATE client_invites SET accepted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(
      invite.id
    );
    return info.lastInsertRowid;
  });
  return run();
}

/** Direct user creation, bypassing the invite flow — used by the demo seed script. */
function createClientUserDirect(clientId, email, password) {
  const db = getDb();
  const passwordHash = bcrypt.hashSync(password, 10);
  const existing = db.prepare("SELECT id FROM client_users WHERE email = ? COLLATE NOCASE").get(email);
  if (existing) {
    db.prepare("UPDATE client_users SET password_hash = ? WHERE id = ?").run(passwordHash, existing.id);
    return existing.id;
  }
  const info = db
    .prepare("INSERT INTO client_users (client_id, email, password_hash) VALUES (?, ?, ?)")
    .run(clientId, email, passwordHash);
  return info.lastInsertRowid;
}

// ---- experiments -------------------------------------------------------------

function getExperiments(clientId) {
  const db = getDb();
  return db.prepare("SELECT * FROM experiments WHERE client_id = ? ORDER BY started_at DESC").all(clientId);
}

function addExperiment(clientId, { name, channel, status, liftPct, startedAt }) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO experiments (client_id, name, channel, status, lift_pct, started_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(clientId, name, channel, status, liftPct, startedAt || new Date().toISOString());
  return db.prepare("SELECT * FROM experiments WHERE id = ?").get(info.lastInsertRowid);
}

function updateExperiment(id, { status, liftPct, endedAt }) {
  const db = getDb();
  db.prepare("UPDATE experiments SET status = ?, lift_pct = ?, ended_at = ? WHERE id = ?").run(
    status,
    liftPct,
    endedAt || null,
    id
  );
  return db.prepare("SELECT * FROM experiments WHERE id = ?").get(id);
}

// ---- metrics (manual entry today, connector-fed later) -----------------------

function getMetrics(clientId, days = 90) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM metrics_snapshots WHERE client_id = ? ORDER BY date ASC LIMIT ?")
    .all(clientId, days);
}

function getRecentMetrics(clientId, limit = 14) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM metrics_snapshots WHERE client_id = ? ORDER BY date DESC LIMIT ?")
    .all(clientId, limit);
}

/** Insert-or-update a day's numbers. ROAS is always derived server-side, never trusted from input. */
function upsertMetric(clientId, { date, adSpend, revenue, source = "manual" }) {
  const db = getDb();
  const roas = adSpend > 0 ? revenue / adSpend : 0;
  db.prepare(
    `INSERT INTO metrics_snapshots (client_id, date, roas, ad_spend, revenue, source)
     VALUES (@clientId, @date, @roas, @adSpend, @revenue, @source)
     ON CONFLICT(client_id, date) DO UPDATE SET
       roas = excluded.roas, ad_spend = excluded.ad_spend, revenue = excluded.revenue, source = excluded.source`
  ).run({ clientId, date, roas, adSpend, revenue, source });
}

// ---- integrations (scaffold — see lib/integrations/*.js) ---------------------

function listIntegrationStatuses(clientId) {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM client_integrations WHERE client_id = ?")
    .all(clientId);
  const byProvider = Object.fromEntries(rows.map((r) => [r.provider, r]));

  return Object.entries(PROVIDERS).map(([key, meta]) => ({
    key,
    label: meta.label,
    docsHint: meta.docsHint,
    fields: meta.fields,
    status: byProvider[key]?.status || "not_connected",
    lastSyncedAt: byProvider[key]?.last_synced_at || null,
    lastError: byProvider[key]?.last_error || null,
  }));
}

function saveIntegrationCredentials(clientId, provider, credentials) {
  if (!PROVIDERS[provider]) throw new Error(`Unknown provider: ${provider}`);
  const db = getDb();
  const encoded = encrypt(credentials);
  db.prepare(
    `INSERT INTO client_integrations (client_id, provider, status, credentials_encrypted, updated_at)
     VALUES (?, ?, 'configured', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(client_id, provider) DO UPDATE SET
       status = 'configured', credentials_encrypted = excluded.credentials_encrypted,
       last_error = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ).run(clientId, provider, encoded);
}

/**
 * Attempts a sync for a configured provider. Every shipped connector is a
 * stub today (see lib/integrations/*.js), so this will currently always
 * fail with NotImplementedError — that failure is recorded on the
 * integration row and surfaced to the admin, rather than silently ignored.
 */
async function syncIntegration(clientId, provider) {
  const db = getDb();
  const meta = PROVIDERS[provider];
  if (!meta) throw new Error(`Unknown provider: ${provider}`);

  const row = db
    .prepare("SELECT * FROM client_integrations WHERE client_id = ? AND provider = ?")
    .get(clientId, provider);
  if (!row || !row.credentials_encrypted) {
    throw new Error("No credentials saved for this integration yet.");
  }

  const credentials = decrypt(row.credentials_encrypted);
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  try {
    const rows = await meta.connector.fetchDailyMetrics(credentials, { since, until });
    const run = db.transaction(() => {
      for (const r of rows) {
        upsertMetric(clientId, { date: r.date, adSpend: r.adSpend, revenue: r.revenue, source: provider });
      }
    });
    run();

    db.prepare(
      "UPDATE client_integrations SET status = 'configured', last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), last_error = NULL WHERE id = ?"
    ).run(row.id);
    return { ok: true, count: rows.length };
  } catch (err) {
    db.prepare("UPDATE client_integrations SET status = 'error', last_error = ? WHERE id = ?").run(
      err.message,
      row.id
    );
    if (err instanceof NotImplementedError) {
      return { ok: false, notImplemented: true, error: err.message };
    }
    return { ok: false, error: err.message };
  }
}

// ---- billing (Whop) ----------------------------------------------------------

const BILLING_STATUSES = new Set(["none", "active", "past_due", "cancelled"]);

function setBillingStatus(clientId, status, membershipId) {
  if (!BILLING_STATUSES.has(status)) throw new Error(`Invalid billing status: ${status}`);
  const db = getDb();
  if (membershipId) {
    db.prepare("UPDATE clients SET billing_status = ?, whop_membership_id = ? WHERE id = ?").run(
      status,
      membershipId,
      clientId
    );
  } else {
    db.prepare("UPDATE clients SET billing_status = ? WHERE id = ?").run(status, clientId);
  }
}

function setWhopCheckoutUrl(clientId, url) {
  const db = getDb();
  db.prepare("UPDATE clients SET whop_checkout_url = ? WHERE id = ?").run(url || null, clientId);
}

/** Finds the client a portal-user email belongs to — used to map inbound webhooks. */
function findClientIdByUserEmail(email) {
  const db = getDb();
  const row = db
    .prepare("SELECT client_id FROM client_users WHERE email = ? COLLATE NOCASE")
    .get(email);
  return row ? row.client_id : null;
}

module.exports = {
  listClients,
  getClientById,
  createClient,
  getClientUsers,
  createClientUserDirect,
  listPendingInvites,
  createInvite,
  getInviteByToken,
  isInviteValid,
  acceptInvite,
  getExperiments,
  addExperiment,
  updateExperiment,
  getMetrics,
  getRecentMetrics,
  upsertMetric,
  setBillingStatus,
  setWhopCheckoutUrl,
  findClientIdByUserEmail,
  listIntegrationStatuses,
  saveIntegrationCredentials,
  syncIntegration,
};
