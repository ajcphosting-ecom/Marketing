const { html } = require("../../lib/html");
const { layout } = require("../layout");

function acceptInvitePage({ invite, error, csrfToken, token }) {
  if (!invite) {
    return layout({
      title: "Invite",
      body: html`
        <div class="login-wrap">
          <div class="login-card">
            <h1>Invite not found</h1>
            <p class="subtitle">This invite link is invalid, expired, or has already been used.</p>
            <a class="btn btn-ghost" href="/portal/login">Go to login</a>
          </div>
        </div>
      `,
    });
  }

  const body = html`
    <div class="login-wrap">
      <div class="login-card">
        <h1>Set your password</h1>
        <p class="subtitle" style="margin-bottom:24px;">
          Joining <strong>${invite.client_name}</strong>'s Ampcurve portal as ${invite.email}
        </p>
        ${error ? html`<div class="error-box">${error}</div>` : ""}
        <form method="POST" action="/portal/accept-invite">
          <input type="hidden" name="_csrf" value="${csrfToken}" />
          <input type="hidden" name="token" value="${token}" />
          <div class="field">
            <label for="password">Password (min. 12 characters)</label>
            <input type="password" id="password" name="password" required minlength="12" autocomplete="new-password" />
          </div>
          <div class="field">
            <label for="password2">Confirm password</label>
            <input type="password" id="password2" name="password2" required minlength="12" autocomplete="new-password" />
          </div>
          <button type="submit" class="btn" style="width:100%; justify-content:center;">Set password &amp; sign in</button>
        </form>
      </div>
    </div>
  `;

  return layout({ title: "Accept invite", body });
}

module.exports = { acceptInvitePage };
