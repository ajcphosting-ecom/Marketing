const { html } = require("../../lib/html");
const { layout } = require("../layout");

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusChip(status) {
  return html`<span class="chip chip-${status}">${status}</span>`;
}

function adminDashboardPage({ stats, list, filters, csrfToken, flash }) {
  const { rows, total, page, pageCount } = list;

  const body = html`
    <h1>Waitlist</h1>
    <p class="subtitle">Everyone who's signed up for early access, newest first.</p>

    ${flash ? html`<div class="flash-box">${flash}</div>` : ""}

    <div class="stat-grid">
      <div class="stat-tile"><div class="label">Total signups</div><div class="value">${stats.total}</div></div>
      <div class="stat-tile"><div class="label">Today</div><div class="value">${stats.today}</div></div>
      <div class="stat-tile"><div class="label">Last 7 days</div><div class="value">${stats.last7d}</div></div>
      <div class="stat-tile"><div class="label">Contacted</div><div class="value">${stats.contacted}</div></div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>Leads (${total})</h2>
        <div style="display:flex; gap:10px;">
          <a class="btn btn-ghost btn-sm" href="/admin/export.csv">Export CSV</a>
          <form method="POST" action="/admin/logout" class="inline">
            <input type="hidden" name="_csrf" value="${csrfToken}" />
            <button type="submit" class="btn btn-ghost btn-sm">Log out</button>
          </form>
        </div>
      </div>

      <form method="GET" action="/admin" class="filters">
        <input type="text" name="q" placeholder="Search email…" value="${filters.search || ""}" />
        <select name="status">
          <option value="" ${filters.status === "" ? "selected" : ""}>All statuses</option>
          <option value="new" ${filters.status === "new" ? "selected" : ""}>New</option>
          <option value="contacted" ${filters.status === "contacted" ? "selected" : ""}>Contacted</option>
          <option value="converted" ${filters.status === "converted" ? "selected" : ""}>Converted</option>
          <option value="unsubscribed" ${filters.status === "unsubscribed" ? "selected" : ""}>Unsubscribed</option>
        </select>
        <button type="submit" class="btn btn-ghost btn-sm">Filter</button>
        ${filters.status || filters.search
          ? html`<a href="/admin" class="muted" style="margin-left:4px;">Clear</a>`
          : ""}
      </form>

      ${rows.length === 0
        ? html`<div class="empty">No signups match these filters yet.</div>`
        : html`<table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(
                (r) => html`<tr>
                  <td class="email">${r.email}</td>
                  <td>${r.priority || "—"}</td>
                  <td>${statusChip(r.status)}</td>
                  <td>${fmtDate(r.created_at)}</td>
                  <td style="text-align:right;">
                    ${r.status === "new"
                      ? html`<form method="POST" action="/admin/leads/${r.id}/contacted" class="inline">
                          <input type="hidden" name="_csrf" value="${csrfToken}" />
                          <button type="submit" class="btn btn-ghost btn-sm">Mark contacted</button>
                        </form>`
                      : ""}
                  </td>
                </tr>`
              )}
            </tbody>
          </table>`}

      <div class="pagination">
        <span>Page ${page} of ${pageCount}</span>
        ${page > 1
          ? html`<a class="btn btn-ghost btn-sm" href="/admin?page=${page - 1}&status=${filters.status || ""}&q=${filters.search || ""}">← Prev</a>`
          : ""}
        ${page < pageCount
          ? html`<a class="btn btn-ghost btn-sm" href="/admin?page=${page + 1}&status=${filters.status || ""}&q=${filters.search || ""}">Next →</a>`
          : ""}
      </div>
    </div>
  `;

  return layout({
    title: "Admin",
    tag: "Admin",
    nav: [{ label: "Waitlist", href: "/admin" }],
    activePath: "/admin",
    body,
  });
}

module.exports = { adminDashboardPage };
