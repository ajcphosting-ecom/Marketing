const { html } = require("../../lib/html");
const { layout } = require("../layout");
const { ADMIN_NAV } = require("./nav");

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function prettyJson(raw) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function webhooksPage({ events }) {
  const body = html`
    <h1>Webhooks</h1>
    <p class="subtitle">
      Raw log of everything received at <span class="mono">/webhooks/whop</span> — the safety net for
      confirming Whop's real event names/fields, since that couldn't be verified against live docs while
      building this (see README "Billing (Whop)").
    </p>

    <div class="panel">
      <div class="panel-head"><h2>Recent deliveries (${events.length})</h2></div>
      ${events.length === 0
        ? html`<div class="empty">Nothing received yet. Configure the webhook in your Whop dashboard to point at <span class="mono">/webhooks/whop</span>.</div>`
        : events.map(
            (e) => html`
              <details style="border-top:1px solid var(--line); padding:14px 20px;">
                <summary style="cursor:pointer; display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                  <span class="mono muted" style="font-size:0.76rem;">${fmtDateTime(e.received_at)}</span>
                  <strong>${e.event_type || "(unparseable body)"}</strong>
                  <span class="chip ${e.verified ? "chip-won" : "chip-lost"}">${e.verified ? "verified" : "unverified"}</span>
                  ${e.needs_review ? html`<span class="chip chip-running">needs review</span>` : ""}
                  ${e.client_name ? html`<span class="muted">→ ${e.client_name}</span>` : ""}
                </summary>
                <pre style="margin-top:12px; padding:12px; background:var(--ink-soft); border-radius:8px; overflow-x:auto; font-size:0.78rem; font-family:var(--font-mono);">${prettyJson(e.payload)}</pre>
              </details>
            `
          )}
    </div>
  `;

  return layout({
    title: "Webhooks",
    tag: "Admin",
    nav: ADMIN_NAV,
    activePath: "/admin/webhooks",
    body,
  });
}

module.exports = { webhooksPage };
