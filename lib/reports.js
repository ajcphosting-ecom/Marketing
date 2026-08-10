// Weekly AI-generated performance reports, emailed to every portal user of
// every client. This is the automated half of "keep clients updated" —
// the founder doesn't write these by hand.

const { getDb } = require("../db");
const clientsDb = require("./clients");
const ai = require("./ai");
const email = require("./email");

/**
 * Pure function: turns a client's daily metrics into the pre-computed
 * numbers the AI report is grounded in. All arithmetic happens here, not
 * in the prompt — the model narrates numbers, it never calculates them.
 * `metrics` must be ordered oldest-to-newest (as lib/clients.js returns).
 */
function computeStats(metrics) {
  if (!metrics.length) return null;

  const last7 = metrics.slice(-7);
  const prev7 = metrics.slice(-14, -7);
  const avg = (rows, key) => rows.reduce((sum, r) => sum + r[key], 0) / rows.length;

  const avgRoasLast7Days = Math.round(avg(last7, "roas") * 100) / 100;
  const avgRoasChangePct = prev7.length
    ? Math.round(((avg(last7, "roas") - avg(prev7, "roas")) / avg(prev7, "roas")) * 1000) / 10
    : null;

  return {
    daysOfData: metrics.length,
    avgRoasLast7Days,
    avgRoasChangePct, // null when there's no prior week to compare against
    totalAdSpendLast7Days: Math.round(last7.reduce((s, r) => s + r.ad_spend, 0)),
    totalRevenueLast7Days: Math.round(last7.reduce((s, r) => s + r.revenue, 0)),
  };
}

function recordLog(clientId, status, detail) {
  const db = getDb();
  db.prepare("INSERT INTO report_log (client_id, status, detail) VALUES (?, ?, ?)").run(
    clientId,
    status,
    detail || null
  );
}

/** Generates and sends the weekly report for one client. Safe to call directly (e.g. for a manual resend). */
async function sendReportForClient(clientId) {
  const client = clientsDb.getClientById(clientId);
  if (!client) throw new Error(`No such client: ${clientId}`);

  const users = clientsDb.getClientUsers(clientId);
  if (!users.length) {
    recordLog(clientId, "skipped_no_users");
    return { status: "skipped_no_users" };
  }

  const metrics = clientsDb.getMetrics(clientId, 90);
  const stats = computeStats(metrics);
  if (!stats) {
    recordLog(clientId, "skipped_no_data");
    return { status: "skipped_no_data" };
  }

  const experiments = clientsDb
    .getExperiments(clientId)
    .slice(0, 8)
    .map((e) => ({ name: e.name, channel: e.channel, status: e.status, liftPct: e.lift_pct }));

  const bodyText = await ai.generateWeeklyReport({ clientName: client.name, stats, experiments });

  for (const user of users) {
    await email.sendWeeklyReport({ email: user.email, clientName: client.name, bodyText, stats });
  }

  recordLog(clientId, "sent");
  return { status: "sent", recipients: users.length };
}

/** Runs the weekly report for every client. One client's failure doesn't stop the rest. */
async function runWeeklyReports() {
  const results = [];
  for (const client of clientsDb.listClients()) {
    try {
      const result = await sendReportForClient(client.id);
      results.push({ clientId: client.id, clientName: client.name, ...result });
    } catch (err) {
      recordLog(client.id, "failed", err.message);
      results.push({ clientId: client.id, clientName: client.name, status: "failed", error: err.message });
    }
  }
  return results;
}

module.exports = { computeStats, sendReportForClient, runWeeklyReports };
