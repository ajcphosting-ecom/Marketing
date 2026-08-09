// Data access for the client portal (Phase 2 foundation). Real schema,
// real auth, real queries — but the numbers behind it are seeded demo data
// (see scripts/seed-portal-demo.js) until this is wired to an actual ad
// platform / analytics integration.

const bcrypt = require("bcryptjs");
const { getDb } = require("../db");

function findUserByEmail(email) {
  const db = getDb();
  return db
    .prepare(
      `SELECT client_users.*, clients.name AS client_name, clients.slug AS client_slug
       FROM client_users
       JOIN clients ON clients.id = client_users.client_id
       WHERE client_users.email = ? COLLATE NOCASE`
    )
    .get(email);
}

function verifyPassword(user, password) {
  if (!user) return false;
  try {
    return bcrypt.compareSync(password, user.password_hash);
  } catch {
    return false;
  }
}

function getUserById(id) {
  const db = getDb();
  return db
    .prepare(
      `SELECT client_users.*, clients.name AS client_name, clients.slug AS client_slug
       FROM client_users
       JOIN clients ON clients.id = client_users.client_id
       WHERE client_users.id = ?`
    )
    .get(id);
}

function getExperiments(clientId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM experiments WHERE client_id = ? ORDER BY started_at DESC`
    )
    .all(clientId);
}

function getMetrics(clientId, days = 90) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM metrics_snapshots
       WHERE client_id = ?
       ORDER BY date ASC
       LIMIT ?`
    )
    .all(clientId, days);
}

function createClient({ name, slug }) {
  const db = getDb();
  const info = db.prepare("INSERT INTO clients (name, slug) VALUES (?, ?)").run(name, slug);
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(info.lastInsertRowid);
}

function createClientUser({ clientId, email, password }) {
  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO client_users (client_id, email, password_hash) VALUES (?, ?, ?)"
  ).run(clientId, email, hash);
}

module.exports = {
  findUserByEmail,
  verifyPassword,
  getUserById,
  getExperiments,
  getMetrics,
  createClient,
  createClientUser,
};
