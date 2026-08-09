const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("./helpers");
const waitlistDb = require("../lib/waitlist");

let ctx;

before(async () => {
  ctx = await startServer();
});

after(async () => {
  await ctx.close();
});

test("rejects an invalid email", async () => {
  const res = await fetch(`${ctx.baseUrl}/api/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email" }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /valid email/i);
});

test("accepts a valid signup and returns its position", async () => {
  const res = await fetch(`${ctx.baseUrl}/api/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "first@example.com", priority: "paid-media" }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.position, 1);

  const stored = waitlistDb.findByEmail("first@example.com");
  assert.ok(stored, "signup should be persisted");
  assert.equal(stored.priority, "paid-media");
});

test("rejects a duplicate email (case-insensitive)", async () => {
  const res = await fetch(`${ctx.baseUrl}/api/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "First@Example.com" }),
  });
  assert.equal(res.status, 409);
});

test("silently accepts but drops honeypot-filled submissions", async () => {
  const before = waitlistDb.count();
  const res = await fetch(`${ctx.baseUrl}/api/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bot@example.com", company_website: "https://spam.example" }),
  });
  assert.equal(res.status, 200);
  assert.equal(waitlistDb.count(), before, "bot submission must not be stored");
  assert.equal(waitlistDb.findByEmail("bot@example.com"), undefined);
});

test("rate-limits repeated signups from the same client", async () => {
  const attempts = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      fetch(`${ctx.baseUrl}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `flood${i}@example.com` }),
      })
    )
  );
  const statuses = attempts.map((r) => r.status);
  assert.ok(statuses.includes(429), `expected at least one 429, got: ${statuses.join(",")}`);
});

test("/api/health reports the database is reachable", async () => {
  const res = await fetch(`${ctx.baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});
