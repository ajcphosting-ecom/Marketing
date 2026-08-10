const { html } = require("../../lib/html");
const { layout } = require("../layout");
const { sparklineSvg } = require("../../lib/chart");

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusChip(status) {
  return html`<span class="chip chip-${status}">${status}</span>`;
}

function portalDashboardPage({ clientName, metrics, experiments, csrfToken }) {
  const latest = metrics[metrics.length - 1];
  const first = metrics[0];
  const roasSeries = metrics.map((m) => m.roas);
  const deltaPct = first && latest ? Math.round(((latest.roas - first.roas) / first.roas) * 100) : 0;

  const body = html`
    <div class="flash-box" style="background:rgba(240,166,60,0.1); border-color:rgba(240,166,60,0.3); color:#f0a63c;">
      <strong>Phase 2 foundation.</strong> This portal is wired to a real database and real login —
      the numbers below are seeded demo data for ${clientName}, not a live ad account feed yet.
    </div>

    <h1>${clientName}</h1>
    <p class="subtitle">Blended performance across active tests and paid channels.</p>

    <div class="stat-grid">
      <div class="stat-tile">
        <div class="label">Blended ROAS</div>
        <div class="value">${latest ? latest.roas.toFixed(1) + "x" : "—"}</div>
      </div>
      <div class="stat-tile">
        <div class="label">90-day change</div>
        <div class="value" style="color:${deltaPct >= 0 ? "#6fcf97" : "#e07a6a"};">${deltaPct >= 0 ? "+" : ""}${deltaPct}%</div>
      </div>
      <div class="stat-tile">
        <div class="label">Ad spend (latest day)</div>
        <div class="value">$${latest ? Math.round(latest.ad_spend).toLocaleString() : "—"}</div>
      </div>
      <div class="stat-tile">
        <div class="label">Revenue (latest day)</div>
        <div class="value">$${latest ? Math.round(latest.revenue).toLocaleString() : "—"}</div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:24px;">
      <div class="panel-head"><h2>Blended ROAS, last ${metrics.length} days</h2></div>
      <div style="padding:20px;">
        ${metrics.length ? sparklineSvg(roasSeries) : html`<p class="muted">No metrics yet.</p>`}
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>Experiments (${experiments.length})</h2>
        <form method="POST" action="/portal/logout" class="inline">
          <input type="hidden" name="_csrf" value="${csrfToken}" />
          <button type="submit" class="btn btn-ghost btn-sm">Log out</button>
        </form>
      </div>
      ${experiments.length === 0
        ? html`<div class="empty">No experiments logged yet.</div>`
        : html`<table>
            <thead>
              <tr><th>Experiment</th><th>Channel</th><th>Status</th><th>Lift</th><th>Started</th></tr>
            </thead>
            <tbody>
              ${experiments.map(
                (e) => html`<tr>
                  <td class="email">${e.name}</td>
                  <td>${e.channel}</td>
                  <td>${statusChip(e.status)}</td>
                  <td>${e.lift_pct != null ? (e.lift_pct >= 0 ? "+" : "") + e.lift_pct + "%" : "—"}</td>
                  <td>${fmtDate(e.started_at)}</td>
                </tr>`
              )}
            </tbody>
          </table>`}
    </div>
  `;

  return layout({
    title: clientName,
    tag: "Client portal",
    nav: [{ label: "Dashboard", href: "/portal" }],
    activePath: "/portal",
    body,
  });
}

module.exports = { portalDashboardPage };
