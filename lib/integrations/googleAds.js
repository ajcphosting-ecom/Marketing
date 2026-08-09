// Google Ads connector — NOT IMPLEMENTED YET.
//
// To implement: use the Google Ads API (google-ads-api npm package or raw
// REST) with a GAQL query against the customer's account, segmented by
// day, e.g.:
//
//   SELECT segments.date, metrics.cost_micros, metrics.conversions_value
//   FROM customer
//   WHERE segments.date BETWEEN '{since}' AND '{until}'
//
// `cost_micros / 1_000_000` gives spend; `conversions_value` gives
// attributed revenue (requires conversion tracking to be configured on
// the account). Docs: https://developers.google.com/google-ads/api/docs/reporting/overview
//
// Credentials shape expected by this connector:
//   { customerId, developerToken, refreshToken }
// developerToken + the OAuth client used to mint refreshToken both come
// from a Google Ads API developer account set up outside this codebase.

const { NotImplementedError } = require("./errors");

async function testConnection(_credentials) {
  throw new NotImplementedError(
    "Google Ads connector isn't implemented yet — see lib/integrations/googleAds.js for the API calls to add."
  );
}

async function fetchDailyMetrics(_credentials, _range) {
  throw new NotImplementedError(
    "Google Ads connector isn't implemented yet — see lib/integrations/googleAds.js for the API calls to add."
  );
}

module.exports = { testConnection, fetchDailyMetrics };
