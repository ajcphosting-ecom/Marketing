// Meta Ads (Facebook/Instagram) connector — NOT IMPLEMENTED YET.
//
// To implement: use the Marketing API's Insights endpoint, broken out by
// day, to get spend and (if you track purchase conversions with the pixel/
// CAPI) revenue/ROAS directly:
//
//   GET https://graph.facebook.com/v19.0/act_{adAccountId}/insights
//     ?time_range={"since":"{since}","until":"{until}"}
//     &time_increment=1
//     &fields=spend,action_values
//     &access_token={accessToken}
//
// `action_values` with action_type "omni_purchase" (or purchase) gives
// revenue if conversion tracking is set up. Docs:
// https://developers.facebook.com/docs/marketing-api/insights
//
// Credentials shape expected by this connector: { adAccountId, accessToken }
// Note: a long-lived access token requires a Meta developer app + the
// standard OAuth/system-user token exchange — that setup happens outside
// this codebase, in Meta's developer console.

const { NotImplementedError } = require("./errors");

async function testConnection(_credentials) {
  throw new NotImplementedError(
    "Meta Ads connector isn't implemented yet — see lib/integrations/metaAds.js for the API calls to add."
  );
}

async function fetchDailyMetrics(_credentials, _range) {
  throw new NotImplementedError(
    "Meta Ads connector isn't implemented yet — see lib/integrations/metaAds.js for the API calls to add."
  );
}

module.exports = { testConnection, fetchDailyMetrics };
