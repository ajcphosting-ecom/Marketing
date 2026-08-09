const { test } = require("node:test");
const assert = require("node:assert/strict");
require("./helpers"); // sets DB_PATH etc before anything touches ../db
const email = require("../lib/email");

test("no SMTP_HOST means unconfigured (dry-run mode)", () => {
  const options = email.buildTransportOptions({});
  assert.equal(options, null);
});

test("builds correct options for Resend's recommended SMTPS settings", () => {
  const options = email.buildTransportOptions({
    SMTP_HOST: "smtp.resend.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "resend",
    SMTP_PASS: "re_fake_api_key",
  });

  assert.deepEqual(options, {
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    auth: { user: "resend", pass: "re_fake_api_key" },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
});

test("builds correct options for STARTTLS on port 587", () => {
  const options = email.buildTransportOptions({
    SMTP_HOST: "smtp.resend.com",
    SMTP_PORT: "587",
    SMTP_USER: "resend",
    SMTP_PASS: "re_fake_api_key",
  });

  assert.equal(options.port, 587);
  assert.equal(options.secure, false, "SMTP_SECURE unset must default to false (STARTTLS, not SMTPS)");
});

test("defaults to port 587 when SMTP_PORT is unset", () => {
  const options = email.buildTransportOptions({ SMTP_HOST: "smtp.example.com" });
  assert.equal(options.port, 587);
});

test("omits auth entirely when no SMTP_USER is set", () => {
  const options = email.buildTransportOptions({ SMTP_HOST: "smtp.example.com" });
  assert.equal(options.auth, undefined);
});
