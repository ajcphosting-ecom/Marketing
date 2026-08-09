const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, getCookie, extractCsrf, ADMIN_PASSWORD } = require("./helpers");

let ctx;

before(async () => {
  ctx = await startServer();
});

after(async () => {
  await ctx.close();
});

test("redirects unauthenticated /admin to the login page", async () => {
  const res = await fetch(`${ctx.baseUrl}/admin`, { redirect: "manual" });
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location"), /^\/admin\/login/);
});

test("rejects the wrong password", async () => {
  const loginPage = await fetch(`${ctx.baseUrl}/admin/login`);
  const cookie = getCookie(loginPage);
  const csrf = extractCsrf(await loginPage.text());
  assert.ok(csrf, "login page should embed a CSRF token");

  const res = await fetch(`${ctx.baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({ email: "admin@test.local", password: "wrong-password", _csrf: csrf }),
    redirect: "manual",
  });
  assert.equal(res.status, 401);
});

test("logs in with the right credentials and reaches the dashboard", async () => {
  const loginPage = await fetch(`${ctx.baseUrl}/admin/login`);
  const cookie = getCookie(loginPage);
  const csrf = extractCsrf(await loginPage.text());

  const loginRes = await fetch(`${ctx.baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({ email: "admin@test.local", password: ADMIN_PASSWORD, _csrf: csrf }),
    redirect: "manual",
  });
  assert.equal(loginRes.status, 302);
  assert.equal(loginRes.headers.get("location"), "/admin");

  const sessionCookie = getCookie(loginRes);
  const dashboard = await fetch(`${ctx.baseUrl}/admin`, { headers: { Cookie: sessionCookie } });
  assert.equal(dashboard.status, 200);
  const html = await dashboard.text();
  assert.match(html, /Waitlist/);
});

test("rejects a login POST with a missing/invalid CSRF token", async () => {
  const res = await fetch(`${ctx.baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: "admin@test.local", password: ADMIN_PASSWORD, _csrf: "bogus" }),
    redirect: "manual",
  });
  assert.equal(res.status, 403);
});
