// Google Analytics 4 connector — NOT IMPLEMENTED YET.
//
// To implement: use the GA4 Data API with a service account, requesting
// revenue by day:
//
//   POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport
//   { "dateRanges": [{"startDate": "{since}", "endDate": "{until}"}],
//     "dimensions": [{"name": "date"}],
//     "metrics": [{"name": "totalRevenue"}] }
//
// GA4 doesn't know ad spend either, so — like Shopify — this is the
// revenue half of the picture; pair it with an ads connector for spend.
// Docs: https://developers.google.com/analytics/devguides/reporting/data/v1
//
// Credentials shape expected by this connector:
//   { propertyId, serviceAccountJson }
// serviceAccountJson is the full JSON key file downloaded from Google
// Cloud IAM for a service account with Viewer access on the GA4 property.

const { NotImplementedError } = require("./errors");

async function testConnection(_credentials) {
  throw new NotImplementedError(
    "GA4 connector isn't implemented yet — see lib/integrations/ga4.js for the API calls to add."
  );
}

async function fetchDailyMetrics(_credentials, _range) {
  throw new NotImplementedError(
    "GA4 connector isn't implemented yet — see lib/integrations/ga4.js for the API calls to add."
  );
}

module.exports = { testConnection, fetchDailyMetrics };
