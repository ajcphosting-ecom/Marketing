// Inbound webhooks from external providers. Mounted in server.js with its
// own express.raw() body parser, BEFORE the app-wide express.json() — the
// raw, byte-for-byte request body is required to verify a signature.

const express = require("express");
const rateLimit = require("express-rate-limit");
const whop = require("../billing/whop");
const clients = require("../clients");
const webhookEvents = require("../webhookEvents");

const router = express.Router();

// Defense in depth against someone hammering this public endpoint with junk
// — legitimate webhook volume from one provider is nowhere near this.
const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/whop", webhookLimiter, express.raw({ type: "application/json", limit: "1mb" }), (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  const verification = whop.verifySignature({
    headers: req.headers,
    rawBody,
    secret: process.env.WHOP_WEBHOOK_SECRET,
  });

  let parsed = null;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsed = null;
  }

  const eventType = parsed?.event || null;
  let clientId = null;
  let needsReview = true;

  if (verification.valid && parsed) {
    const mapped = whop.mapEventToBilling(eventType, parsed.data);
    if (mapped) {
      clientId = mapped.email ? clients.findClientIdByUserEmail(mapped.email) : null;
      if (clientId) {
        clients.setBillingStatus(clientId, mapped.status, mapped.membershipId);
        needsReview = false;
      }
      // else: recognized as billing-relevant but couldn't match a client — flag for review.
    }
    // else: didn't match a known event pattern. Could be irrelevant, or a real
    // billing event under a name we guessed wrong — flag for review either way.
  }

  webhookEvents.recordEvent({
    provider: "whop",
    eventType,
    verified: verification.valid,
    needsReview,
    clientId,
    payload: rawBody,
  });

  if (!verification.valid) {
    console.warn(`[webhooks/whop] rejected: ${verification.reason}`);
    return res.status(400).json({ error: "invalid signature" });
  }

  res.status(200).json({ ok: true });
});

module.exports = router;
