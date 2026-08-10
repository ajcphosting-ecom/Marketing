// In-process weekly job for AI client reports — no external cron needed.
// Runs only while the server process is alive; on a host that sleeps the
// app (serverless), use `npm run send-weekly-reports` on an external
// schedule instead (see README "AI automation").

const cron = require("node-cron");
const ai = require("./ai");
const { runWeeklyReports } = require("./reports");

function start() {
  if (!ai.isConfigured()) {
    console.warn(
      "[scheduler] ANTHROPIC_API_KEY not set — weekly AI reports won't run. " +
        "Set it to enable them (see README \"AI automation\")."
    );
    return null;
  }

  // Default: every Monday at 08:00 in the configured timezone.
  const schedule = process.env.REPORTS_CRON || "0 8 * * 1";
  const timezone = process.env.REPORTS_TIMEZONE || "UTC";

  if (!cron.validate(schedule)) {
    console.error(`[scheduler] REPORTS_CRON "${schedule}" is not a valid cron expression — reports disabled.`);
    return null;
  }

  const task = cron.schedule(
    schedule,
    async () => {
      console.log("[scheduler] running weekly AI reports…");
      try {
        const results = await runWeeklyReports();
        const summary = results.map((r) => r.status).reduce((acc, s) => {
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {});
        console.log(`[scheduler] weekly reports done: ${JSON.stringify(summary)}`);
      } catch (err) {
        console.error("[scheduler] weekly reports run failed:", err.message);
      }
    },
    { timezone }
  );

  console.log(`[scheduler] weekly AI reports scheduled: "${schedule}" (${timezone})`);
  return task;
}

module.exports = { start };
