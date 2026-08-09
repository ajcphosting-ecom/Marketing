const express = require("express");
const rateLimit = require("express-rate-limit");

const waitlist = require("../waitlist");
const { verifyAdminCredentials, requireAdmin } = require("../auth");
const { ensureCsrfToken, verifyCsrf } = require("../csrf");
const { adminLoginPage } = require("../../views/admin/login");
const { adminDashboardPage } = require("../../views/admin/dashboard");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

router.get("/login", (req, res) => {
  if (req.session.admin) return res.redirect("/admin");
  const csrfToken = ensureCsrfToken(req);
  res.send(adminLoginPage({ error: null, next: req.query.next, csrfToken }).value);
});

router.post("/login", loginLimiter, express.urlencoded({ extended: false }), (req, res) => {
  const { email = "", password = "", next = "" } = req.body;
  const csrfToken = ensureCsrfToken(req);

  if (!verifyCsrfBody(req)) {
    return res.status(403).send(adminLoginPage({ error: "Session expired, please try again.", next, csrfToken }).value);
  }

  if (!verifyAdminCredentials(email, password)) {
    return res
      .status(401)
      .send(adminLoginPage({ error: "Invalid email or password.", next, csrfToken }).value);
  }

  req.session.admin = true;
  const safeNext = next && next.startsWith("/admin") ? next : "/admin";
  res.redirect(safeNext);
});

router.post("/logout", express.urlencoded({ extended: false }), verifyCsrf, (req, res) => {
  req.session = null;
  res.redirect("/admin/login");
});

router.use(requireAdmin);

router.get("/", (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const status = ["new", "contacted", "converted", "unsubscribed"].includes(req.query.status)
    ? req.query.status
    : "";
  const search = (req.query.q || "").slice(0, 200);

  const list = waitlist.list({ page, pageSize: 25, status, search });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const stats = {
    total: waitlist.count(),
    today: waitlist.countSince(startOfToday),
    last7d: waitlist.countSince(sevenDaysAgo),
    contacted: waitlist.list({ page: 1, pageSize: 1, status: "contacted" }).total,
  };

  const csrfToken = ensureCsrfToken(req);
  const flash = req.query.flash || null;

  res.send(
    adminDashboardPage({
      stats,
      list,
      filters: { status, search },
      csrfToken,
      flash,
    }).value
  );
});

router.post(
  "/leads/:id/contacted",
  express.urlencoded({ extended: false }),
  verifyCsrf,
  (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isInteger(id)) waitlist.markContacted(id);
    res.redirect("/admin?flash=" + encodeURIComponent("Marked as contacted."));
  }
);

router.get("/export.csv", (req, res) => {
  const rows = waitlist.listAll();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=ampcurve-waitlist.csv");
  res.send(waitlist.toCsv(rows));
});

// verifyCsrf reads req.body, but the login route runs before body parsing
// in some setups — this local helper mirrors lib/csrf's check for the
// login POST, which already has express.urlencoded applied above it.
function verifyCsrfBody(req) {
  const { timingSafeEqual } = require("../auth");
  return Boolean(
    req.session && req.session.csrf && req.body._csrf && timingSafeEqual(req.body._csrf, req.session.csrf)
  );
}

module.exports = router;
