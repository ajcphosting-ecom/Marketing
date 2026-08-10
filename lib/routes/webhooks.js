// Inbound webhooks from external providers. Mounted in server.js with its
// own express.raw() body parser, BEFORE the app-wide express.json() — the
// raw, byte-for-byte request body is required to verify a signature.

const express = require("express");
const rateLimit = require("express-rate-limit");
const whop = require("../billing/whop");
const clients = require("../clients");
const webhookEvents = require("../webhookEvents");
const email = require("../email");

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

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
      } else if (mapped.status === "active" && mapped.email) {
        // A payment came in for an email with no client yet — automatic
        // onboarding: provision the client, invite the user, done. Only
        // for "active" signals; an unmatched cancellation has nothing to
        // provision and stays flagged for review instead.
        try {
          const { client, invite } = clients.autoProvisionClientFromPayment({
            email: mapped.email,
            name: mapped.name,
            membershipId: mapped.membershipId,
          });
          clientId = client.id;
          needsReview = false;

          const inviteUrl = `${APP_BASE_URL}/portal/accept-invite?token=${invite.token}`;
          email
            .sendClientInvite({ email: mapped.email, clientName: client.name, url: inviteUrl })
            .catch((err) => console.error("[email] auto-onboarding invite failed:", err.message));
        } catch (err) {
          console.error("[webhooks/whop] auto-provisioning failed:", err.message);
        }
      }
      // else: recognized as billing-relevant but couldn't match or provision — flag for review.
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
