const { html } = require("../../lib/html");
const { layout } = require("../layout");

function portalLoginPage({ error, next, csrfToken }) {
  const body = html`
    <div class="login-wrap">
      <div class="login-card">
        <h1>Client login</h1>
        <p class="subtitle" style="margin-bottom:24px;">Ampcurve client portal</p>
        ${error ? html`<div class="error-box">${error}</div>` : ""}
        <form method="POST" action="/portal/login">
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

  return layout({ title: "Client login", body });
}

module.exports = { portalLoginPage };
