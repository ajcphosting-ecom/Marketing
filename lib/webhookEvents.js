// Raw storage for inbound webhook deliveries — the debugging safety net
// for lib/billing/whop.js's best-effort event mapping.

const { getDb } = require("../db");

function recordEvent({ provider, eventType, verified, needsReview, clientId, payload }) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO webhook_events (provider, event_type, verified, needs_review, client_id, payload)
       VALUES (@provider, @eventType, @verified, @needsReview, @clientId, @payload)`
    )
    .run({
      provider,
      eventType: eventType || null,
      verified: verified ? 1 : 0,
      needsReview: needsReview ? 1 : 0,
      clientId: clientId || null,
      payload,
    });
  return info.lastInsertRowid;
}

function listRecentEvents(provider, limit = 50) {
  const db = getDb();
  return db
    .prepare(
      `SELECT webhook_events.*, clients.name AS client_name
       FROM webhook_events
       LEFT JOIN clients ON clients.id = webhook_events.client_id
       WHERE provider = ?
       ORDER BY received_at DESC
       LIMIT ?`
    )
    .all(provider, limit);
}

module.exports = { recordEvent, listRecentEvents };
