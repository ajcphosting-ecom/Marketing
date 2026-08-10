// Claude-generated content for the parts of running Ampcurve that don't
// need a human's judgment call: weekly client report copy, candidate
// experiment ideas, and a first-pass growth audit for new leads.
//
// Nothing generated here touches a live ad account or a client's site —
// see lib/clients.js `syncIntegration` (read-only metric sync, still a
// stub) and the experiment-suggestions flow (an admin approves before a
// suggestion becomes a real experiment). This module only writes text.

const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — AI features (weekly reports, experiment " +
        "suggestions, growth audits) are disabled until it is. Get a key at " +
        "console.anthropic.com and set ANTHROPIC_API_KEY."
    );
  }
  client = new Anthropic();
  return client;
}

/** True once ANTHROPIC_API_KEY is set, without throwing — callers use this to skip gracefully. */
function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function firstTextBlock(content) {
  const block = content.find((b) => b.type === "text");
  return block ? block.text : "";
}

/**
 * Runs one Claude request. Returns parsed JSON when `schema` is given,
 * otherwise the response text. Throws a plain Error (with the refusal
 * category, if any) rather than a raw SDK exception — callers don't need
 * to know the Anthropic response shape.
 */
async function complete({ system, prompt, maxTokens = 1500, schema, effort = "medium" }) {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    output_config: {
      effort,
      ...(schema ? { format: { type: "json_schema", schema } } : {}),
    },
    system,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    const category = response.stop_details?.category || "unknown";
    throw new Error(`Claude declined this request (category: ${category}).`);
  }

  const text = firstTextBlock(response.content);
  if (!schema) return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Expected structured JSON back from Claude, got: ${text.slice(0, 200)}`);
  }
}

/**
 * A short, client-facing weekly performance update. `stats` and
 * `experiments` are pre-computed by lib/reports.js — this function never
 * does its own arithmetic, so it can't misreport a number.
 */
async function generateWeeklyReport({ clientName, stats, experiments }) {
  const system = [
    "You write short, warm, specific weekly performance update emails for Ampcurve,",
    "a marketing optimization agency, to send to its clients.",
    "",
    "Rules:",
    "- Only reference the numbers given below. Never invent a metric, date, or result that isn't provided.",
    "- 120-200 words. No greeting line or sign-off — just the body; those are added separately.",
    "- Lead with the headline number (blended ROAS and how it moved), then experiments, then one",
    "  forward-looking sentence about what's being tested next (if there's a running experiment) or",
    "  that new tests are being scoped (if there isn't).",
    "- Plain prose, no headers, no bullet lists, no markdown.",
  ].join("\n");

  const prompt = `Client: ${clientName}\n\nData for this update:\n${JSON.stringify(stats, null, 2)}\n\nExperiments:\n${JSON.stringify(experiments, null, 2)}`;

  return complete({ system, prompt, maxTokens: 700, effort: "medium" });
}

const SUGGESTIONS_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short experiment name, e.g. 'Sticky checkout CTA on mobile'" },
          channel: { type: "string", enum: ["cro", "paid-media", "creative"] },
          rationale: { type: "string", description: "1-2 sentences: why this, given the data provided" },
          expectedImpact: { type: "string", description: "e.g. 'Likely +3-6% conversion rate' — a plausible range, not a guarantee" },
        },
        required: ["name", "channel", "rationale", "expectedImpact"],
        additionalProperties: false,
      },
      minItems: 3,
      maxItems: 5,
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
};

/**
 * Candidate next experiments for a client, grounded only in the metrics/
 * experiment history given. Returns { suggestions: [...] } — nothing here
 * is written to the database or shown to the client until an admin
 * approves an individual suggestion (see lib/routes/admin.js).
 */
async function generateExperimentSuggestions({ clientName, stats, experiments }) {
  const system = [
    "You propose the next 3-5 marketing experiments for a client of Ampcurve, a",
    "marketing optimization agency (CRO, paid media, creative testing).",
    "",
    "Rules:",
    "- Base suggestions only on the data given — recent performance trend and past experiment",
    "  results (what already won/lost, so you don't repeat a loser or duplicate a winner).",
    "- Do not assume anything about the client's product, site, or audience beyond what's given.",
    "- Prefer specific, testable changes over vague strategy ('test X' not 'improve marketing').",
    "- expectedImpact is a plausible range framed as likely, never a guarantee.",
  ].join("\n");

  const prompt = `Client: ${clientName}\n\nRecent performance:\n${JSON.stringify(stats, null, 2)}\n\nPast/current experiments:\n${JSON.stringify(experiments, null, 2)}`;

  return complete({ system, prompt, maxTokens: 1200, schema: SUGGESTIONS_SCHEMA, effort: "medium" });
}

/**
 * A first-pass "free growth audit" for a new waitlist lead. Deliberately
 * generic and framework-level — we only have an email and a self-reported
 * priority at signup time, so this must not pretend to know anything
 * specific about the lead's business.
 */
async function generateGrowthAudit({ priority }) {
  const priorityLabel =
    {
      "conversion-rate": "improving conversion rate",
      "paid-media": "getting more from paid media / ROAS",
      attribution: "understanding what's actually working",
      creative: "creative that's stopped performing",
    }[priority] || "general marketing performance";

  const system = [
    "You write the first-pass 'free growth audit' Ampcurve, a marketing optimization agency,",
    "sends new waitlist signups. You have NOT seen this lead's website, ads, or data — you only",
    "know their stated priority. Write a genuinely useful, specific framework for that priority:",
    "the 2-3 things worth checking first and why, in a consultative tone.",
    "",
    "Rules:",
    "- Never claim to have looked at their site/ads/data, or state specific numbers as if observed.",
    "- Frame everything as 'here's what we'd check first' / 'a common cause of this is...', not",
    "  as findings about them specifically.",
    "- 150-220 words, plain prose, no headers or bullet lists.",
    "- End with one sentence inviting them to reply with their site/account for a real, specific audit.",
  ].join("\n");

  const prompt = `Their stated priority: ${priorityLabel}`;

  return complete({ system, prompt, maxTokens: 600, effort: "medium" });
}

module.exports = {
  isConfigured,
  generateWeeklyReport,
  generateExperimentSuggestions,
  generateGrowthAudit,
};
