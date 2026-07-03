/**
 * Base URL for AOIrail SECTION=data (masterlead, outbound-dialer/leads cache, inbound-calls, etc.).
 * Use this when adding server-side HTTP from leadsync jobs into AOIrail — never the Connect UI origin.
 *
 * Railway on `aoirail-leadsync`: set one of:
 *   AOIRAIL_DATA_SERVICE_URL=https://aoirail-data-production.up.railway.app
 *   DATA_SERVICE_URL=... (alias)
 */
function getAoirailDataServiceBaseUrl() {
  const raw = process.env.AOIRAIL_DATA_SERVICE_URL || process.env.DATA_SERVICE_URL || "";
  return String(raw).trim().replace(/\/+$/, "");
}

module.exports = { getAoirailDataServiceBaseUrl };
