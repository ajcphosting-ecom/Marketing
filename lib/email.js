// Transactional email for waitlist signups. Configure via SMTP_* env vars
// (works with any provider — SendGrid, Postmark, Mailgun, SES, a Gmail app
// password, etc). With no SMTP configured, emails are logged to the console
// instead of sent, so the app still runs end-to-end in local dev.

const nodemailer = require("nodemailer");
const { escapeHtml } = require("./html");

/** Plain text -> paragraph HTML, escaping first since this often wraps AI-generated text. */
function textToHtmlParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function getFrom() {
  return process.env.MAIL_FROM || "Ampcurve <hello@ampcurve.co>";
}

function getAdminNotifyEmail() {
  return process.env.ADMIN_NOTIFY_EMAIL || "";
}

/**
 * Pure function: turns SMTP_* env vars into nodemailer transport options,
 * or null if SMTP isn't configured. Exported (unmemoized, no I/O) so tests
 * can verify a provider's settings translate correctly without sending
 * real email or needing real credentials.
 */
function buildTransportOptions(env = process.env) {
  if (!env.SMTP_HOST) return null;

  return {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === "true",
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    // Fail fast instead of hanging indefinitely if the provider/network is
    // unreachable (e.g. an outbound-SMTP-blocking firewall) — a waitlist
    // signup shouldn't wait 2+ minutes to find that out.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  };
}

let transporter = null;
let cachedOptionsKey = null;
let warned = false;

function getTransporter() {
  const options = buildTransportOptions();
  if (!options) return null;

  // Re-create the transporter if the relevant env vars changed since the
  // last call (covers tests reconfiguring SMTP_* between runs; in
  // production this only ever runs once).
  const key = JSON.stringify(options);
  if (!transporter || cachedOptionsKey !== key) {
    transporter = nodemailer.createTransport(options);
    cachedOptionsKey = key;
  }
  return transporter;
}

async function send({ to, subject, text, html }) {
  const t = getTransporter();

  if (!t) {
    if (!warned) {
      console.warn(
        "[email] SMTP_HOST not set — emails will be logged instead of sent. " +
          "Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS to send real email."
      );
      warned = true;
    }
    console.log(`[email:dry-run] to=${to} subject="${subject}"\n${text}`);
    return { dryRun: true };
  }

  return t.sendMail({ from: getFrom(), to, subject, text, html });
}

async function sendWaitlistWelcome({ email, position }) {
  const subject = "You're on the Ampcurve waitlist";
  const text = [
    `Thanks for joining the Ampcurve waitlist!`,
    ``,
    `You're #${position} in line. We're onboarding a small founding cohort first —`,
    `we'll email you as soon as a spot opens up, along with your founding-member`,
    `pricing (20% off your first 3 months) and a free growth audit.`,
    ``,
    `— The Ampcurve team`,
  ].join("\n");

  const html = `
    <p>Thanks for joining the <strong>Ampcurve</strong> waitlist!</p>
    <p>You're <strong>#${position}</strong> in line. We're onboarding a small founding
    cohort first — we'll email you as soon as a spot opens up, along with your
    founding-member pricing (20% off your first 3 months) and a free growth audit.</p>
    <p>— The Ampcurve team</p>
  `;

  return send({ to: email, subject, text, html });
}

async function sendAdminNewSignupNotice({ email, priority, position }) {
  const adminEmail = getAdminNotifyEmail();
  if (!adminEmail) return { skipped: true };

  const subject = `New waitlist signup — #${position}`;
  const text = `${email} just joined the waitlist (#${position}).\nPriority: ${
    priority || "not specified"
  }`;

  return send({ to: adminEmail, subject, text });
}

async function sendClientInvite({ email, clientName, url }) {
  const subject = `You've been invited to the Ampcurve client portal`;
  const text = [
    `You've been invited to ${clientName}'s Ampcurve client portal.`,
    ``,
    `Set your password to get in: ${url}`,
    ``,
    `This link expires in 7 days.`,
    ``,
    `— The Ampcurve team`,
  ].join("\n");

  const html = `
    <p>You've been invited to <strong>${clientName}</strong>'s Ampcurve client portal.</p>
    <p><a href="${url}">Set your password to get in</a> (expires in 7 days).</p>
    <p>— The Ampcurve team</p>
  `;

  return send({ to: email, subject, text, html });
}

/** The AI-generated "free growth audit" follow-up sent after a waitlist signup. */
async function sendGrowthAudit({ email, bodyText }) {
  const subject = "Your free growth audit";
  const html = `
    ${textToHtmlParagraphs(bodyText)}
    <p>— The Ampcurve team</p>
  `;
  const text = `${bodyText}\n\n— The Ampcurve team`;

  return send({ to: email, subject, text, html });
}

/** The AI-generated weekly performance update sent to each client portal user. */
async function sendWeeklyReport({ email, clientName, bodyText, stats }) {
  const subject = `${clientName}'s weekly update — ${stats.avgRoasLast7Days}x ROAS`;
  const html = `
    ${textToHtmlParagraphs(bodyText)}
    <p>— The Ampcurve team</p>
  `;
  const text = `${bodyText}\n\n— The Ampcurve team`;

  return send({ to: email, subject, text, html });
}

module.exports = {
  send,
  sendWaitlistWelcome,
  sendAdminNewSignupNotice,
  sendClientInvite,
  sendGrowthAudit,
  sendWeeklyReport,
  buildTransportOptions,
};
