const { html } = require("../../lib/html");
const { layout } = require("../layout");

function adminLoginPage({ error, next, csrfToken }) {
  const body = html`
    <div class="login-wrap">
      <div class="login-card">
        <h1>Admin login</h1>
        <p class="subtitle" style="margin-bottom:24px;">Ampcurve waitlist &amp; leads</p>
        ${error ? html`<div class="error-box">${error}</div>` : ""}
        <form method="POST" action="/admin/login">
          <input type="hidden" name="_csrf" value="${csrfToken}" />
          <input type="hidden" name="next" value="${next || ""}" />
          <div class="field">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required autocomplete="username" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn" style="width:100%; justify-content:center;">Sign in</button>
        </form>
      </div>
    </div>
  `;

  return layout({ title: "Admin login", body });
}

module.exports = { adminLoginPage };
