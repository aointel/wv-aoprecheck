// server/proxy-gateway.ts
import express from "express";
import http from "http";

// server/section-paths.ts
var SECTION_PATH_PREFIXES = {
  shell: [
    "/api/auth",
    "/api/user",
    "/api/user-permissions",
    "/health",
    "/",
    "/dashboard",
    "/live",
    "/attached_assets",
    "/uploads",
    "/assets",
    "/@vite",
    "/verify",
    "/api/aoi-precheck",
    "/api/quality-rating",
    "/api/public/live-card",
    "/api/taalk/transfer-start",
    "/api/taalk/transfer-start-last",
    "/api/hppro",
    "/api/hppro-impact"
  ],
  api: [
    "/health",
    "/open-quality-survey",
    "/live",
    "/api/auth",
    "/api/user",
    "/api/notifications",
    "/api/billing",
    "/api/agent",
    "/api/producerlist",
    "/api/validate-producer-email",
    "/api/help",
    "/api/alex-ai",
    "/api/support",
    "/api/agent-activity",
    "/api/admin",
    "/api/attached_assets",
    "/api/video",
    "/api/accountability",
    "/api/aoi-meet",
    "/api/debug",
    "/api/gamification",
    "/api/vdp-calls",
    "/api/appointments",
    "/api/scheduler",
    "/api/user-permissions",
    "/api/webhook/remove-lead-by-phone",
    // Taalk/VDP posts here; must be allowed when SECTION=api (otherwise webhook looks “dead”)
    "/api/webhook/vdp-events",
    "/api/send-mga-email",
    "/api/aoi-precheck",
    "/api/bug-report",
    "/api/quality-rating",
    "/api/activity-card/report",
    "/api/public/live-card",
    "/api/hppro",
    "/api/hppro-impact"
  ],
  twilio: [
    "/health",
    "/open-quality-survey",
    "/live",
    "/voice",
    "/incoming",
    "/twiml",
    "/webhook/webrtc",
    "/incomingcall",
    "/api/electron/twilio",
    "/api/electron/webhook/webrtc",
    "/api/twilio",
    "/api/twilio-numbers",
    "/api/twilio-calls",
    "/api/twilio-call-stats",
    "/api/twilio-auto-sync",
    "/api/twilio/fix-attributions",
    "/api/twilio-task-route",
    "/api/taalk/transfer-start",
    "/api/taalk/transfer-start-last",
    "/api/dial-lead",
    "/api/sync-twilio-calls",
    "/api/inbound-calls",
    "/incomingcall-dial-action",
    "/api/outbound-dialer/initiate-call",
    "/api/outbound-dialer/end-call",
    "/api/outbound-dialer/update-call-status",
    "/api/outbound-dialer/recruit-candidates",
    "/lead-join",
    "/api/call-coaching",
    "/api/simple-outbound",
    "/api/twilio/",
    "/api/bug-report",
    "/api/quality-rating",
    "/api/activity-card/report",
    "/api/public/live-card"
  ],
  data: [
    "/health",
    "/api/agent-daily-stats",
    "/api/leads/request-leads",
    "/api/admin/force-refresh-leads",
    "/api/masterlead",
    "/api/appointments",
    "/api/scheduler",
    "/api/schedule",
    "/api/leasedialer/client-pending",
    "/api/leasedialer/health",
    "/api/leasedialer/cleanup",
    "/api/leasedialer/sync",
    "/api/leasedialer/release-to-pool",
    "/api/leasedialer/pool-status",
    "/api/leasedialer/callable-by-agent",
    "/api/leasedialer/flow-utilization",
    "/api/ccpro",
    "/api/call-connector-pro",
    "/api/agent-dial-metrics",
    "/api/twilio-calls",
    "/api/twilio-call-stats",
    "/api/sync-twilio-calls",
    "/api/twilio-auto-sync",
    "/api/twilio/fix-attributions",
    "/api/outbound-dialer/daily-stats",
    "/api/outbound-dialer/leads",
    "/api/outbound-dialer/leases",
    "/api/outbound-dialer/update-call-status",
    "/api/outbound-dialer/inbound-picked-up",
    "/api/outbound-dialer/lead-by-phone",
    "/api/twilio/taskrouter/assignment-debug",
    "/api/twilio/taskrouter/last-assignments",
    "/api/inbound-calls",
    "/api/activity-card/report"
  ],
  precheck: [
    "/health",
    "/api/getting-started",
    "/api/aoprecheck",
    "/",
    "/live",
    "/open-quality-survey",
    "/dashboard",
    "/login",
    "/assets",
    "/uploads",
    "/attached_assets",
    "/api/auth",
    "/api/users",
    "/api/team",
    "/api/precheck-manager",
    "/api/agent",
    "/api/verification",
    "/api/taalk/webhook",
    "/api/taalk/initiate-call",
    "/api/taalk/incoming-call",
    "/api/taalk/recording-complete",
    "/api/taalk/assign-agent",
    "/api/taalk/transfer-start",
    "/api/taalk/transfer-start-last",
    "/api/aoi-precheck",
    "/step2-webhook",
    "/agent-verify",
    "/client-verify",
    "/verification",
    "/verification-es",
    "/verification-results",
    "/api/objstore/recordings",
    "/api/bug-report",
    "/api/quality-rating",
    "/api/activity-card/report",
    "/api/public/live-card",
    "/app",
    "/home",
    "/console",
    "/precheck-app",
    "/ao-precheck",
    "/join",
    "/signup",
    "/start",
    "/onboarding",
    "/signin",
    "/reset",
    "/forgot",
    "/precheck",
    "/verify",
    "/ao-precheck-app.html",
    "/ao-precheck-onboarding.html",
    "/team/confirm"
  ],
  "precheck-admin": [
    "/health",
    "/",
    "/live",
    "/open-quality-survey",
    "/dashboard",
    "/login",
    "/assets",
    "/uploads",
    "/attached_assets",
    "/api/auth",
    "/api/agent",
    "/api/aoi-precheck",
    "/api/bug-report",
    "/api/quality-rating",
    "/api/activity-card/report",
    "/api/public/live-card"
  ],
  connect: [
    "/api/auth",
    "/api/agent-daily-stats",
    "/api/user",
    "/api/user-permissions",
    "/api/agent",
    "/api/billing",
    "/api/twilio",
    "/api/twilio/",
    "/api/twilio-task-route",
    "/webhook/webrtc",
    "/api/electron/twilio",
    "/api/electron/webhook/webrtc",
    "/health",
    "/",
    "/live",
    "/open-quality-survey",
    "/dashboard",
    "/login",
    "/assets",
    // masterlead + hot lead cache paths are served by SECTION=data; client uses resolveServiceUrl / VITE_DATA_SERVICE_URL
    "/api/outbound-dialer/save-disposition",
    "/api/outbound-dialer/disposition",
    "/api/outbound-dialer/end-call",
    "/api/outbound-dialer/leases",
    "/api/leasedialer/sync",
    "/api/outbound-dialer/recruit-candidates",
    "/api/connectnow",
    "/api/appointments",
    "/api/scheduler",
    "/api/schedule",
    "/api/dashboard/stats",
    "/api/dashboard/calls-fixed",
    "/api/dashboard/recent-calls",
    "/api/dashboard/user-stats",
    "/api/call-connector-pro",
    "/api/disclaimers",
    "/api/verification",
    "/api/step2-webhook",
    "/agent-verify",
    "/client-verify",
    "/verification",
    "/verification-es",
    "/verification-results",
    "/api/dialer",
    "/api/hotlead",
    "/api/outbound-dialer/power",
    "/api/outbound-dialer/daily-stats",
    "/api/outbound-dialer/local-presence",
    "/api/inbound-test-available-agents",
    "/api/aoi-connect",
    "/api/webhook/vdp-events",
    "/api/vdp",
    "/api/usage",
    "/api/agent-anomaly",
    "/api/agents",
    "/api/ccpro",
    "/api/recruit",
    "/api/ao-recruit",
    "/api/accountability",
    "/api/alex-ai",
    "/api/platform-training",
    "/api/help",
    "/api/taalk/campaigns",
    "/api/diagnostics",
    "/api/health",
    "/api/speed-test",
    "/api/speed-test-upload",
    "/api/user/credits",
    "/api/user/credit-status",
    "/api/billing/usage",
    "/api/billing/call",
    "/api/aoi-precheck",
    "/api/bug-report",
    "/api/quality-rating",
    "/api/activity-card/report",
    "/api/public/live-card",
    "/api/hppro",
    "/api/hppro-impact",
    "/api/connect",
    "/conference-test",
    "/onboarding",
    "/dashboard",
    "/uploads",
    "/attached_assets"
  ],
  recruit: [
    "/api/auth",
    "/api/user",
    "/api/user-permissions",
    "/api/agent",
    "/api/billing",
    "/api/twilio",
    "/api/twilio/",
    "/api/twilio-task-route",
    "/webhook/webrtc",
    "/api/electron/twilio",
    "/api/electron/webhook/webrtc",
    "/health",
    "/",
    "/live",
    "/open-quality-survey",
    "/dashboard",
    "/login",
    "/assets",
    "/api/recruit",
    "/api/ao-recruit",
    "/api/vdp",
    "/api/user",
    "/api/agents",
    "/api/usage",
    "/api/demo",
    "/api/live-call-board/presentations",
    "/api/live-call-board/recruit-stats",
    "/api/disclaimers/accept-call-connector-pro-recruit",
    "/api/vdp/recruit-hot-eligibility",
    "/api/recruit-hotleads/assign-to-agent",
    "/api/masterrecruit",
    "/api/masterlead",
    "/api/leasedialer/sync",
    "/api/outbound-dialer/leads",
    "/api/outbound-dialer/save-disposition",
    "/api/outbound-dialer/disposition",
    "/api/outbound-dialer/end-call",
    "/api/outbound-dialer/leases",
    "/api/outbound-dialer/lead-by-phone",
    "/api/outbound-dialer/inbound-picked-up",
    "/api/outbound-dialer/masterrecruit-queue",
    "/api/outbound-dialer/recruit-candidates",
    "/api/scheduler",
    "/api/schedule",
    "/api/inbound-calls",
    "/api/agent-anomaly",
    "/api/ccpro",
    "/api/accountability",
    "/api/alex-ai",
    "/api/platform-training",
    "/api/help",
    "/api/bug-report",
    "/api/quality-rating",
    "/api/activity-card/report",
    "/api/public/live-card",
    "/dashboard",
    "/uploads",
    "/attached_assets"
  ],
  stats: [
    "/api/auth",
    "/api/user",
    "/api/user-permissions",
    "/health",
    "/",
    "/live",
    "/open-quality-survey",
    "/dashboard",
    "/login",
    "/assets",
    "/uploads",
    "/attached_assets",
    "/api/live-call-board/stats",
    "/api/live-call-board/stats-legacy",
    "/api/live-call-board/agents",
    "/api/live-call-board/agents-legacy",
    "/api/live-call-board/teams",
    "/api/live-call-board/outbound-calls",
    "/api/live-call-board/outbound-stats",
    "/api/live-call-board/agent-outbound-stats",
    "/api/live-call-board/user-team-info",
    "/api/live-call-board/debug-scan",
    "/api/live-call-board/test-midnight-reset",
    "/api/live-call-board/reset-stats",
    "/api/agent-dial-metrics",
    "/api/aoi-reports",
    "/api/aoi-followups",
    "/api/connectnow-analytics",
    "/api/dashboard/agent-stats",
    "/api/dashboard/agent-performance",
    "/api/manager/dashboard",
    "/api/globe-market-by-state",
    "/api/billing/team-charges",
    "/api/admin/twilio-usage-yesterday",
    "/api/admin/usage-stats",
    "/api/bug-report",
    "/api/quality-rating",
    "/api/activity-card/report",
    "/api/public/live-card",
    "/dashboard",
    "/uploads",
    "/attached_assets"
  ]
};
function getSectionPathPrefixes(section) {
  return SECTION_PATH_PREFIXES[section];
}

// server/proxy-gateway.ts
process.env.TZ = "America/Los_Angeles";
process.on("uncaughtException", (err) => console.error("[proxy] uncaught:", err));
process.on("unhandledRejection", (r) => console.error("[proxy] rejection:", r));
function stripTrailing(s) {
  return (s || "").trim().replace(/\/+$/, "");
}
function svc(envKey) {
  const v = process.env[envKey] || "";
  if (!v) return "";
  return stripTrailing(v.startsWith("http") ? v : `https://${v}`);
}
function getServiceUrls() {
  return {
    shell: svc("RAILWAY_SERVICE_AOIRAIL_SHELL_URL"),
    connect: svc("RAILWAY_SERVICE_AOIRAIL_CONNECT_URL"),
    twilio: svc("RAILWAY_SERVICE_AOIRAIL_TWILIO_URL"),
    data: svc("RAILWAY_SERVICE_AOIRAIL_DATA_URL"),
    precheck: svc("RAILWAY_SERVICE_AOIRAIL_PRECHECK_URL"),
    precheckAdmin: svc("RAILWAY_SERVICE_AOIRAIL_PRECHECK_ADMIN_URL"),
    recruit: svc("RAILWAY_SERVICE_AOIRAIL_RECRUIT_URL"),
    stats: svc("RAILWAY_SERVICE_AOIRAIL_STATS_URL"),
    api: svc("RAILWAY_SERVICE_AOIRAIL_API_URL")
  };
}
function isPrecheckTracePath(path) {
  return path.startsWith("/dashboard/verification-start") || path.startsWith("/dashboard/ao-precheck") || path.startsWith("/dashboard/aoi-precheck-admin") || path.startsWith("/verification") || path.startsWith("/api/auth/session") || path.startsWith("/api/auth/login") || path.startsWith("/api/auth/logout") || path.startsWith("/login");
}
function resolveUpstream(path) {
  const urls = getServiceUrls();
  const matches = (prefixes) => prefixes.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));
  if (matches(getSectionPathPrefixes("twilio"))) return urls.twilio;
  if (matches(getSectionPathPrefixes("data"))) return urls.data;
  if (matches(getSectionPathPrefixes("precheck-admin"))) return urls.precheckAdmin;
  if (matches(getSectionPathPrefixes("precheck"))) return urls.precheck;
  if (matches(getSectionPathPrefixes("recruit"))) return urls.recruit;
  if (matches(getSectionPathPrefixes("stats"))) return urls.stats;
  if (matches(getSectionPathPrefixes("connect"))) return urls.connect;
  if (matches(getSectionPathPrefixes("api"))) return urls.api;
  return urls.shell || null;
}
async function proxyRequest(req, res, upstream) {
  const url = `${upstream}${req.url}`;
  const startedAt = Date.now();
  const trace = isPrecheckTracePath(req.path);
  const requestId = String(req.headers["x-request-id"] || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  try {
    const headers = {};
    for (const h of ["authorization", "cookie", "content-type", "x-user-email", "x-forwarded-for", "user-agent", "x-desktop-app"]) {
      const v = req.headers[h];
      if (v) headers[h] = Array.isArray(v) ? v.join(", ") : v;
    }
    headers["x-forwarded-host"] = req.hostname;
    headers["x-forwarded-proto"] = "https";
    headers["x-request-id"] = requestId;
    if (trace) {
      const hasCookie = typeof req.headers.cookie === "string" && req.headers.cookie.length > 0;
      const hasAuth = typeof req.headers.authorization === "string" && req.headers.authorization.length > 0;
      const desktopApp = req.headers["x-desktop-app"];
      const userEmail = req.headers["x-user-email"];
      console.log(
        `[proxy-trace] -> ${requestId} ${req.method} ${req.originalUrl} upstream=${upstream} cookie=${hasCookie} auth=${hasAuth} desktop=${desktopApp ? "1" : "0"} email=${Array.isArray(userEmail) ? userEmail.join(",") : userEmail || "-"}`
      );
    }
    const hasBody = ["POST", "PUT", "PATCH"].includes(req.method);
    let bodyInit;
    if (hasBody) {
      if (req.body && typeof req.body === "object") {
        bodyInit = JSON.stringify(req.body);
        headers["content-type"] = headers["content-type"] || "application/json";
      }
    }
    const fetchRes = await fetch(url, {
      method: req.method,
      headers,
      body: bodyInit
    });
    if (trace) {
      const location = fetchRes.headers.get("location");
      const hasSetCookie = fetchRes.headers.has("set-cookie");
      const durationMs = Date.now() - startedAt;
      console.log(
        `[proxy-trace] <- ${requestId} status=${fetchRes.status} durationMs=${durationMs} location=${location || "-"} setCookie=${hasSetCookie ? "1" : "0"}`
      );
    }
    res.status(fetchRes.status);
    fetchRes.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    const buf = await fetchRes.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    console.error(`[proxy] ${req.method} ${url} error:`, err?.message);
    if (trace) {
      const durationMs = Date.now() - startedAt;
      console.error(`[proxy-trace] xx ${requestId} durationMs=${durationMs} error=${err?.message || err}`);
    }
    if (!res.headersSent) {
      res.status(502).json({ error: "Bad gateway", upstream, path: req.url });
    }
  }
}
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.get("/health", (_req, res) => {
  res.json({ ok: true, mode: "proxy-gateway", ts: (/* @__PURE__ */ new Date()).toISOString(), services: getServiceUrls() });
});
app.all("*", async (req, res) => {
  const upstream = resolveUpstream(req.path);
  if (!upstream) {
    return res.status(404).json({ error: "No upstream for path", path: req.path });
  }
  await proxyRequest(req, res, upstream);
});
var port = parseInt(process.env.PORT || "5000", 10);
var server = http.createServer(app);
server.listen(port, "0.0.0.0", () => {
  console.error(`[AOIrail] proxy-gateway listening on port ${port}`);
  console.error(`[AOIrail] upstream services:`, JSON.stringify(getServiceUrls(), null, 2));
});
export {
  proxyRequest,
  resolveUpstream
};
