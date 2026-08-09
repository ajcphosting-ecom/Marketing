// Ampcurve — production backend
//
// Serves the static landing page, the /api/waitlist signup endpoint (backed
// by SQLite, with email notifications), the session-protected admin
// dashboard, and the Phase 2 client portal foundation.

require("dotenv").config({ quiet: true });

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const { getDb, closeDb } = require("./db");
const waitlist = require("./lib/waitlist");
const email = require("./lib/email");
const { configureSession } = require("./lib/auth");
const adminRouter = require("./lib/routes/admin");
const portalRouter = require("./lib/routes/portal");

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the first proxy hop (nginx/Caddy/load balancer) so rate limiting
// and secure cookies see the real client IP / protocol instead of the proxy's.
app.set("trust proxy", 1);

app.use(
  helmet({
    // The public page draws its own inline SVG hero chart and uses inline
    // <style> in the server-rendered admin/portal pages — a strict default
    // CSP would break both, so this keeps helmet's other protections
    // (HSTS, no-sniff, frameguard, etc.) without fighting our own pages.
    contentSecurityPolicy: false,
  })
);
app.use(express.json({ limit: "10kb" }));
configureSession(app);

app.use(express.static(path.join(__dirname, "public")));

// ---- public waitlist API ------------------------------------------------

const waitlistLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signups from this connection. Please try again later." },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/waitlist", waitlistLimiter, async (req, res) => {
  const body = req.body || {};
  const emailAddr = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const priority = String(body.priority || "").slice(0, 60);
  const source = String(body.source || "").slice(0, 120);
  const utm = String(body.utm || "").slice(0, 200);
  const honeypot = String(body.company_website || "").trim();

  // Bots that fill the hidden field get a fake success, nothing is stored.
  if (honeypot) {
    return res.status(200).json({ ok: true, position: 1 });
  }

  if (!emailAddr || !EMAIL_RE.test(emailAddr)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  if (waitlist.findByEmail(emailAddr)) {
    return res.status(409).json({ error: "Already on the waitlist." });
  }

  const entry = waitlist.insert({ email: emailAddr, priority, source, utm });
  const position = waitlist.count();

  // Fire-and-forget: don't make the signup wait on outbound email.
  email.sendWaitlistWelcome({ email: emailAddr, position }).catch((err) => {
    console.error("[email] welcome send failed:", err.message);
  });
  email.sendAdminNewSignupNotice({ email: emailAddr, priority, position }).catch((err) => {
    console.error("[email] admin notice failed:", err.message);
  });

  return res.status(201).json({ ok: true, position, id: entry.id });
});

app.get("/api/health", (req, res) => {
  try {
    getDb().prepare("SELECT 1").get();
    res.json({ ok: true, db: "ok" });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

// ---- admin dashboard + client portal ------------------------------------

app.use("/admin", adminRouter);
app.use("/portal", portalRouter);

// ---- boot ------------------------------------------------------------------

// Touch the DB whenever this module loads (including under test) so
// migration errors surface immediately instead of on the first request.
getDb();

// Only actually bind a port when run directly (`node server.js`). Test
// files `require("../server")` and start their own ephemeral listener via
// `app.listen(0)`, so importing this module must be side-effect-free.
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Ampcurve running at http://localhost:${PORT}`);
    console.log(`  Admin:  http://localhost:${PORT}/admin/login`);
    console.log(`  Portal: http://localhost:${PORT}/portal/login`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down…`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    // Force-exit if connections don't drain in time.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = app;
