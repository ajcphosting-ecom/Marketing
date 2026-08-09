// Registry of pluggable data-source connectors for the client portal.
//
// Each provider has a credential form (rendered from `fields` below) and a
// connector module with two async functions:
//   testConnection(credentials) -> throws on failure, resolves on success
//   fetchDailyMetrics(credentials, { since, until }) -> [{ date, adSpend, revenue }]
//
// None of the connectors below are implemented against a real API yet —
// see the comment at the top of each file in this directory for exactly
// what to add once you have real credentials for that provider. Calling
// them today throws NotImplementedError, which the admin UI surfaces as a
// clear "not implemented" message rather than pretending to sync.

const { NotImplementedError } = require("./errors");

const PROVIDERS = {
  shopify: {
    label: "Shopify",
    docsHint: "Revenue only — pair with an ads connector for spend.",
    fields: [
      { name: "shopDomain", label: "Shop domain", placeholder: "your-store.myshopify.com" },
      { name: "accessToken", label: "Admin API access token", secret: true },
    ],
    connector: require("./shopify"),
  },
  meta_ads: {
    label: "Meta Ads",
    docsHint: "Spend + revenue (if purchase conversions are tracked).",
    fields: [
      { name: "adAccountId", label: "Ad account ID", placeholder: "123456789" },
      { name: "accessToken", label: "Access token", secret: true },
    ],
    connector: require("./metaAds"),
  },
  google_ads: {
    label: "Google Ads",
    docsHint: "Spend + revenue (if conversion tracking is set up).",
    fields: [
      { name: "customerId", label: "Customer ID", placeholder: "123-456-7890" },
      { name: "developerToken", label: "Developer token", secret: true },
      { name: "refreshToken", label: "OAuth refresh token", secret: true },
    ],
    connector: require("./googleAds"),
  },
  ga4: {
    label: "Google Analytics 4",
    docsHint: "Revenue only — pair with an ads connector for spend.",
    fields: [
      { name: "propertyId", label: "GA4 property ID", placeholder: "123456789" },
      { name: "serviceAccountJson", label: "Service account JSON", secret: true, textarea: true },
    ],
    connector: require("./ga4"),
  },
};

module.exports = { PROVIDERS, NotImplementedError };
