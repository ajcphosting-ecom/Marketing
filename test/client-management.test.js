const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, getCookie, extractCsrf, adminLogin } = require("./helpers");
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

test("admin can create a client", async () => {
  const listPage = await fetch(`${ctx.baseUrl}/admin/clients`, { headers: { Cookie: adminCookie } });
  const csrf = extractCsrf(await listPage.text());

  const res = await postForm("/admin/clients", adminCookie, { name: "Acme Co", _csrf: csrf });
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location"), /^\/admin\/clients\/\d+/);

  const client = clientsDb.listClients().find((c) => c.name === "Acme Co");
  assert.ok(client, "client should be persisted");
  assert.equal(client.slug, "acme-co");
});

test("client management routes require admin auth", async () => {
  const res = await fetch(`${ctx.baseUrl}/admin/clients`, { redirect: "manual" });
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location"), /^\/admin\/login/);
});

test("invite -> accept flow creates a logged-in portal user", async () => {
  const client = clientsDb.createClient({ name: "Invite Test Co" });

  const detailPage = await fetch(`${ctx.baseUrl}/admin/clients/${client.id}`, { headers: { Cookie: adminCookie } });
  const csrf = extractCsrf(await detailPage.text());

  const inviteRes = await postForm(`/admin/clients/${client.id}/invites`, adminCookie, {
    email: "newclient@example.com",
    _csrf: csrf,
  });
  assert.equal(inviteRes.status, 302);

  const invite = clientsDb.listPendingInvites(client.id)[0];
  assert.ok(invite, "invite should be persisted");
  assert.equal(invite.email, "newclient@example.com");

  // GET the accept-invite page to pick up a fresh session + CSRF token.
  const acceptPage = await fetch(`${ctx.baseUrl}/portal/accept-invite?token=${invite.token}`);
  const acceptCookie = getCookie(acceptPage);
  const acceptHtml = await acceptPage.text();
  assert.match(acceptHtml, /Invite Test Co/);
  const acceptCsrf = extractCsrf(acceptHtml);

  const submitRes = await fetch(`${ctx.baseUrl}/portal/accept-invite`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: acceptCookie },
    body: new URLSearchParams({
      token: invite.token,
      password: "a-brand-new-password",
      password2: "a-brand-new-password",
      _csrf: acceptCsrf,
    }),
    redirect: "manual",
  });
  assert.equal(submitRes.status, 302);
  assert.equal(submitRes.headers.get("location"), "/portal");

  const sessionCookie = getCookie(submitRes);
  const dashboard = await fetch(`${ctx.baseUrl}/portal`, { headers: { Cookie: sessionCookie } });
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /Invite Test Co/);

  // The same token must not be reusable.
  const reuse = await fetch(`${ctx.baseUrl}/portal/accept-invite?token=${invite.token}`);
  assert.match(await reuse.text(), /Invite not found/);
});

test("admin can log a manual metric with server-computed ROAS", async () => {
  const client = clientsDb.createClient({ name: "Metrics Co" });
  const detailPage = await fetch(`${ctx.baseUrl}/admin/clients/${client.id}`, { headers: { Cookie: adminCookie } });
  const csrf = extractCsrf(await detailPage.text());

  const res = await postForm(`/admin/clients/${client.id}/metrics`, adminCookie, {
    date: "2026-01-15",
    adSpend: "200",
    revenue: "600",
    _csrf: csrf,
  });
  assert.equal(res.status, 302);

  const [metric] = clientsDb.getMetrics(client.id);
  assert.equal(metric.ad_spend, 200);
  assert.equal(metric.revenue, 600);
  assert.equal(metric.roas, 3);
  assert.equal(metric.source, "manual");
});

test("integration sync surfaces NotImplementedError instead of pretending to succeed", async () => {
  const client = clientsDb.createClient({ name: "Integration Co" });
  const detailPage = await fetch(`${ctx.baseUrl}/admin/clients/${client.id}`, { headers: { Cookie: adminCookie } });
  const csrf = extractCsrf(await detailPage.text());

  await postForm(`/admin/clients/${client.id}/integrations/shopify`, adminCookie, {
    shopDomain: "test.myshopify.com",
    accessToken: "fake-token",
    _csrf: csrf,
  });

  const result = await clientsDb.syncIntegration(client.id, "shopify");
  assert.equal(result.ok, false);
  assert.equal(result.notImplemented, true);
  assert.match(result.error, /isn't implemented yet/);

  const statuses = clientsDb.listIntegrationStatuses(client.id);
  const shopify = statuses.find((s) => s.key === "shopify");
  assert.equal(shopify.status, "error");
  assert.match(shopify.lastError, /isn't implemented yet/);
});

test("integration credentials round-trip through encryption", async () => {
  const client = clientsDb.createClient({ name: "Crypto Co" });
  clientsDb.saveIntegrationCredentials(client.id, "meta_ads", {
    adAccountId: "123",
    accessToken: "super-secret-token",
  });

  const db = require("../db").getDb();
  const row = db
    .prepare("SELECT credentials_encrypted FROM client_integrations WHERE client_id = ? AND provider = ?")
    .get(client.id, "meta_ads");
  assert.ok(row.credentials_encrypted, "credentials should be stored");
  assert.doesNotMatch(row.credentials_encrypted, /super-secret-token/, "ciphertext must not contain the plaintext secret");
});
