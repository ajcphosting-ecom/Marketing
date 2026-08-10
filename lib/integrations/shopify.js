// Shopify connector — NOT IMPLEMENTED YET.
//
// Shopify gives you revenue (orders), not ad spend, so a full "blended
// ROAS" sync needs this paired with an ads connector (meta_ads/google_ads)
// for the spend side. To implement the revenue half:
//
//   GET https://{shopDomain}/admin/api/2024-10/orders.json
//     ?status=any&created_at_min={since}&created_at_max={until}
//   Header: X-Shopify-Access-Token: {accessToken}
//
// Sum `total_price` per day to get daily revenue. Docs:
// https://shopify.dev/docs/api/admin-rest/latest/resources/order
//
// Credentials shape expected by this connector: { shopDomain, accessToken }

const { NotImplementedError } = require("./errors");

async function testConnection(_credentials) {
  throw new NotImplementedError(
    "Shopify connector isn't implemented yet — see lib/integrations/shopify.js for the API calls to add."
  );
}

async function fetchDailyMetrics(_credentials, _range) {
  throw new NotImplementedError(
    "Shopify connector isn't implemented yet — see lib/integrations/shopify.js for the API calls to add."
  );
}

module.exports = { testConnection, fetchDailyMetrics };
