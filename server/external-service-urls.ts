function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return stripTrailingSlashes(trimmed);
  return stripTrailingSlashes(`https://${trimmed}`);
}

/**
 * Trustworthy Youths campaign manager (own Railway service; e.g. project "worthy-victory").
 * Monorepo source: `apps/campaign-manager` (TaalkCenterTracker).
 * Set CAMPAIGN_MANAGER_URL to the deployed origin (no trailing slash).
 * AOI_COMMAND_URL / VITE_AOI_COMMAND_URL remain as fallbacks for older envs.
 */
export function getCampaignManagerBaseUrl(): string {
  const raw =
    process.env.CAMPAIGN_MANAGER_URL ||
    process.env.AOI_COMMAND_URL ||
    process.env.VITE_AOI_COMMAND_URL ||
    "";
  return normalizeBaseUrl(raw);
}

/**
 * AOIntel lead sync (CCPro assignment-trigger API; own Railway service; e.g. project "rare-friendship").
 * Zoho/Taalk batch tooling lives under `apps/leadsync` and is a different process unless you merge them.
 * Set LEAD_SYNC_URL (or AOINTEL_LEAD_SYNC_URL) to the deployed origin (no trailing slash).
 */
export function getLeadSyncBaseUrl(): string {
  const raw =
    process.env.LEAD_SYNC_URL ||
    process.env.AOINTEL_LEAD_SYNC_URL ||
    (process.env.RAILWAY_SERVICE_AOIRAIL_AOINTELLEADSYNC_URL
      ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_AOINTELLEADSYNC_URL}`
      : "") ||
    (process.env.RAILWAY_SERVICE_AOIRAIL_LEADSYNC_URL
      ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_LEADSYNC_URL}`
      : "") ||
    // Default to the dedicated assignment-trigger service.
    "https://aoirail-aointelleadsync-production.up.railway.app";
  return normalizeBaseUrl(raw);
}

/** POST target for CCPro bulk / buffer assignment (lead sync app). */
export function getLeadSyncAssignmentTriggerUrl(): string {
  // Hard-pin assignment traffic to the dedicated Leadsync trigger endpoint.
  // This avoids accidental routing through non-Leadsync hosts when generic base env vars drift.
  return "https://aoirail-aointelleadsync-production.up.railway.app/api/ccpro/assignment-trigger";
}

/**
 * AOIrail **data** deploy (`SECTION=data`) — masterlead, hot dialer tables, `/api/inbound-calls`, etc.
 * Set on **servers and workers** (not Vite): `AOIRAIL_DATA_SERVICE_URL` or `DATA_SERVICE_URL`.
 * Use for server→server HTTP when a job must hit the same routes as the segmented Connect client
 * (`resolveServiceUrl` / `VITE_DATA_SERVICE_URL`), e.g. future leadsync → AOIrail masterlead refresh hooks.
 */
export function getAoirailDataServiceBaseUrl(): string {
  const raw =
    process.env.AOIRAIL_DATA_SERVICE_URL ||
    process.env.DATA_SERVICE_URL ||
    process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL ||
    "";
  return normalizeBaseUrl(raw);
}

/**
 * When `RAILWAY_PUBLIC_DOMAIN` is like `aoirail-connect-production.up.railway.app`, infer the
 * sibling data host `aoirail-data-production.up.railway.app` (same pattern as the browser helper).
 */
export function inferDataServiceUrlFromRailwayPublicDomain(): string {
  const domain = (process.env.RAILWAY_PUBLIC_DOMAIN || "").trim().toLowerCase();
  if (!domain) return "";
  // Preserve any full environment suffix (e.g. production-baa2) and only swap service segment.
  const match = domain.match(/^aoirail-([a-z0-9]+)-(.+)\.up\.railway\.app$/i);
  if (!match) return "";
  const withData = `aoirail-data-${match[2]}.up.railway.app`;
  return stripTrailingSlashes(`https://${withData}`);
}

/** Base URL to inject into Connect HTML so the SPA hits data without a Vite rebuild. */
export function getConnectClientDataServiceUrl(): string {
  return getAoirailDataServiceBaseUrl() || inferDataServiceUrlFromRailwayPublicDomain();
}
