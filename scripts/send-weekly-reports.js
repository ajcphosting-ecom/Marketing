#!/usr/bin/env node
// Runs the weekly AI report job once, right now — for testing, a manual
// resend, or if you'd rather trigger this from external cron/CI than rely
// on the in-process scheduler (see README "AI automation").
//
// Usage: npm run send-weekly-reports

require("dotenv").config({ quiet: true });

const ai = require("../lib/ai");
const { runWeeklyReports } = require("../lib/reports");
const { closeDb } = require("../db");

async function main() {
  if (!ai.isConfigured()) {
    console.error("ANTHROPIC_API_KEY is not set — see README \"AI automation\" for setup.");
    process.exit(1);
  }

  console.log("Running weekly reports for all clients…");
  const results = await runWeeklyReports();

  for (const r of results) {
    console.log(`  ${r.clientName} (#${r.clientId}): ${r.status}${r.error ? " — " + r.error : ""}`);
  }

  closeDb();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
