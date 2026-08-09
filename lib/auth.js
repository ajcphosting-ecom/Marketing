// Session handling + credential checks for both the admin dashboard and the
// client portal. Sessions are stored entirely in a signed, httpOnly cookie
// (via cookie-session) — no server-side session store to run or lose on
// restart, which is the right tradeoff for a single small Node process.

const cookieSession = require("cookie-session");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

function configureSession(app) {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET must be set in production. Generate one with:\n" +
          "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    console.warn(
      "[auth] SESSION_SECRET not set — using an insecure dev-only default. " +
        "Set SESSION_SECRET before deploying."
    );
  }

  app.use(
    cookieSession({
      name: "ampcurve.sid",
      secret: secret || "dev-only-insecure-secret-do-not-use-in-production",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
    })
  );
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) {
    // Still run a compare of equal length to avoid a length-based timing leak.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * The admin account is a single credential pair from the environment, not a
 * database row — appropriate for a one-founder admin dashboard. Password is
 * stored as a bcrypt hash (ADMIN_PASSWORD_HASH); generate one with
 * `npm run hash-password`.
 */
function verifyAdminCredentials(email, password) {
  const expectedEmail = process.env.ADMIN_EMAIL || "";
  const expectedHash = process.env.ADMIN_PASSWORD_HASH || "";

  if (!expectedEmail || !expectedHash) return false;
  if (!timingSafeEqual(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase())) {
    return false;
  }

  try {
    return bcrypt.compareSync(password, expectedHash);
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.redirect(`/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
}

function requireClient(req, res, next) {
  if (req.session && req.session.clientUserId) return next();
  return res.redirect(`/portal/login?next=${encodeURIComponent(req.originalUrl)}`);
}

module.exports = {
  configureSession,
  verifyAdminCredentials,
  requireAdmin,
  requireClient,
  timingSafeEqual,
};
