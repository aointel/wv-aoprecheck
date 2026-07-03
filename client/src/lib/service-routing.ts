// Service routing v2026-04-12 - auto-route from monolith to cluster
const TWILIO_PREFIXES = [
  "/voice",
  "/incoming",
  "/twiml",
  "/webhook/webrtc",
  "/incomingcall",
  "/incomingcall-dial-action",
  "/lead-join",
  "/api/twilio",
  "/api/twilio-task-route",
  "/api/dial-lead",
  "/api/call-coaching",
  "/api/simple-outbound",
];

/** Paths rewritten to `VITE_DATA_SERVICE_URL` / `__AOIRAIL_DATA_SERVICE_URL__` when Connect is segmented from data. */
const DATA_PREFIXES = [
  "/api/masterlead",
  "/api/appointments",
  "/api/scheduler",
  "/api/schedule",
  "/api/leads",
  "/api/leasedialer",
  "/api/outbound-dialer",
  "/api/agent-dial-metrics",
  "/api/twilio-calls",
  "/api/twilio-call-stats",
  "/api/sync-twilio-calls",
  "/api/twilio-auto-sync",
  "/api/twilio/fix-attributions",
  "/api/inbound-calls",
];

// Keep connect-scoped dialer endpoints on same-origin connect service.
const CONNECT_LOCAL_PREFIXES = [
  "/api/leasedialer/sync",
  "/api/outbound-dialer/daily-stats",
  "/api/outbound-dialer/initiate-call",
  "/api/outbound-dialer/track-position",
  "/api/outbound-dialer/end-call",
  "/api/outbound-dialer/disposition",
  "/api/leads/ignite",
  "/api/leads/signal-online-and-request",
];

function normalizeBase(value?: string): string {
  return (value || "").trim().replace(/\/+$/, "");
}

function inferRailwayServiceBase(targetService: "twilio" | "data"): string {
  if (typeof window === "undefined") return "";
  try {
    const current = new URL(window.location.origin);
    const host = current.hostname;
    // Replace the service segment while preserving full environment suffix.
    // Examples:
    // - aoirail-connect-production.up.railway.app -> aoirail-data-production.up.railway.app
    // - aoirail-connect-production-baa2.up.railway.app -> aoirail-data-production-baa2.up.railway.app
    // When served from aoirail-production host, keep same-origin routing.
    // This host may front a unified shell service and cross-origin rewrites
    // can break credentials (CORS with include) and section-local endpoints.
    const monolithMatch = host.match(/^aoirail-production\.up\.railway\.app$/i);
    if (monolithMatch) {
      return "";
    }
    const match = host.match(/^aoirail-([a-z0-9]+)-(.+)\.up\.railway\.app$/i);
    if (!match) return "";
    const origin = `${current.protocol}//aoirail-${targetService}-${match[2]}.up.railway.app`;
    return normalizeBase(origin);
  } catch {
    return "";
  }
}

function hasPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

function splitPathAndSuffix(input: string): { path: string; suffix: string; isAbsolute: boolean } {
  if (!input) return { path: "", suffix: "", isAbsolute: false };
  if (input.startsWith("http://") || input.startsWith("https://")) {
    try {
      const parsed = new URL(input);
      return {
        path: parsed.pathname || "",
        suffix: `${parsed.search || ""}${parsed.hash || ""}`,
        isAbsolute: true,
      };
    } catch {
      return { path: input, suffix: "", isAbsolute: true };
    }
  }
  const q = input.indexOf("?");
  const h = input.indexOf("#");
  const splitAt =
    q === -1 ? h : h === -1 ? q : Math.min(q, h);
  if (splitAt === -1) return { path: input, suffix: "", isAbsolute: false };
  return { path: input.slice(0, splitAt), suffix: input.slice(splitAt), isAbsolute: false };
}

function viteEnvString(key: "VITE_DATA_SERVICE_URL" | "VITE_TWILIO_SERVICE_URL"): string {
  try {
    const v = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.[key];
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

/** Connect server injects this in index.html when SECTION=connect (no Vite rebuild needed). */
function runtimeInjectedDataBase(): string {
  if (typeof window === "undefined") return "";
  try {
    const w = (window as unknown as { __AOIRAIL_DATA_SERVICE_URL__?: string }).__AOIRAIL_DATA_SERVICE_URL__;
    return normalizeBase(typeof w === "string" ? w : "");
  } catch {
    return "";
  }
}

/**
 * Rewrites relative API paths (or same-site absolute URLs) to the segmented Railway
 * data or Twilio service when configured or when hostname matches
 * `aoirail-<section>-<env>.up.railway.app` (e.g. ...-production...).
 */
export function resolveServiceUrl(pathOrUrl: string): string {
  if (typeof window === "undefined") return pathOrUrl;

  const { path, suffix, isAbsolute } = splitPathAndSuffix(pathOrUrl);
  const pathname = path;
  const isDialerLeadsPath =
    pathname === "/api/outbound-dialer/leads" ||
    pathname.startsWith("/api/outbound-dialer/leads/");
  const isMonolithProductionHost =
    typeof window !== "undefined" &&
    window.location.hostname.toLowerCase() === "aoirail-production.up.railway.app";

  // On aoirail-production shell host, force the dialer leads endpoint to the data service.
  // The data service is the source of truth for large lead ownership reads.
  if (isMonolithProductionHost && isDialerLeadsPath) {
    const forcedDataBase = "https://aoirail-data-production.up.railway.app";
    const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `${forcedDataBase}${p}${suffix}`;
  }

  const dataBase =
    normalizeBase(viteEnvString("VITE_DATA_SERVICE_URL")) ||
    runtimeInjectedDataBase();
  const isConnectLocal = hasPrefix(pathname, CONNECT_LOCAL_PREFIXES);
  if (dataBase && hasPrefix(pathname, DATA_PREFIXES) && !isConnectLocal) {
    if (isAbsolute && (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://"))) {
      try {
        const u = new URL(pathOrUrl);
        return `${dataBase}${u.pathname}${u.search}${u.hash}`;
      } catch {
        return pathOrUrl;
      }
    }
    const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `${dataBase}${p}${suffix}`;
  }

  const twilioBase =
    normalizeBase(viteEnvString("VITE_TWILIO_SERVICE_URL")) || inferRailwayServiceBase("twilio");
  if (twilioBase && hasPrefix(pathname, TWILIO_PREFIXES)) {
    if (isAbsolute && (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://"))) {
      try {
        const u = new URL(pathOrUrl);
        return `${twilioBase}${u.pathname}${u.search}${u.hash}`;
      } catch {
        return pathOrUrl;
      }
    }
    const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `${twilioBase}${p}${suffix}`;
  }

  return pathOrUrl;
}

export function getServiceRequestCredentials(pathOrUrl: string): RequestCredentials {
  if (typeof window === "undefined") return "include";
  try {
    const target = new URL(pathOrUrl, window.location.origin);
    return target.origin === window.location.origin ? "include" : "omit";
  } catch {
    return "include";
  }
}
