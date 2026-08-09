const express = require("express");
const rateLimit = require("express-rate-limit");

const waitlist = require("../waitlist");
const clients = require("../clients");
const email = require("../email");
const { verifyAdminCredentials, requireAdmin } = require("../auth");
const { ensureCsrfToken, verifyCsrf } = require("../csrf");
const { adminLoginPage } = require("../../views/admin/login");
const { adminDashboardPage } = require("../../views/admin/dashboard");
const { clientsListPage } = require("../../views/admin/clients-list");
const { clientDetailPage } = require("../../views/admin/client-detail");

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

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

// ---- client management -----------------------------------------------------

router.get("/clients", (req, res) => {
  const csrfToken = ensureCsrfToken(req);
  res.send(
    clientsListPage({ clients: clients.listClients(), csrfToken, flash: req.query.flash || null, error: null })
      .value
  );
});

router.post("/clients", express.urlencoded({ extended: false }), verifyCsrf, (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 120);
  if (!name) return res.redirect("/admin/clients");
  const client = clients.createClient({ name });
  res.redirect(`/admin/clients/${client.id}?flash=` + encodeURIComponent("Client created."));
});

router.get("/clients/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const client = clients.getClientById(id);
  if (!client) return res.status(404).send("Client not found.");

  const csrfToken = ensureCsrfToken(req);
  res.send(
    clientDetailPage({
      client,
      users: clients.getClientUsers(id),
      invites: clients.listPendingInvites(id),
      experiments: clients.getExperiments(id),
      metrics: clients.getRecentMetrics(id, 14),
      integrations: clients.listIntegrationStatuses(id),
      csrfToken,
      flash: req.query.flash || null,
      appBaseUrl: APP_BASE_URL,
    }).value
  );
});

router.post(
  "/clients/:id/invites",
  express.urlencoded({ extended: false }),
  verifyCsrf,
  (req, res) => {
    const id = parseInt(req.params.id, 10);
    const client = clients.getClientById(id);
    if (!client) return res.status(404).send("Client not found.");

    const emailAddr = String(req.body.email || "").trim().toLowerCase();
    if (!emailAddr) return res.redirect(`/admin/clients/${id}`);

    const { token } = clients.createInvite(id, emailAddr);
    const url = `${APP_BASE_URL}/portal/accept-invite?token=${token}`;
    email
      .sendClientInvite({ email: emailAddr, clientName: client.name, url })
      .catch((err) => console.error("[email] invite send failed:", err.message));

    res.redirect(`/admin/clients/${id}?flash=` + encodeURIComponent(`Invite sent to ${emailAddr}.`));
  }
);

router.post(
  "/clients/:id/experiments",
  express.urlencoded({ extended: false }),
  verifyCsrf,
  (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!clients.getClientById(id)) return res.status(404).send("Client not found.");

    const name = String(req.body.name || "").trim().slice(0, 160);
    const channel = ["cro", "paid-media", "creative"].includes(req.body.channel) ? req.body.channel : "cro";
    if (name) {
      clients.addExperiment(id, { name, channel, status: "running", liftPct: null, startedAt: new Date().toISOString() });
    }
    res.redirect(`/admin/clients/${id}`);
  }
);

router.post(
  "/clients/:id/experiments/:expId",
  express.urlencoded({ extended: false }),
  verifyCsrf,
  (req, res) => {
    const id = parseInt(req.params.id, 10);
    const expId = parseInt(req.params.expId, 10);
    const status = ["running", "won", "lost", "paused"].includes(req.body.status) ? req.body.status : "running";
    const liftPct = req.body.liftPct === "" || req.body.liftPct == null ? null : Number(req.body.liftPct);
    const endedAt = status === "running" ? null : new Date().toISOString();

    clients.updateExperiment(expId, { status, liftPct, endedAt });
    res.redirect(`/admin/clients/${id}?flash=` + encodeURIComponent("Experiment updated."));
  }
);

router.post(
  "/clients/:id/metrics",
  express.urlencoded({ extended: false }),
  verifyCsrf,
  (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!clients.getClientById(id)) return res.status(404).send("Client not found.");

    const date = String(req.body.date || "").slice(0, 10);
    const adSpend = Number(req.body.adSpend);
    const revenue = Number(req.body.revenue);

    if (date && Number.isFinite(adSpend) && Number.isFinite(revenue) && adSpend >= 0 && revenue >= 0) {
      clients.upsertMetric(id, { date, adSpend, revenue, source: "manual" });
    }
    res.redirect(`/admin/clients/${id}?flash=` + encodeURIComponent("Saved."));
  }
);

router.post(
  "/clients/:id/integrations/:provider",
  express.urlencoded({ extended: false }),
  verifyCsrf,
  (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { provider } = req.params;
    const { _csrf, ...fields } = req.body;

    try {
      clients.saveIntegrationCredentials(id, provider, fields);
      res.redirect(`/admin/clients/${id}?flash=` + encodeURIComponent("Credentials saved."));
    } catch (err) {
      res.redirect(`/admin/clients/${id}?flash=` + encodeURIComponent(err.message));
    }
  }
);

router.post(
  "/clients/:id/integrations/:provider/sync",
  express.urlencoded({ extended: false }),
  verifyCsrf,
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { provider } = req.params;

    try {
      const result = await clients.syncIntegration(id, provider);
      const msg = result.ok ? `Synced ${result.count} day(s).` : result.error;
      res.redirect(`/admin/clients/${id}?flash=` + encodeURIComponent(msg));
    } catch (err) {
      res.redirect(`/admin/clients/${id}?flash=` + encodeURIComponent(err.message));
    }
  }
);

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
