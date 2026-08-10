const { html, raw } = require("../lib/html");

// Shared shell for every server-rendered admin/portal page. Same ink-navy +
// amber tokens as the public site, but tuned for a dashboard: denser
// spacing, a real nav bar, and status chips instead of editorial type.
const BASE_STYLES = `
  :root {
    --ink: #0e1420; --ink-soft: #131b2a; --panel: #161f31; --line: #263149; --line-soft: #1c2437;
    --paper: #f4efe2; --paper-dim: #94a1b8; --paper-dimmer: #5c6882;
    --signal: #f0a63c; --signal-ink: #0e1420; --rise: #6fcf97; --fall: #e07a6a;
    --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace;
    --radius: 10px;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ink); color: var(--paper); font-family: var(--font-body); line-height: 1.5; }
  a { color: inherit; }
  .shell-nav { border-bottom: 1px solid var(--line); background: rgba(14,20,32,0.9); position: sticky; top: 0; z-index: 10; }
  .shell-nav-inner { max-width: 1080px; margin: 0 auto; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
  .shell-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; text-decoration: none; font-size: 1rem; }
  .shell-brand .mark { width: 22px; height: 22px; border-radius: 6px; background: var(--signal); }
  .shell-tag { font-family: var(--font-mono); font-size: 0.68rem; color: var(--paper-dimmer); text-transform: uppercase; letter-spacing: 0.08em; margin-left: 4px; }
  .shell-links { display: flex; gap: 20px; align-items: center; font-size: 0.85rem; }
  .shell-links a { color: var(--paper-dim); text-decoration: none; }
  .shell-links a:hover, .shell-links a.active { color: var(--paper); }
  .shell-logout { color: var(--paper-dimmer); text-decoration: none; font-size: 0.82rem; }
  .shell-logout:hover { color: var(--fall); }
  .shell-main { max-width: 1080px; margin: 0 auto; padding: 36px 24px 64px; }
  h1 { font-size: 1.5rem; letter-spacing: -0.01em; margin: 0 0 6px; }
  .subtitle { color: var(--paper-dim); font-size: 0.92rem; margin: 0 0 32px; }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 32px; }
  .stat-tile { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 18px; }
  .stat-tile .label { font-family: var(--font-mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--paper-dimmer); margin-bottom: 8px; }
  .stat-tile .value { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 1.6rem; font-weight: 600; color: var(--paper); }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
  .panel-head { padding: 16px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .panel-head h2 { font-size: 1rem; margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  th { text-align: left; font-family: var(--font-mono); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--paper-dimmer); padding: 12px 20px; border-bottom: 1px solid var(--line); }
  td { padding: 12px 20px; border-bottom: 1px solid var(--line-soft); color: var(--paper-dim); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  td.email { color: var(--paper); font-weight: 500; }
  .chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.03em; }
  .chip-new { background: rgba(240,166,60,0.14); color: var(--signal); }
  .chip-contacted { background: rgba(111,207,151,0.14); color: var(--rise); }
  .chip-converted { background: rgba(111,207,151,0.22); color: var(--rise); }
  .chip-unsubscribed { background: rgba(224,122,106,0.14); color: var(--fall); }
  .chip-running { background: rgba(240,166,60,0.14); color: var(--signal); }
  .chip-won { background: rgba(111,207,151,0.14); color: var(--rise); }
  .chip-lost { background: rgba(224,122,106,0.14); color: var(--fall); }
  .chip-paused { background: rgba(148,161,184,0.14); color: var(--paper-dim); }
  .btn { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border: none; border-radius: 7px; padding: 8px 14px; font-size: 0.84rem; font-weight: 700; background: var(--signal); color: var(--signal-ink); text-decoration: none; }
  .btn:hover { filter: brightness(1.07); }
  .btn-ghost { background: transparent; border: 1px solid var(--line); color: var(--paper-dim); font-weight: 600; }
  .btn-ghost:hover { border-color: #3a4664; color: var(--paper); }
  .btn-sm { padding: 5px 10px; font-size: 0.76rem; }
  form.inline { display: inline; }
  input[type="text"], input[type="email"], input[type="password"], select {
    background: var(--ink-soft); border: 1px solid var(--line); color: var(--paper); border-radius: 7px;
    padding: 9px 12px; font-size: 0.88rem; font-family: var(--font-body); outline: none;
  }
  input:focus, select:focus { border-color: var(--signal); }
  .filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--line); }
  .empty { padding: 48px 20px; text-align: center; color: var(--paper-dimmer); }
  .pagination { display: flex; gap: 8px; align-items: center; padding: 16px 20px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--paper-dimmer); }
  .login-wrap { max-width: 380px; margin: 96px auto; padding: 0 24px; }
  .login-card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 32px; }
  .login-card h1 { font-size: 1.2rem; margin: 0 0 4px; }
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 0.8rem; color: var(--paper-dim); margin-bottom: 6px; }
  .field input { width: 100%; }
  .error-box { background: rgba(224,122,106,0.12); border: 1px solid rgba(224,122,106,0.3); color: var(--fall); padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 18px; }
  .flash-box { background: rgba(111,207,151,0.12); border: 1px solid rgba(111,207,151,0.3); color: var(--rise); padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 18px; }
  .muted { color: var(--paper-dimmer); font-size: 0.82rem; }
`;

function layout({ title, tag = "", nav = [], activePath = "", body, headExtra = "" }) {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>${title} — Ampcurve</title>
<style>${raw(BASE_STYLES)}</style>
${raw(headExtra)}
</head>
<body>
${nav.length
  ? html`<nav class="shell-nav">
      <div class="shell-nav-inner">
        <a href="/" class="shell-brand"><span class="mark"></span>Ampcurve${tag ? html`<span class="shell-tag">${tag}</span>` : ""}</a>
        <div class="shell-links">
          ${nav.map(
            (item) =>
              html`<a href="${item.href}" class="${item.href === activePath ? "active" : ""}">${item.label}</a>`
          )}
        </div>
      </div>
    </nav>`
  : ""}
<main class="shell-main">
${body}
</main>
</body>
</html>`;
}

module.exports = { layout };
