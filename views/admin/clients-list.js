const { html } = require("../../lib/html");
const { layout } = require("../layout");
const { ADMIN_NAV } = require("./nav");

function fmtRoas(v) {
  return v == null ? "—" : `${v.toFixed(1)}x`;
}

function clientsListPage({ clients, csrfToken, flash, error }) {
  const body = html`
    <h1>Clients</h1>
    <p class="subtitle">Every client with a portal account, and the ones you haven't invited yet.</p>

    ${flash ? html`<div class="flash-box">${flash}</div>` : ""}
    ${error ? html`<div class="error-box">${error}</div>` : ""}

    <div class="panel" style="margin-bottom:24px;">
      <div class="panel-head"><h2>Add a client</h2></div>
      <form method="POST" action="/admin/clients" style="padding:16px 20px; display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
        <input type="hidden" name="_csrf" value="${csrfToken}" />
        <div class="field" style="margin-bottom:0;">
          <label for="name">Client name</label>
          <input type="text" id="name" name="name" placeholder="e.g. Brandloop" required maxlength="120" />
        </div>
        <button type="submit" class="btn">Create client</button>
      </form>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>All clients (${clients.length})</h2></div>
      ${clients.length === 0
        ? html`<div class="empty">No clients yet — add one above.</div>`
        : html`<table>
            <thead>
              <tr><th>Client</th><th>Users</th><th>Experiments</th><th>Latest ROAS</th><th></th></tr>
            </thead>
            <tbody>
              ${clients.map(
                (c) => html`<tr>
                  <td class="email">${c.name}</td>
                  <td>${c.user_count}</td>
                  <td>${c.experiment_count}</td>
                  <td>${fmtRoas(c.latest_roas)}</td>
                  <td style="text-align:right;"><a class="btn btn-ghost btn-sm" href="/admin/clients/${c.id}">Manage →</a></td>
                </tr>`
              )}
            </tbody>
          </table>`}
    </div>
  `;

  return layout({ title: "Clients", tag: "Admin", nav: ADMIN_NAV, activePath: "/admin/clients", body });
}

module.exports = { clientsListPage };
