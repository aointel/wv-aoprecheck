/**
 * Proxy gateway entry point.
 * When deployed on the AOIrail monolith service with PROXY_MODE=true,
 * this replaces the monolith entirely — all requests are forwarded to
 * the correct cluster service based on path.
 *
 * Build:  esbuild server/proxy-gateway.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/proxy-gateway.js
 * Start:  node dist/proxy-gateway.js   (set PROXY_MODE=true or just use this as start command)
 *
 * Env vars (set on AOIrail Railway service):
 *   RAILWAY_SERVICE_AOIRAIL_SHELL_URL
 *   RAILWAY_SERVICE_AOIRAIL_CONNECT_URL
 *   RAILWAY_SERVICE_AOIRAIL_TWILIO_URL
 *   RAILWAY_SERVICE_AOIRAIL_DATA_URL
 *   RAILWAY_SERVICE_AOIRAIL_PRECHECK_URL
 *   RAILWAY_SERVICE_AOIRAIL_PRECHECK_ADMIN_URL
 *   RAILWAY_SERVICE_AOIRAIL_RECRUIT_URL
 *   RAILWAY_SERVICE_AOIRAIL_STATS_URL
 *   RAILWAY_SERVICE_AOIRAIL_API_URL
 */
import express, { type Request, type Response } from "express";
import http from "http";
import { getSectionPathPrefixes } from "./section-paths";

process.env.TZ = "America/Los_Angeles";

process.on("uncaughtException", (err) => console.error("[proxy] uncaught:", err));
process.on("unhandledRejection", (r) => console.error("[proxy] rejection:", r));

function stripTrailing(s: string): string {
  return (s || "").trim().replace(/\/+$/, "");
}

function svc(envKey: string): string {
  const v = process.env[envKey] || "";
  if (!v) return "";
  return stripTrailing(v.startsWith("http") ? v : `https://${v}`);
}

function getServiceUrls() {
  return {
    shell:         svc("RAILWAY_SERVICE_AOIRAIL_SHELL_URL"),
    connect:       svc("RAILWAY_SERVICE_AOIRAIL_CONNECT_URL"),
    twilio:        svc("RAILWAY_SERVICE_AOIRAIL_TWILIO_URL"),
    data:          svc("RAILWAY_SERVICE_AOIRAIL_DATA_URL"),
    precheck:      svc("RAILWAY_SERVICE_AOIRAIL_PRECHECK_URL"),
    precheckAdmin: svc("RAILWAY_SERVICE_AOIRAIL_PRECHECK_ADMIN_URL"),
    recruit:       svc("RAILWAY_SERVICE_AOIRAIL_RECRUIT_URL"),
    stats:         svc("RAILWAY_SERVICE_AOIRAIL_STATS_URL"),
    api:           svc("RAILWAY_SERVICE_AOIRAIL_API_URL"),
  };
}

function isPrecheckTracePath(path: string): boolean {
  return (
    path.startsWith("/dashboard/verification-start") ||
    path.startsWith("/dashboard/ao-precheck") ||
    path.startsWith("/dashboard/aoi-precheck-admin") ||
    path.startsWith("/verification") ||
    path.startsWith("/api/auth/session") ||
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/logout") ||
    path.startsWith("/login")
  );
}

export function resolveUpstream(path: string): string | null {
  const urls = getServiceUrls();
  const matches = (prefixes: readonly string[]) =>
    prefixes.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));

  if (matches(getSectionPathPrefixes("twilio")))        return urls.twilio;
  if (matches(getSectionPathPrefixes("data")))          return urls.data;
  if (matches(getSectionPathPrefixes("precheck-admin")))return urls.precheckAdmin;
  if (matches(getSectionPathPrefixes("precheck")))      return urls.precheck;
  if (matches(getSectionPathPrefixes("recruit")))       return urls.recruit;
  if (matches(getSectionPathPrefixes("stats")))         return urls.stats;
  if (matches(getSectionPathPrefixes("connect")))       return urls.connect;
  if (matches(getSectionPathPrefixes("api")))           return urls.api;
  // everything else (SPA, assets, non-api) → shell
  return urls.shell || null;
}

export async function proxyRequest(req: Request, res: Response, upstream: string): Promise<void> {
  const url = `${upstream}${req.url}`;
  const startedAt = Date.now();
  const trace = isPrecheckTracePath(req.path);
  const requestId = String(req.headers["x-request-id"] || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  try {
    const headers: Record<string, string> = {};
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
        `[proxy-trace] -> ${requestId} ${req.method} ${req.originalUrl} upstream=${upstream} cookie=${hasCookie} auth=${hasAuth} desktop=${desktopApp ? "1" : "0"} email=${Array.isArray(userEmail) ? userEmail.join(",") : (userEmail || "-")}`,
      );
    }

    const hasBody = ["POST", "PUT", "PATCH"].includes(req.method);
    let bodyInit: BodyInit | undefined;
    if (hasBody) {
      if (req.body && typeof req.body === "object") {
        bodyInit = JSON.stringify(req.body);
        headers["content-type"] = headers["content-type"] || "application/json";
      }
    }

    const fetchRes = await fetch(url, {
      method: req.method,
      headers,
      body: bodyInit,
    });

    if (trace) {
      const location = fetchRes.headers.get("location");
      const hasSetCookie = fetchRes.headers.has("set-cookie");
      const durationMs = Date.now() - startedAt;
      console.log(
        `[proxy-trace] <- ${requestId} status=${fetchRes.status} durationMs=${durationMs} location=${location || "-"} setCookie=${hasSetCookie ? "1" : "0"}`,
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
  } catch (err: any) {
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

// Standalone server
const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// CORS
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, mode: "proxy-gateway", ts: new Date().toISOString(), services: getServiceUrls() });
});

app.all("*", async (req, res) => {
  const upstream = resolveUpstream(req.path);
  if (!upstream) {
    return res.status(404).json({ error: "No upstream for path", path: req.path });
  }
  await proxyRequest(req, res, upstream);
});

const port = parseInt(process.env.PORT || "5000", 10);
const server = http.createServer(app);
server.listen(port, "0.0.0.0", () => {
  console.error(`[AOIrail] proxy-gateway listening on port ${port}`);
  console.error(`[AOIrail] upstream services:`, JSON.stringify(getServiceUrls(), null, 2));
});
