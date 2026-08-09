// Transactional email for waitlist signups. Configure via SMTP_* env vars
// (works with any provider — SendGrid, Postmark, Mailgun, SES, a Gmail app
// password, etc). With no SMTP configured, emails are logged to the console
// instead of sent, so the app still runs end-to-end in local dev.

const nodemailer = require("nodemailer");

const FROM = process.env.MAIL_FROM || "Ampcurve <hello@ampcurve.co>";
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "";

let transporter = null;
let warned = false;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
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

  return t.sendMail({ from: FROM, to, subject, text, html });
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
  if (!ADMIN_NOTIFY_EMAIL) return { skipped: true };

  const subject = `New waitlist signup — #${position}`;
  const text = `${email} just joined the waitlist (#${position}).\nPriority: ${
    priority || "not specified"
  }`;

  return send({ to: ADMIN_NOTIFY_EMAIL, subject, text });
}

module.exports = { send, sendWaitlistWelcome, sendAdminNewSignupNotice };
