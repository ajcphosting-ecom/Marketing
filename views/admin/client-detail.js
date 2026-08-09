const { html } = require("../../lib/html");
const { layout } = require("../layout");
const { ADMIN_NAV } = require("./nav");

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusChip(status) {
  return html`<span class="chip chip-${status}">${status}</span>`;
}

function integrationChip(status) {
  const map = { not_connected: "paused", configured: "won", error: "lost" };
  const label = { not_connected: "not connected", configured: "configured", error: "error" }[status];
  return html`<span class="chip chip-${map[status] || "paused"}">${label}</span>`;
}

function usersAndInvites({ client, users, invites, csrfToken, appBaseUrl }) {
  return html`
    <div class="panel" style="margin-bottom:24px;">
      <div class="panel-head"><h2>Users &amp; invites</h2></div>

      ${users.length
        ? html`<table>
            <thead><tr><th>Email</th><th>Joined</th></tr></thead>
            <tbody>
              ${users.map((u) => html`<tr><td class="email">${u.email}</td><td>${fmtDate(u.created_at)}</td></tr>`)}
            </tbody>
          </table>`
        : html`<div class="empty">No portal users yet.</div>`}

      ${invites.length
        ? html`<div style="padding:16px 20px; border-top:1px solid var(--line);">
            <div class="muted" style="margin-bottom:10px;">Pending invites</div>
            ${invites.map(
              (inv) => html`<div style="margin-bottom:10px; font-size:0.85rem;">
                <div style="color:var(--paper-dim);">${inv.email} — expires ${fmtDate(inv.expires_at)}</div>
                <input type="text" readonly value="${appBaseUrl}/portal/accept-invite?token=${inv.token}"
                  style="width:100%; margin-top:4px; font-family:var(--font-mono); font-size:0.76rem;"
                  onclick="this.select()" />
              </div>`
            )}
          </div>`
        : ""}

      <form method="POST" action="/admin/clients/${client.id}/invites"
        style="padding:16px 20px; border-top:1px solid var(--line); display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
        <input type="hidden" name="_csrf" value="${csrfToken}" />
        <div class="field" style="margin-bottom:0; flex:1 1 220px;">
          <label for="invite-email">Invite a user</label>
          <input type="email" id="invite-email" name="email" placeholder="client@company.com" required style="width:100%;" />
        </div>
        <button type="submit" class="btn btn-sm">Send invite</button>
      </form>
    </div>
  `;
}

function experimentsPanel({ client, experiments, csrfToken }) {
  return html`
    <div class="panel" style="margin-bottom:24px;">
      <div class="panel-head"><h2>Experiments (${experiments.length})</h2></div>

      ${experiments.length === 0
        ? html`<div class="empty">No experiments logged yet.</div>`
        : html`<table>
            <thead><tr><th>Name</th><th>Channel</th><th>Update</th></tr></thead>
            <tbody>
              ${experiments.map(
                (e) => html`<tr>
                  <td class="email">${e.name}<div class="muted">started ${fmtDate(e.started_at)}</div></td>
                  <td>${e.channel}</td>
                  <td>
                    <form method="POST" action="/admin/clients/${client.id}/experiments/${e.id}"
                      style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                      <input type="hidden" name="_csrf" value="${csrfToken}" />
                      <select name="status" style="padding:6px 8px; font-size:0.78rem;">
                        ${["running", "won", "lost", "paused"].map(
                          (s) => html`<option value="${s}" ${e.status === s ? "selected" : ""}>${s}</option>`
                        )}
                      </select>
                      <input type="number" step="0.1" name="liftPct" value="${e.lift_pct ?? ""}" placeholder="lift %"
                        style="width:80px; padding:6px 8px; font-size:0.78rem;" />
                      <button type="submit" class="btn btn-ghost btn-sm">Save</button>
                    </form>
                  </td>
                </tr>`
              )}
            </tbody>
          </table>`}

      <form method="POST" action="/admin/clients/${client.id}/experiments"
        style="padding:16px 20px; border-top:1px solid var(--line); display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
        <input type="hidden" name="_csrf" value="${csrfToken}" />
        <div class="field" style="margin-bottom:0; flex:1 1 200px;">
          <label for="exp-name">New experiment</label>
          <input type="text" id="exp-name" name="name" placeholder="e.g. Checkout redesign" required style="width:100%;" />
        </div>
        <div class="field" style="margin-bottom:0;">
          <label for="exp-channel">Channel</label>
          <select id="exp-channel" name="channel">
            <option value="cro">CRO</option>
            <option value="paid-media">Paid media</option>
            <option value="creative">Creative</option>
          </select>
        </div>
        <button type="submit" class="btn btn-sm">Add experiment</button>
      </form>
    </div>
  `;
}

function metricsPanel({ client, metrics, csrfToken }) {
  const today = new Date().toISOString().slice(0, 10);
  return html`
    <div class="panel" style="margin-bottom:24px;">
      <div class="panel-head"><h2>Performance (manual entry)</h2></div>

      ${metrics.length === 0
        ? html`<div class="empty">No numbers entered yet.</div>`
        : html`<table>
            <thead><tr><th>Date</th><th>Ad spend</th><th>Revenue</th><th>ROAS</th><th>Source</th></tr></thead>
            <tbody>
              ${metrics.map(
                (m) => html`<tr>
                  <td class="email">${m.date}</td>
                  <td>$${Math.round(m.ad_spend).toLocaleString()}</td>
                  <td>$${Math.round(m.revenue).toLocaleString()}</td>
                  <td>${m.roas.toFixed(2)}x</td>
                  <td><span class="muted">${m.source}</span></td>
                </tr>`
              )}
            </tbody>
          </table>`}

      <form method="POST" action="/admin/clients/${client.id}/metrics"
        style="padding:16px 20px; border-top:1px solid var(--line); display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
        <input type="hidden" name="_csrf" value="${csrfToken}" />
        <div class="field" style="margin-bottom:0;">
          <label for="m-date">Date</label>
          <input type="date" id="m-date" name="date" value="${today}" required />
        </div>
        <div class="field" style="margin-bottom:0;">
          <label for="m-spend">Ad spend ($)</label>
          <input type="number" step="0.01" min="0" id="m-spend" name="adSpend" required style="width:120px;" />
        </div>
        <div class="field" style="margin-bottom:0;">
          <label for="m-revenue">Revenue ($)</label>
          <input type="number" step="0.01" min="0" id="m-revenue" name="revenue" required style="width:120px;" />
        </div>
        <button type="submit" class="btn btn-sm">Save day</button>
      </form>
      <p class="muted" style="padding:0 20px 16px;">ROAS is calculated automatically (revenue ÷ spend). Saving an existing date overwrites it.</p>
    </div>
  `;
}

function integrationsPanel({ client, integrations, csrfToken }) {
  return html`
    <div class="panel">
      <div class="panel-head"><h2>Integrations</h2></div>
      <div class="muted" style="padding:14px 20px 0;">
        None of these are live yet — connecting one saves credentials (encrypted) and lets you try a sync,
        which will currently report "not implemented" until a real API call is wired up. See README.
      </div>
      ${integrations.map(
        (i) => html`
          <div style="padding:16px 20px; border-top:1px solid var(--line);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <strong>${i.label}</strong>
              ${integrationChip(i.status)}
            </div>
            <div class="muted" style="margin-bottom:12px;">${i.docsHint}</div>
            ${i.lastError ? html`<div class="error-box" style="font-size:0.78rem;">${i.lastError}</div>` : ""}

            <form method="POST" action="/admin/clients/${client.id}/integrations/${i.key}"
              style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:10px;">
              <input type="hidden" name="_csrf" value="${csrfToken}" />
              ${i.fields.map(
                (f) => html`<div class="field" style="margin-bottom:0; flex:1 1 200px;">
                  <label>${f.label}</label>
                  ${f.textarea
                    ? html`<textarea name="${f.name}" rows="2" style="width:100%; background:var(--ink-soft); border:1px solid var(--line); color:var(--paper); border-radius:7px; padding:9px 12px; font-size:0.85rem; font-family:var(--font-mono);"></textarea>`
                    : html`<input type="${f.secret ? "password" : "text"}" name="${f.name}" placeholder="${f.placeholder || ""}" style="width:100%;" />`}
                </div>`
              )}
              <button type="submit" class="btn btn-ghost btn-sm">Save credentials</button>
            </form>

            ${i.status !== "not_connected"
              ? html`<form method="POST" action="/admin/clients/${client.id}/integrations/${i.key}/sync" class="inline">
                  <input type="hidden" name="_csrf" value="${csrfToken}" />
                  <button type="submit" class="btn btn-ghost btn-sm">Sync now</button>
                </form>
                ${i.lastSyncedAt ? html`<span class="muted" style="margin-left:8px;">last synced ${fmtDateTime(i.lastSyncedAt)}</span>` : ""}`
              : ""}
          </div>
        `
      )}
    </div>
  `;
}

function clientDetailPage({ client, users, invites, experiments, metrics, integrations, csrfToken, flash, appBaseUrl }) {
  const body = html`
    <a href="/admin/clients" class="muted" style="text-decoration:none;">← All clients</a>
    <h1 style="margin-top:10px;">${client.name}</h1>
    <p class="subtitle">${client.slug}</p>

    ${flash ? html`<div class="flash-box">${flash}</div>` : ""}

    ${usersAndInvites({ client, users, invites, csrfToken, appBaseUrl })}
    ${experimentsPanel({ client, experiments, csrfToken })}
    ${metricsPanel({ client, metrics, csrfToken })}
    ${integrationsPanel({ client, integrations, csrfToken })}
  `;

  return layout({
    title: client.name,
    tag: "Admin",
    nav: ADMIN_NAV,
    activePath: "/admin/clients",
    body,
  });
}

module.exports = { clientDetailPage };
