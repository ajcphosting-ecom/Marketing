// AI automation: computeStats() (pure, no network) and the experiment
// suggestion approve/dismiss flow at the DB layer, plus graceful
// degradation everywhere an ANTHROPIC_API_KEY isn't set — as it isn't in
// this test environment. No real Claude API calls happen in this suite.

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, extractCsrf, adminLogin } = require("./helpers");
const { computeStats } = require("../lib/reports");
const ai = require("../lib/ai");
const clientsDb = require("../lib/clients");

let ctx;
let adminCookie;

before(async () => {
  ctx = await startServer();
  adminCookie = await adminLogin(ctx.baseUrl);
});

after(async () => {
  await ctx.close();
});

async function postForm(path, cookie, fields) {
  return fetch(`${ctx.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams(fields),
    redirect: "manual",
  });
}

test("computeStats returns null with no data", () => {
  assert.equal(computeStats([]), null);
});

test("computeStats averages the last 7 days and omits change% with no prior week", () => {
  const metrics = [
    { roas: 2, ad_spend: 100, revenue: 200 },
    { roas: 3, ad_spend: 100, revenue: 300 },
    { roas: 4, ad_spend: 100, revenue: 400 },
  ];
  const stats = computeStats(metrics);
  assert.equal(stats.daysOfData, 3);
  assert.equal(stats.avgRoasLast7Days, 3); // (2+3+4)/3
  assert.equal(stats.avgRoasChangePct, null); // fewer than 14 days — no prior week to compare
  assert.equal(stats.totalAdSpendLast7Days, 300);
  assert.equal(stats.totalRevenueLast7Days, 900);
});

test("computeStats computes week-over-week % change once 14+ days exist", () => {
  const prevWeek = Array.from({ length: 7 }, () => ({ roas: 2, ad_spend: 100, revenue: 200 }));
  const lastWeek = Array.from({ length: 7 }, () => ({ roas: 3, ad_spend: 100, revenue: 300 }));
  const stats = computeStats([...prevWeek, ...lastWeek]);
  assert.equal(stats.avgRoasLast7Days, 3);
  assert.equal(stats.avgRoasChangePct, 50); // (3-2)/2 * 100
});

test("ai.isConfigured() is false without ANTHROPIC_API_KEY", () => {
  assert.equal(process.env.ANTHROPIC_API_KEY, undefined);
  assert.equal(ai.isConfigured(), false);
});

test("suggestion approve/dismiss: approving turns a suggestion into a running experiment", () => {
  const client = clientsDb.createClient({ name: "Suggestion Test Co" });
  const [suggestion] = clientsDb.createSuggestions(client.id, [
    { name: "Test a shorter checkout form", channel: "cro", rationale: "Fewer fields, less drop-off.", expectedImpact: "Likely +2-4% conversion" },
  ]);
  assert.equal(suggestion.status, "pending");

  const experiment = clientsDb.approveSuggestion(suggestion.id);
  assert.ok(experiment);
  assert.equal(experiment.name, "Test a shorter checkout form");
  assert.equal(experiment.status, "running");

  const stillPending = clientsDb.listPendingSuggestions(client.id);
  assert.equal(stillPending.length, 0);

  const experiments = clientsDb.getExperiments(client.id);
  assert.ok(experiments.some((e) => e.name === "Test a shorter checkout form"));

  // Approving again (already approved) is a no-op, not a double-insert.
  assert.equal(clientsDb.approveSuggestion(suggestion.id), null);
});

test("suggestion approve/dismiss: dismissing discards it without creating an experiment", () => {
  const client = clientsDb.createClient({ name: "Dismiss Test Co" });
  const [suggestion] = clientsDb.createSuggestions(client.id, [
    { name: "Try a video hero", channel: "creative", rationale: "Static hero underperforms industry norms.", expectedImpact: "Uncertain, worth a quick test" },
  ]);

  assert.equal(clientsDb.dismissSuggestion(suggestion.id), true);
  assert.equal(clientsDb.listPendingSuggestions(client.id).length, 0);
  assert.equal(clientsDb.getExperiments(client.id).length, 0);

  // Dismissing again (already dismissed) is a no-op.
  assert.equal(clientsDb.dismissSuggestion(suggestion.id), false);
});

test("client detail page shows the AI panel disabled without an API key, with no pending suggestions", async () => {
  const client = clientsDb.createClient({ name: "No Key Co" });
  const res = await fetch(`${ctx.baseUrl}/admin/clients/${client.id}`, { headers: { Cookie: adminCookie } });
  const body = await res.text();
  assert.match(body, /AI-suggested experiments/);
  assert.match(body, /ANTHROPIC_API_KEY.*isn't set/);
});

test("POST .../experiments/suggest redirects with a flash instead of crashing when AI isn't configured", async () => {
  const client = clientsDb.createClient({ name: "Suggest Route Co" });
  const detailPage = await fetch(`${ctx.baseUrl}/admin/clients/${client.id}`, { headers: { Cookie: adminCookie } });
  const csrf = extractCsrf(await detailPage.text());

  const res = await postForm(`/admin/clients/${client.id}/experiments/suggest`, adminCookie, { _csrf: csrf });
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location"), /flash=/);
  assert.equal(clientsDb.listPendingSuggestions(client.id).length, 0);
});

test("scheduler.start() no-ops without ANTHROPIC_API_KEY instead of throwing", () => {
  const scheduler = require("../lib/scheduler");
  const task = scheduler.start();
  assert.equal(task, null);
});
