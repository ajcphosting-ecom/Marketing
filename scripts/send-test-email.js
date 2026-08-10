#!/usr/bin/env node
// Sends one real test email through whatever SMTP_* config is in .env, so
// you can confirm a provider (e.g. Resend) is wired up correctly without
// triggering a real waitlist signup or client invite.
//
// Usage: npm run test-email -- you@example.com

require("dotenv").config({ quiet: true });

const email = require("../lib/email");

const to = process.argv[2];

if (!to) {
  console.error("Usage: npm run test-email -- you@example.com");
  process.exit(1);
}

if (!process.env.SMTP_HOST) {
  console.error(
    "SMTP_HOST is not set in .env — this would just log to the console, not send anything.\n" +
      "Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS first (see README \"Setting up Resend\")."
  );
  process.exit(1);
}

async function main() {
  console.log(`Sending a test email to ${to} via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}…`);

  try {
    const info = await email.send({
      to,
      subject: "Ampcurve SMTP test",
      text: "If you're reading this, outbound email is wired up correctly.",
      html: "<p>If you're reading this, outbound email is wired up correctly.</p>",
    });
    console.log("Sent.", info.messageId ? `Message ID: ${info.messageId}` : "");
  } catch (err) {
    console.error("Failed to send:", err.message);
    process.exit(1);
  }
}

main();
