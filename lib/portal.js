// Auth + read access for the client-facing portal itself (login, session,
// dashboard queries). Admin-side management (creating clients, invites,
// logging experiments/metrics, integrations) lives in lib/clients.js —
// getExperiments/getMetrics are re-exported from there so portal routes
// don't need to know the data lives in two files.

const bcrypt = require("bcryptjs");
const { getDb } = require("../db");
const { getExperiments, getMetrics } = require("./clients");

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

module.exports = {
  findUserByEmail,
  verifyPassword,
  getUserById,
  getExperiments,
  getMetrics,
};
