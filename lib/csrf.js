// Minimal double-submit CSRF protection for the admin/portal forms.
// A per-session token is embedded as a hidden field in every form and
// checked against the session on POST. Not needed for the public
// /api/waitlist endpoint (no session/cookie auth there to forge).

const crypto = require("crypto");
const { timingSafeEqual } = require("./auth");

function ensureCsrfToken(req) {
  if (!req.session.csrf) {
    req.session.csrf = crypto.randomBytes(24).toString("hex");
  }
  return req.session.csrf;
}

function verifyCsrf(req, res, next) {
  const token = req.body && req.body._csrf;
  if (req.session && req.session.csrf && token && timingSafeEqual(token, req.session.csrf)) {
    return next();
  }
  return res.status(403).send("Invalid or missing CSRF token. Go back and try again.");
}

module.exports = { ensureCsrfToken, verifyCsrf };
