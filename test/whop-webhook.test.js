const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { startServer, adminLogin, getCookie, extractCsrf } = require("./helpers");
const whop = require("../lib/billing/whop");
const clientsDb = require("../lib/clients");
const webhookEvents = require("../lib/webhookEvents");

const WEBHOOK_SECRET = "whsec_" + Buffer.from("test-signing-key-not-real").toString("base64");
process.env.WHOP_WEBHOOK_SECRET = WEBHOOK_SECRET;

/** Builds a correctly-signed Standard Webhooks request for a given body. */
function sign(bodyObj, { timestamp = Math.floor(Date.now() / 1000), id = "msg_" + crypto.randomBytes(8).toString("hex") } = {}) {
  const rawBody = JSON.stringify(bodyObj);
  const key = Buffer.from(WEBHOOK_SECRET.slice("whsec_".length), "base64");
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const sig = crypto.createHmac("sha256", key).update(signedContent).digest("base64");
  return {
    rawBody,
    headers: { "webhook-id": id, "webhook-timestamp": String(timestamp), "webhook-signature": `v1,${sig}` },
  };
}

// ---- pure signature-verification unit tests (no server, no network) --------

test("verifySignature: accepts a correctly-signed payload", () => {
  const { rawBody, headers } = sign({ event: "payment.succeeded", data: {} });
  const result = whop.verifySignature({ headers, rawBody, secret: WEBHOOK_SECRET });
  assert.equal(result.valid, true);
});

test("verifySignature: rejects a tampered body", () => {
  const { headers } = sign({ event: "payment.succeeded", data: {} });
  const result = whop.verifySignature({ headers, rawBody: '{"event":"payment.succeeded","data":{"hacked":true}}', secret: WEBHOOK_SECRET });
  assert.equal(result.valid, false);
});

test("verifySignature: rejects a stale timestamp (replay protection)", () => {
  const { rawBody, headers } = sign({ event: "payment.succeeded" }, { timestamp: Math.floor(Date.now() / 1000) - 3600 });
  const result = whop.verifySignature({ headers, rawBody, secret: WEBHOOK_SECRET });
  assert.equal(result.valid, false);
  assert.match(result.reason, /tolerance/);
});

test("verifySignature: rejects when headers are missing", () => {
  const result = whop.verifySignature({ headers: {}, rawBody: "{}", secret: WEBHOOK_SECRET });
  assert.equal(result.valid, false);
});

test("mapEventToBilling: recognizes payment.succeeded as active", () => {
  const mapped = whop.mapEventToBilling("payment.succeeded", { email: "a@example.com" });
  assert.equal(mapped.status, "active");
  assert.equal(mapped.email, "a@example.com");
});

test("mapEventToBilling: recognizes a cancellation-shaped event as cancelled", () => {
  const mapped = whop.mapEventToBilling("membership.deactivated", { email: "a@example.com" });
  assert.equal(mapped.status, "cancelled");
});

test("mapEventToBilling: returns null for an unrecognized event", () => {
  assert.equal(whop.mapEventToBilling("some.unrelated.event", {}), null);
});

// ---- end-to-end webhook route ------------------------------------------------

let ctx;
let adminCookie;

before(async () => {
  ctx = await startServer();
  adminCookie = await adminLogin(ctx.baseUrl);
});

after(async () => {
  await ctx.close();
});

test("POST /webhooks/whop rejects an invalid signature and logs it unverified", async () => {
  const { rawBody } = sign({ event: "payment.succeeded", data: {} });
  const res = await fetch(`${ctx.baseUrl}/webhooks/whop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "webhook-id": "msg_bad",
      "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      "webhook-signature": "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    },
    body: rawBody,
  });
  assert.equal(res.status, 400);

  const [latest] = webhookEvents.listRecentEvents("whop", 1);
  assert.equal(latest.verified, 0);
});

test("POST /webhooks/whop with a valid signature updates a matched client's billing status", async () => {
  const client = clientsDb.createClient({ name: "Webhook Match Co" });
  clientsDb.createClientUserDirect(client.id, "match@example.com", "a-long-enough-password");
  assert.equal(clientsDb.getClientById(client.id).billing_status, "none");

  const { rawBody, headers } = sign({
    event: "payment.succeeded",
    data: { email: "match@example.com", membership_id: "mem_xyz" },
  });

  const res = await fetch(`${ctx.baseUrl}/webhooks/whop`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: rawBody,
  });
  assert.equal(res.status, 200);

  const updated = clientsDb.getClientById(client.id);
  assert.equal(updated.billing_status, "active");
  assert.equal(updated.whop_membership_id, "mem_xyz");

  const [latest] = webhookEvents.listRecentEvents("whop", 1);
  assert.equal(latest.verified, 1);
  assert.equal(latest.needs_review, 0);
  assert.equal(latest.client_id, client.id);
});

test("POST /webhooks/whop auto-provisions a client for an unmatched active payment", async () => {
  const { rawBody, headers } = sign({
    event: "payment.succeeded",
    data: { email: "nobody-registered@example.com", membership_id: "mem_new" },
  });

  const res = await fetch(`${ctx.baseUrl}/webhooks/whop`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: rawBody,
  });
  assert.equal(res.status, 200);

  const [latest] = webhookEvents.listRecentEvents("whop", 1);
  assert.equal(latest.verified, 1);
  assert.equal(latest.needs_review, 0);
  assert.ok(latest.client_id);

  const client = clientsDb.getClientById(latest.client_id);
  assert.equal(client.billing_status, "active");
  assert.equal(client.whop_membership_id, "mem_new");

  const users = clientsDb.getClientUsers(client.id);
  assert.equal(users.length, 0); // no portal login yet — just an invite
  const invites = clientsDb.listPendingInvites(client.id);
  assert.equal(invites.length, 1);
  assert.equal(invites[0].email, "nobody-registered@example.com");
});

test("POST /webhooks/whop flags a verified-but-unmatched non-active event for review", async () => {
  const { rawBody, headers } = sign({
    event: "payment.cancelled",
    data: { email: "no-such-client@example.com" },
  });

  const res = await fetch(`${ctx.baseUrl}/webhooks/whop`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: rawBody,
  });
  assert.equal(res.status, 200);

  const [latest] = webhookEvents.listRecentEvents("whop", 1);
  assert.equal(latest.verified, 1);
  assert.equal(latest.needs_review, 1);
  assert.equal(latest.client_id, null);
});

test("admin can manually override billing status and set a checkout link", async () => {
  const client = clientsDb.createClient({ name: "Manual Billing Co" });
  const detailPage = await fetch(`${ctx.baseUrl}/admin/clients/${client.id}`, { headers: { Cookie: adminCookie } });
  const csrf = extractCsrf(await detailPage.text());

  const post = (path, fields) =>
    fetch(`${ctx.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: adminCookie },
      body: new URLSearchParams({ ...fields, _csrf: csrf }),
      redirect: "manual",
    });

  const statusRes = await post(`/admin/clients/${client.id}/billing/status`, { status: "active" });
  assert.equal(statusRes.status, 302);
  assert.equal(clientsDb.getClientById(client.id).billing_status, "active");

  const urlRes = await post(`/admin/clients/${client.id}/billing/checkout-url`, {
    url: "https://whop.com/checkout/plan_test123",
  });
  assert.equal(urlRes.status, 302);
  assert.equal(clientsDb.getClientById(client.id).whop_checkout_url, "https://whop.com/checkout/plan_test123");
});
