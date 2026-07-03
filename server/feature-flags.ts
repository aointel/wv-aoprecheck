/**
 * Central feature flags for gradual service extraction (voice-ingress, dialer-api, dashboard-api, workers).
 * Defaults preserve current production behavior when vars are unset.
 */

/** When false, no background schedulers start (web or worker process). */
export function isWorkersGloballyEnabled(): boolean {
  return process.env.ENABLE_WORKERS !== "false";
}

/**
 * When false, the HTTP server does not start schedulers — run `node dist/worker.js` instead.
 * Default: false in production (worker runs as separate Railway service).
 *          true only if START_WORKERS_IN_WEB=true is explicitly set.
 */
export function shouldStartWorkersInWebServer(): boolean {
  if (!isWorkersGloballyEnabled()) return false;
  const v = (process.env.START_WORKERS_IN_WEB || "").trim().toLowerCase();
  // Explicit opt-in required — default is now false (split worker)
  if (v === "true" || v === "1" || v === "yes") return true;
  return false;
}

// --- Reserved for Phase B/C/D (wire routes when splitting services) ---
export function enableDashboardRoutesInWeb(): boolean {
  return process.env.ENABLE_DASHBOARD_ROUTES !== "false";
}
export function enableVoiceIngressRoutesInWeb(): boolean {
  return process.env.ENABLE_VOICE_INGRESS_ROUTES !== "false";
}
export function enableDialerRoutesInWeb(): boolean {
  return process.env.ENABLE_DIALER_ROUTES !== "false";
}
export function enableZapierAsyncMode(): boolean {
  return process.env.ENABLE_ZAPIER_ASYNC === "true";
}
export function enableCallStatusAsyncWrite(): boolean {
  return process.env.ENABLE_CALL_STATUS_ASYNC_WRITE === "true";
}
