#!/usr/bin/env node
// Seeds one demo client so you can see the Phase 2 client portal working
// end to end. Safe to re-run — skips creating the client if it already
// exists, but always makes sure the demo login works.
//
// Usage: npm run seed:portal -- [email] [password]

require("dotenv").config({ quiet: true });

const { getDb, closeDb } = require("../db");
const portal = require("../lib/portal");
const bcrypt = require("bcryptjs");

const email = process.argv[2] || "demo@brandloop.example";
const password = process.argv[3] || "demo-password-change-me";

function main() {
  const db = getDb();

  let client = db.prepare("SELECT * FROM clients WHERE slug = ?").get("brandloop");
  if (!client) {
    client = portal.createClient({ name: "Brandloop", slug: "brandloop" });
    console.log(`[seed] created client "${client.name}" (id ${client.id})`);
  }

  const existingUser = db.prepare("SELECT * FROM client_users WHERE email = ? COLLATE NOCASE").get(email);
  if (existingUser) {
    db.prepare("UPDATE client_users SET password_hash = ? WHERE id = ?").run(
      bcrypt.hashSync(password, 10),
      existingUser.id
    );
    console.log(`[seed] reset password for existing user ${email}`);
  } else {
    portal.createClientUser({ clientId: client.id, email, password });
    console.log(`[seed] created client user ${email}`);
  }

  seedExperiments(db, client.id);
  seedMetrics(db, client.id);

  console.log("\nDemo portal login:");
  console.log(`  URL:      http://localhost:${process.env.PORT || 3000}/portal/login`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);

  closeDb();
}

function seedExperiments(db, clientId) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM experiments WHERE client_id = ?").get(clientId).n;
  if (existing > 0) return;

  const insert = db.prepare(`
    INSERT INTO experiments (client_id, name, channel, status, lift_pct, started_at, ended_at)
    VALUES (@client_id, @name, @channel, @status, @lift_pct, @started_at, @ended_at)
  `);

  const rows = [
    { name: "Checkout: single-page vs. 3-step", channel: "cro", status: "won", lift_pct: 12.4, days_ago_start: 60, days_ago_end: 46 },
    { name: "PDP hero: video vs. static", channel: "creative", status: "won", lift_pct: 6.1, days_ago_start: 45, days_ago_end: 31 },
    { name: "Meta: broad vs. LAA targeting", channel: "paid-media", status: "lost", lift_pct: -3.2, days_ago_start: 30, days_ago_end: 16 },
    { name: "Sticky add-to-cart on mobile", channel: "cro", status: "running", lift_pct: null, days_ago_start: 14, days_ago_end: null },
    { name: "Google PMax budget reallocation", channel: "paid-media", status: "running", lift_pct: null, days_ago_start: 7, days_ago_end: null },
  ];

  const now = Date.now();
  const insertMany = db.transaction((items) => {
    for (const r of items) {
      insert.run({
        client_id: clientId,
        name: r.name,
        channel: r.channel,
        status: r.status,
        lift_pct: r.lift_pct,
        started_at: new Date(now - r.days_ago_start * 86400000).toISOString(),
        ended_at: r.days_ago_end != null ? new Date(now - r.days_ago_end * 86400000).toISOString() : null,
      });
    }
  });
  insertMany(rows);
  console.log(`[seed] inserted ${rows.length} experiments`);
}

function seedMetrics(db, clientId) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM metrics_snapshots WHERE client_id = ?").get(clientId).n;
  if (existing > 0) return;

  const insert = db.prepare(`
    INSERT INTO metrics_snapshots (client_id, date, roas, ad_spend, revenue)
    VALUES (@client_id, @date, @roas, @ad_spend, @revenue)
  `);

  const days = 90;
  const startRoas = 1.6;
  const endRoas = 3.8;
  const now = Date.now();

  const insertMany = db.transaction(() => {
    for (let i = 0; i < days; i++) {
      const progress = i / (days - 1);
      const noise = (Math.sin(i * 1.7) + Math.sin(i * 0.4)) * 0.06;
      const roas = Math.max(0.8, startRoas + (endRoas - startRoas) * progress + noise);
      const adSpend = 1800 + Math.round(Math.sin(i * 0.3) * 200 + i * 4);
      const revenue = Math.round(adSpend * roas);
      const date = new Date(now - (days - 1 - i) * 86400000).toISOString().slice(0, 10);

      insert.run({ client_id: clientId, date, roas, ad_spend: adSpend, revenue });
    }
  });
  insertMany();
  console.log(`[seed] inserted ${days} metrics snapshots`);
}

main();
