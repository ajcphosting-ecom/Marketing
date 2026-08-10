// Shared test setup: point the app at an isolated in-memory database and
// throwaway credentials before anything requires ../server (module-load
// order matters — db/index.js reads DB_PATH once, at require time).

const bcrypt = require("bcryptjs");

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DB_PATH = ":memory:";
process.env.SESSION_SECRET = "test-secret-not-for-production-aaaaaaaaaaaaaaaa";
process.env.ADMIN_EMAIL = "admin@test.local";

const ADMIN_PASSWORD = "test-admin-password-123";
// Low bcrypt cost factor — this hash only ever needs to survive a test run.
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 4);

const app = require("../server");

/** Starts the app on an ephemeral port and returns {baseUrl, close}. */
function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

function getCookie(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")];
  return raw.filter(Boolean).map((c) => c.split(";")[0]).join("; ");
}

function extractCsrf(html) {
  const m = html.match(/name="_csrf" value="([^"]*)"/);
  return m ? m[1] : null;
}

/** Logs in as the test admin account, returns a session cookie string. */
async function adminLogin(baseUrl) {
  const loginPage = await fetch(`${baseUrl}/admin/login`);
  const cookie = getCookie(loginPage);
  const csrf = extractCsrf(await loginPage.text());

  const res = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({ email: "admin@test.local", password: ADMIN_PASSWORD, _csrf: csrf }),
    redirect: "manual",
  });
  return getCookie(res);
}

module.exports = { app, startServer, getCookie, extractCsrf, adminLogin, ADMIN_PASSWORD };
