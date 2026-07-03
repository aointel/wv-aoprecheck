/**
 * Shell section routes - SPA + reverse proxy to cluster services.
 * connectnow.one lands here. All /api/* and webhook paths are proxied
 * to the correct cluster service based on section-paths allowlists.
 * Non-API paths serve the SPA.
 */
import type { Express, Request, Response } from "express";
import { getSectionPathPrefixes } from "../section-paths";

function stripTrailing(s: string): string {
  return (s || "").trim().replace(/\/+$/, "");
}

function getServiceUrls() {
  return {
    twilio:       stripTrailing(process.env.RAILWAY_SERVICE_AOIRAIL_TWILIO_URL       ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_TWILIO_URL}`       : ""),
    connect:      stripTrailing(process.env.RAILWAY_SERVICE_AOIRAIL_CONNECT_URL      ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_CONNECT_URL}`      : ""),
    data:         stripTrailing(process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL         ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL}`         : ""),
    precheck:     stripTrailing(process.env.RAILWAY_SERVICE_AOIRAIL_PRECHECK_URL     ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_PRECHECK_URL}`     : ""),
    precheckAdmin:stripTrailing(process.env.RAILWAY_SERVICE_AOIRAIL_PRECHECK_ADMIN_URL ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_PRECHECK_ADMIN_URL}` : ""),
    recruit:      stripTrailing(process.env.RAILWAY_SERVICE_AOIRAIL_RECRUIT_URL      ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_RECRUIT_URL}`      : ""),
    stats:        stripTrailing(process.env.RAILWAY_SERVICE_AOIRAIL_STATS_URL        ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_STATS_URL}`        : ""),
    api:          stripTrailing(process.env.RAILWAY_SERVICE_AOIRAIL_API_URL          ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_API_URL}`          : ""),
  };
}

/** Resolve which upstream base URL should handle this path. */
function resolveUpstream(path: string, urls: ReturnType<typeof getServiceUrls>): string | null {
  const twilioPrefixes = getSectionPathPrefixes("twilio");
  const dataPrefixes = getSectionPathPrefixes("data");
  const precheckPrefixes = getSectionPathPrefixes("precheck");
  const precheckAdminPrefixes = getSectionPathPrefixes("precheck-admin");
  const recruitPrefixes = getSectionPathPrefixes("recruit");
  const statsPrefixes = getSectionPathPrefixes("stats");
  const connectPrefixes = getSectionPathPrefixes("connect");
  const apiPrefixes = getSectionPathPrefixes("api");

  const matches = (prefixes: readonly string[]) =>
    prefixes.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));

  // AO Recruit currently runs on monolith routes hosted by connect service.
  // Keep recruit APIs pinned here until routes-sections/routes-recruit.ts is fully extracted.
  if (path === "/api/recruit" || path.startsWith("/api/recruit/") || path === "/api/ao-recruit" || path.startsWith("/api/ao-recruit/")) {
    return urls.connect || null;
  }

  // Order matters — more specific first
  if (matches(twilioPrefixes))       return urls.twilio;
  if (matches(dataPrefixes))         return urls.data;
  if (matches(precheckAdminPrefixes))return urls.precheckAdmin;
  if (matches(precheckPrefixes))     return urls.precheck;
  if (matches(recruitPrefixes))      return urls.recruit;
  if (matches(statsPrefixes))        return urls.stats;
  if (matches(connectPrefixes))      return urls.connect;
  if (matches(apiPrefixes))          return urls.api;

  return null;
}

async function proxyRequest(req: Request, res: Response, upstream: string): Promise<void> {
  const url = `${upstream}${req.url}`;
  const isAccessCheckPath = req.path.startsWith("/api/call-connector-pro/access-check/");
  const accessCheckEmail = isAccessCheckPath
    ? decodeURIComponent(req.path.replace("/api/call-connector-pro/access-check/", "")).toLowerCase().trim()
    : "";
  const shouldFailOpenAccessCheck = isAccessCheckPath && accessCheckEmail.endsWith("@aoglobelife.com");
  try {
    const headers: Record<string, string> = {};
    // Forward relevant headers
    for (const h of ["authorization", "cookie", "content-type", "x-user-email", "x-forwarded-for", "user-agent"]) {
      const v = req.headers[h];
      if (v) headers[h] = Array.isArray(v) ? v.join(", ") : v;
    }
    headers["x-forwarded-host"] = req.hostname;
    headers["x-forwarded-proto"] = "https";

    const hasBody = ["POST", "PUT", "PATCH"].includes(req.method) && req.body;
    const bodyStr = hasBody ? JSON.stringify(req.body) : undefined;

    const fetchRes = await fetch(url, {
      method: req.method,
      headers,
      body: bodyStr,
      // @ts-ignore
      duplex: "half",
    });

    // Keep Connect UI stable for internal agents when connect service is intermittently unhealthy.
    if (shouldFailOpenAccessCheck && fetchRes.status >= 500) {
      return res.status(200).json({
        success: false,
        hasAccess: true,
        hasDismissedPrimer: false,
        source: `shell_proxy_fail_open_${fetchRes.status}`,
      });
    }

    res.status(fetchRes.status);
    fetchRes.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const body = await fetchRes.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (err: any) {
    console.error(`[shell proxy] ${req.method} ${url} error:`, err?.message || err);
    if (shouldFailOpenAccessCheck) {
      return res.status(200).json({
        success: false,
        hasAccess: true,
        hasDismissedPrimer: false,
        source: "shell_proxy_fail_open_error",
      });
    }
    res.status(502).json({ error: "Bad gateway", upstream, path: req.url });
  }
}

/** Map of SPA page prefixes to the section service that owns them. */
const PAGE_TO_SECTION: Array<{ prefix: string; section: keyof ReturnType<typeof getServiceUrls> }> = [
  { prefix: "/dashboard/connect", section: "connect" },
  { prefix: "/connect", section: "connect" },
  // NOTE: /dashboard/verification* is intentionally NOT proxied to the precheck service here.
  // The SPA loads from the shell; only /api/* calls proxy to precheck. Proxying the HTML page
  // from the precheck service breaks session auth in Electron (different session store).
  // { prefix: "/dashboard/verification", section: "precheck" },
  { prefix: "/dashboard/aoi-precheck-admin", section: "precheckAdmin" },
  // AO Recruit page must use connect service until recruit section has full route extraction.
  { prefix: "/dashboard/ao-recruit", section: "connect" },
  { prefix: "/dashboard/live-call-board", section: "stats" },
  { prefix: "/dashboard/leaderboard", section: "stats" },
  { prefix: "/dashboard/aoi-reports", section: "stats" },
];

export async function registerShellRoutes(app: Express): Promise<void> {
  console.log("🔧 Registering Shell section routes (proxy + page routing)...");

  app.get("/health", (_req, res) => {
    res.json({ ok: true, section: "shell", ts: new Date().toISOString() });
  });

  // Railway/runtime health checks must not depend on upstream section availability.
  app.all("/api/health", (_req, res) => {
    res.status(200).json({ ok: true, section: "shell", ts: new Date().toISOString() });
  });

  // Proxy all /api/* and known webhook paths to the right cluster service
  app.all("/api/*", async (req, res) => {
    const urls = getServiceUrls();
    const upstream = resolveUpstream(req.path, urls);
    if (!upstream) {
      return res.status(404).json({ error: "No cluster service for this path", path: req.path });
    }
    await proxyRequest(req, res, upstream);
  });

  // Twilio webhooks and non-api paths that go to specific services
  const webhookPrefixes = ["/voice", "/incoming", "/twiml", "/webhook", "/incomingcall", "/lead-join",
                           "/agent-verify", "/client-verify", "/verification", "/verification-es",
                           "/open-quality-survey", "/step2-webhook", "/verification-results"];

  for (const prefix of webhookPrefixes) {
    app.all(`${prefix}*`, async (req, res) => {
      const urls = getServiceUrls();
      const upstream = resolveUpstream(req.path, urls);
      if (!upstream) {
        return res.status(404).json({ error: "No cluster service for this path", path: req.path });
      }
      await proxyRequest(req, res, upstream);
    });
  }

  // SPA page proxy: for HTML page requests that belong to a section service,
  // proxy the full response (including JS/CSS assets) from that service.
  // This means /dashboard/connect proxies to aoirail-connect so the full app loads.
  app.get("*", async (req, res, next) => {
    const urls = getServiceUrls();
    const matched = PAGE_TO_SECTION.find(({ prefix }) =>
      req.path === prefix || req.path.startsWith(prefix + "/") || req.path.startsWith(prefix + "?")
    );
    if (!matched) return next();
    const upstream = urls[matched.section];
    if (!upstream) return next();
    await proxyRequest(req, res, upstream);
  });

  console.log("✅ Shell section routes registered (proxy + page routing)");
}
