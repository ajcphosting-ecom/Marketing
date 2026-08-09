// Data access for waitlist signups. All queries go through better-sqlite3's
// synchronous API — fine here since SQLite calls are fast and this app runs
// as a single Node process (no event-loop-blocking concerns at this scale).

const { getDb } = require("../db");

function insert({ email, priority, source, utm }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO waitlist_signups (email, priority, source, utm)
    VALUES (@email, @priority, @source, @utm)
  `);
  const info = stmt.run({
    email,
    priority: priority || null,
    source: source || null,
    utm: utm || null,
  });
  return getById(info.lastInsertRowid);
}

function findByEmail(email) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM waitlist_signups WHERE email = ? COLLATE NOCASE")
    .get(email);
}

function getById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM waitlist_signups WHERE id = ?").get(id);
}

function count() {
  const db = getDb();
  return db.prepare("SELECT COUNT(*) AS n FROM waitlist_signups").get().n;
}

function countSince(isoDate) {
  const db = getDb();
  return db
    .prepare("SELECT COUNT(*) AS n FROM waitlist_signups WHERE created_at >= ?")
    .get(isoDate).n;
}

function countByPriority() {
  const db = getDb();
  return db
    .prepare(`
      SELECT COALESCE(priority, 'not-sure') AS priority, COUNT(*) AS n
      FROM waitlist_signups
      GROUP BY COALESCE(priority, 'not-sure')
      ORDER BY n DESC
    `)
    .all();
}

/**
 * Paginated, optionally-filtered list of signups for the admin dashboard.
 */
function list({ page = 1, pageSize = 25, status = "", search = "" } = {}) {
  const db = getDb();
  const where = [];
  const params = {};

  if (status) {
    where.push("status = @status");
    params.status = status;
  }
  if (search) {
    where.push("email LIKE @search");
    params.search = `%${search}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM waitlist_signups ${whereSql}`)
    .get(params).n;

  const offset = Math.max(0, (page - 1) * pageSize);
  const rows = db
    .prepare(
      `SELECT * FROM waitlist_signups ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset });

  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

function listAll() {
  const db = getDb();
  return db.prepare("SELECT * FROM waitlist_signups ORDER BY created_at ASC").all();
}

function markContacted(id) {
  const db = getDb();
  db.prepare(
    "UPDATE waitlist_signups SET status = 'contacted', contacted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
  ).run(id);
  return getById(id);
}

function setStatus(id, status) {
  const allowed = new Set(["new", "contacted", "converted", "unsubscribed"]);
  if (!allowed.has(status)) throw new Error(`Invalid status: ${status}`);
  const db = getDb();
  db.prepare("UPDATE waitlist_signups SET status = ? WHERE id = ?").run(status, id);
  return getById(id);
}

function toCsv(rows) {
  const header = "id,email,priority,source,utm,status,created_at,contacted_at\n";
  const body = rows
    .map((r) =>
      [r.id, r.email, r.priority, r.source, r.utm, r.status, r.created_at, r.contacted_at]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
  return header + body;
}

module.exports = {
  insert,
  findByEmail,
  getById,
  count,
  countSince,
  countByPriority,
  list,
  listAll,
  markContacted,
  setStatus,
  toCsv,
};
