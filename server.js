// Ampcurve landing page server
//
// Serves the static site in /public and provides a small JSON API for
// capturing waitlist signups to a local JSON file (data/waitlist.json).
// No external services or API keys required to run this out of the box.

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "waitlist.json");
const ADMIN_KEY = process.env.ADMIN_KEY || ""; // set this to protect the export endpoint

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---- storage helpers -------------------------------------------------

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

function readEntries() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeEntries(entries) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- routes ------------------------------------------------------------

app.post("/api/waitlist", (req, res) => {
  const body = req.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  const priority = String(body.priority || "").slice(0, 60);
  const source = String(body.source || "").slice(0, 120);
  const utm = String(body.utm || "").slice(0, 200);
  const honeypot = String(body.company_website || "").trim();

  // Bots that fill hidden fields get a fake success, no storage.
  if (honeypot) {
    return res.status(200).json({ ok: true, position: 1 });
  }

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const entries = readEntries();

  const existing = entries.find((e) => e.email === email);
  if (existing) {
    return res.status(409).json({ error: "Already on the waitlist." });
  }

  const entry = {
    email,
    priority: priority || null,
    source: source || null,
    utm: utm || null,
    createdAt: new Date().toISOString(),
  };

  entries.push(entry);
  writeEntries(entries);

  return res.status(201).json({ ok: true, position: entries.length });
});

// Simple protected export for the founder to see signups.
// Usage: GET /api/admin/export?key=YOUR_ADMIN_KEY
app.get("/api/admin/export", (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized. Set ADMIN_KEY and pass ?key=..." });
  }

  const entries = readEntries();
  const format = req.query.format === "csv" ? "csv" : "json";

  if (format === "csv") {
    const header = "email,priority,source,utm,createdAt\n";
    const rows = entries
      .map((e) =>
        [e.email, e.priority, e.source, e.utm, e.createdAt]
          .map((v) => `"${String(v || "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=waitlist.csv");
    return res.send(header + rows);
  }

  return res.json({ count: entries.length, entries });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Ampcurve landing page running at http://localhost:${PORT}`);
});
