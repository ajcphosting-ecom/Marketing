// Whop billing integration.
//
// CONFIDENCE NOTE: this was built without access to Whop's live developer
// docs (docs.whop.com was unreachable from the sandbox this was written
// in — only public search-result snippets were available). What's below
// follows the publicly documented "Standard Webhooks" spec
// (https://www.standardwebhooks.com/), which Whop's own docs state their
// webhooks conform to. The signature verification (this file's main
// security-relevant piece) should be correct as a result — that spec is
// stable and used by several providers. What's NOT verified: the exact
// event-type strings and payload field names Whop sends, since that's
// Whop-specific and could only be confirmed against a real delivery.
//
// Every webhook — verified or not, mapped or not — gets logged verbatim
// to the webhook_events table (see lib/webhookEvents.js). After your
// first real test payment, check `/admin/webhooks` and confirm the event
// names / fields below actually match; adjust mapEventToBilling() if not.

const crypto = require("crypto");

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifies a webhook per the Standard Webhooks spec: headers
 * `webhook-id` / `webhook-timestamp` / `webhook-signature`, secret shaped
 * like `whsec_<base64>`, signed content `${id}.${timestamp}.${rawBody}`,
 * HMAC-SHA256, base64-encoded, prefixed `v1,` (signature header can carry
 * multiple space-separated `v1,<sig>` values for secret rotation).
 */
function verifySignature({ headers, rawBody, secret }) {
  if (!secret) return { valid: false, reason: "WHOP_WEBHOOK_SECRET is not configured" };

  const id = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const signatureHeader = headers["webhook-signature"];
  if (!id || !timestamp || !signatureHeader) {
    return { valid: false, reason: "missing webhook-id/webhook-timestamp/webhook-signature headers" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) {
    return { valid: false, reason: "timestamp outside tolerance (possible replay, or clock skew)" };
  }

  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", key).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected, "base64");

  const candidates = String(signatureHeader)
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean);

  const valid = candidates.some((candidate) => {
    const candidateBuf = Buffer.from(candidate, "base64");
    return candidateBuf.length === expectedBuf.length && crypto.timingSafeEqual(candidateBuf, expectedBuf);
  });

  return valid ? { valid: true } : { valid: false, reason: "signature mismatch" };
}

/**
 * Best-effort mapping from a Whop event to a billing status update.
 * Pattern-matches on the event-type string rather than exact equality,
 * since the precise event names couldn't be confirmed against live docs.
 * Returns null (do nothing but log) when the event doesn't look
 * billing-relevant, or when it does but no email can be found to match a
 * client against.
 */
function mapEventToBilling(event, data) {
  const type = String(event || "").toLowerCase();
  const email = extractEmail(data);

  let status = null;
  if (/payment\.?_?succeeded/.test(type) || /membership\.?_?(activat|went_valid)/.test(type)) {
    status = "active";
  } else if (/payment\.?_?failed/.test(type)) {
    status = "past_due";
  } else if (/membership\.?_?(deactivat|went_invalid|cancel)/.test(type)) {
    status = "cancelled";
  }

  if (!status) return null;
  return { status, email, name: extractName(data), membershipId: extractMembershipId(data) };
}

function extractEmail(data) {
  if (!data || typeof data !== "object") return null;
  return (
    data.email ||
    data.user?.email ||
    data.member?.email ||
    data.customer?.email ||
    data.membership?.user?.email ||
    null
  );
}

function extractName(data) {
  if (!data || typeof data !== "object") return null;
  return data.name || data.user?.name || data.member?.name || data.customer?.name || null;
}

function extractMembershipId(data) {
  if (!data || typeof data !== "object") return null;
  return data.membership_id || data.membership?.id || data.id || null;
}

module.exports = { verifySignature, mapEventToBilling };
