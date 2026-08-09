const express = require("express");
const rateLimit = require("express-rate-limit");

const portal = require("../portal");
const { requireClient, timingSafeEqual } = require("../auth");
const { ensureCsrfToken, verifyCsrf } = require("../csrf");
const { portalLoginPage } = require("../../views/portal/login");
const { portalDashboardPage } = require("../../views/portal/dashboard");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

router.get("/login", (req, res) => {
  if (req.session.clientUserId) return res.redirect("/portal");
  const csrfToken = ensureCsrfToken(req);
  res.send(portalLoginPage({ error: null, next: req.query.next, csrfToken }).value);
});

router.post("/login", loginLimiter, express.urlencoded({ extended: false }), (req, res) => {
  const { email = "", password = "", next = "" } = req.body;
  const csrfToken = ensureCsrfToken(req);

  const csrfOk = Boolean(
    req.session && req.session.csrf && req.body._csrf && timingSafeEqual(req.body._csrf, req.session.csrf)
  );
  if (!csrfOk) {
    return res.status(403).send(portalLoginPage({ error: "Session expired, please try again.", next, csrfToken }).value);
  }

  const user = portal.findUserByEmail(email);
  if (!user || !portal.verifyPassword(user, password)) {
    return res.status(401).send(portalLoginPage({ error: "Invalid email or password.", next, csrfToken }).value);
  }

  req.session.clientUserId = user.id;
  const safeNext = next && next.startsWith("/portal") ? next : "/portal";
  res.redirect(safeNext);
});

router.post("/logout", express.urlencoded({ extended: false }), verifyCsrf, (req, res) => {
  req.session = null;
  res.redirect("/portal/login");
});

router.use(requireClient);

router.get("/", (req, res) => {
  const user = portal.getUserById(req.session.clientUserId);
  if (!user) {
    req.session = null;
    return res.redirect("/portal/login");
  }

  const metrics = portal.getMetrics(user.client_id, 90);
  const experiments = portal.getExperiments(user.client_id);
  const csrfToken = ensureCsrfToken(req);

  res.send(
    portalDashboardPage({
      clientName: user.client_name,
      metrics,
      experiments,
      csrfToken,
    }).value
  );
});

module.exports = router;
