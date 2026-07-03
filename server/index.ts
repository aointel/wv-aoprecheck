import express, { type Request, Response, NextFunction } from "express";
import http from "http";
import session from "express-session";
import path from "path";
import fs from "fs";
import { File } from "node:buffer";
import { registerRoutes } from "./routes";
import { isPathAllowedForSection, SECTION_NAMES, type SectionName } from "./section-paths";
import { jwtAuthMiddleware } from "./jwt-auth-middleware";

// Polyfill global File for OpenAI Whisper (and other file uploads) on Node < 20
if (typeof globalThis.File === "undefined") {
  (globalThis as any).File = File;
}

// Set server timezone to PST
process.env.TZ = 'America/Los_Angeles';

// Suppress console output in production for performance
if (process.env.NODE_ENV === "production") {
  // Keep errors if you want; otherwise remove those too.
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  console.warn = () => {};
  // optional: keep errors
  // console.error = () => {};
}

import { setupVite, serveStatic, log } from "./vite";
import twilio from 'twilio';
import { localPresenceService } from './local-presence-service';
import { storage } from "./storage";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, SESSION_SECRET, NODE_ENV, HARDCODED_CONFIG, TWILIO_PHONE_NUMBER } from './hardcoded-config';
import { getRedisUrl } from './redis-config';
import { supabaseAdmin } from './supabase';
import { resolveAgentEmailFromRequest } from './resolve-agent-email.js';
import { pool } from './db';
import { getConnectClientDataServiceUrl } from './external-service-urls';
import { formatToE164 } from './phone-utils';
import { ensurePublicLiveCardTables, seedChrisLiveLink } from './public-live-card-service';
import { perfStore, requestPerfMiddleware } from "./perf-observability";
import { getTwilioCallBySidLocal, upsertTwilioCallLogLocal } from "./local-hot-tables";
import { isHotTablesEodOnly } from "./hot-table-mode";

const app = express();

// Declare global type for server start time
declare global {
  var serverStartTime: number | undefined;
}

// Store server start time for version checking (persists across requests)
if (!global.serverStartTime) {
  global.serverStartTime = Date.now();
}

// GLOBAL ERROR HANDLERS - Prevent crashes from unhandled errors
process.on('uncaughtException', (error: Error) => {
  console.error('❌ UNCAUGHT EXCEPTION - Preventing crash:', error);
  console.error('Stack:', error.stack);
  // Log and continue - do not exit (keeps server running)
  console.error('⚠️ Server continuing despite uncaught exception');
});

const noisyRejectionSubstrings = ['ConnectTimeoutError', 'fetch failed', 'UND_ERR_CONNECT_TIMEOUT'];
const lastUnhandledRejectionLogByKey = new Map<string, number>();
const UNHANDLED_REJECTION_SAMPLE_MS = 60_000;

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  const isNoisy = noisyRejectionSubstrings.some((s) => msg.includes(s));
  if (isNoisy) {
    const key = noisyRejectionSubstrings.find((s) => msg.includes(s)) || 'noisy';
    const now = Date.now();
    const last = lastUnhandledRejectionLogByKey.get(key) ?? 0;
    if (now - last < UNHANDLED_REJECTION_SAMPLE_MS) {
      return;
    }
    lastUnhandledRejectionLogByKey.set(key, now);
  }
  console.error('❌ UNHANDLED REJECTION - Preventing crash:', reason);
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
  // Log and continue - do not exit (keeps server running in both dev and production)
  console.error('⚠️ Server continuing despite unhandled rejection');
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Redis health check — hit /api/redis-health to verify Redis is connected and working
app.get('/api/redis-health', async (req, res) => {
  try {
    if (!redisClient) {
      return res.status(200).json({
        status: 'disabled',
        message: 'No Redis client (set REDIS_URL or deploy on Railway for hardcoded internal Redis)',
      });
    }
    const testKey = 'redis_health_check';
    await redisClient.set(testKey, 'ok', { EX: 10 });
    const val = await redisClient.get(testKey);
    const info = await redisClient.info('server').catch(() => '');
    const versionMatch = info.match(/redis_version:(.+)/);
    return res.status(200).json({
      status: val === 'ok' ? 'connected' : 'error',
      redis_version: versionMatch?.[1]?.trim() || 'unknown',
      write_read_test: val === 'ok' ? 'PASS' : 'FAIL',
      url_prefix: REDIS_URL ? REDIS_URL.substring(0, 30) + '...' : 'not set',
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

const isPrecheckSection = String(process.env.SECTION || "").toLowerCase() === "precheck";

// /dashboard has no server route; redirect to the default landing for this SECTION.
// Electron or links often hit /dashboard directly — without this we 404 before the SPA loads.
app.get("/dashboard", (_req, res) =>
  res.redirect(302, isPrecheckSection ? "/dashboard/verification-start" : "/dashboard/connect"),
);
// Keep legacy/direct connect URLs working in segmented deployments.
app.get("/connect", (_req, res) =>
  res.redirect(302, isPrecheckSection ? "/dashboard/verification-start" : "/dashboard/connect"),
);

if (isPrecheckSection) {
  // Landing/auth/onboarding handled by registerAoPrecheckRoutes (routes-aoprecheck.ts).
}

// Sync handlers for / and /dashboard/* — serve index.html (before async setup).
// Any built deploy (production or staging on Railway); dev uses Vite catch-all.
const isProd = process.env.NODE_ENV === "production";
const distPath = path.resolve(process.cwd(), "dist", "public");
const indexPath = path.join(distPath, "index.html");
const spaIndexPath = path.join(distPath, "spa-index.html");
const isBuiltDeploy =
  process.env.NODE_ENV !== "development" && fs.existsSync(indexPath);
console.log(`[startup] isBuiltDeploy=${isBuiltDeploy} indexPath=${indexPath} exists=${fs.existsSync(indexPath)} spaIndex=${fs.existsSync(spaIndexPath)} NODE_ENV=${process.env.NODE_ENV} AOIRAIL_DATA_SERVICE_URL=${process.env.AOIRAIL_DATA_SERVICE_URL || 'not set'}`);

function sendHtmlFile(htmlFilePath: string, req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "text/html");
  // Segmented Connect: tell the SPA the data service origin without requiring VITE_* at build time.
  const dataUrl = process.env.AOIRAIL_DATA_SERVICE_URL || process.env.DATA_SERVICE_URL ||
    (process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL}` : "https://aoirail-data-production.up.railway.app");
  res.setHeader("X-AOIrail-SendIndex", "1");
  console.log(`[sendHtmlFile] path=${req.path} file=${path.basename(htmlFilePath)} dataUrl=${dataUrl}`);
  if (dataUrl) {
    try {
      const html = fs.readFileSync(htmlFilePath, "utf8");
      const inject = `<script>window.__AOIRAIL_DATA_SERVICE_URL__=${JSON.stringify(dataUrl)};</script>`;
      const out = html.includes("</head>") ? html.replace("</head>", `${inject}</head>`) : `${inject}${html}`;
      res.status(200).send(out);
      return;
    } catch (e: any) {
      console.log(`[sendHtmlFile] readFile failed: ${e?.message}`);
      // fall through to static file
    }
  }
  res.sendFile(htmlFilePath);
}

function sendIndex(req: Request, res: Response) {
  sendHtmlFile(indexPath, req, res);
}

/** React verification SPA — preserved as spa-index.html when onboarding overwrites index.html. */
function sendSpaIndex(req: Request, res: Response) {
  const htmlPath = fs.existsSync(spaIndexPath) ? spaIndexPath : indexPath;
  sendHtmlFile(htmlPath, req, res);
}

if (isBuiltDeploy) {
  app.use((req, _res, next) => {
    if (/^\/dashboard\//.test(req.path)) {
      console.log(`[INTERCEPT-TEST] path=${req.path} method=${req.method}`);
    }
    next();
  });
  if (isPrecheckSection) {
    // Auth landing (/, /login, …) is handled by registerAoPrecheckRoutes; dashboard needs the React SPA.
    app.get(/^\/dashboard\/.*/, sendSpaIndex);
  } else {
    app.get("/", sendIndex);
    app.get(/^\/dashboard\/.*/, sendIndex);
  }
  app.get("/downloads", sendIndex);
  app.get("/downlaods", (_req, res) => res.redirect(302, "/downloads"));
}

// HPPRO Proxy — registered before SPA catch-all
import('./hppro-proxy.js').then(({ default: hpproProxy, impactRouter }: any) => {
  // ── eApp-pending routes MUST be registered before the catch-all proxy ──
  // app.use('/api/hppro', hpproProxy) swallows ALL /api/hppro/* so these
  // specific routes must come first.
  // resolveAgentEmailFromRequest and supabaseAdmin are already imported at top level
  app.get('/api/hppro/eapp-pending', async (req: any, res: any) => {
    try {
      const email = await resolveAgentEmailFromRequest(req);
      if (!email) return res.status(401).json({ pending: null, error: 'unauthorized' });
      const { rows } = await pool.query(
        `SELECT id, presentation_guid, inject_payload, what_happened, created_at
         FROM hppro_eapp_pending
         WHERE agent_email = $1 AND consumed_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [email]
      );
      if (!rows.length) return res.json({ pending: null });
      const data = rows[0];
      return res.json({ pending: { id: data.id, presentation_guid: data.presentation_guid, what_happened: data.what_happened, inject: data.inject_payload } });
    } catch (e: any) { return res.status(500).json({ pending: null, error: e.message }); }
  });

  app.post('/api/hppro/eapp-pending/:id/ack', async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: 'bad_id' });
      const email = await resolveAgentEmailFromRequest(req);
      if (!email) return res.status(401).json({ ok: false, error: 'unauthorized' });
      const { rows } = await pool.query(`SELECT id, agent_email FROM hppro_eapp_pending WHERE id = $1`, [id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      if (String(rows[0].agent_email).toLowerCase() !== email) return res.status(403).json({ ok: false, error: 'forbidden' });
      await pool.query(`UPDATE hppro_eapp_pending SET consumed_at = NOW() WHERE id = $1 AND agent_email = $2`, [id, email]);
      return res.json({ ok: true });
    } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); }
  });
  // ── end eApp-pending routes ──

  app.use('/api/hppro', hpproProxy);
  app.use('/api/hppro-impact', impactRouter);
  // S3 PDF proxy - routes CORS-blocked S3 PDFs through our server
  // Generic external content proxy for any remaining external domains
  app.get('/api/hppro-ext/:domain/*', async (req: any, res: any) => {
    try {
      const domain = req.params.domain;
      const path = req.params[0];
      const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
      const originalUrl = 'https://' + domain + '/' + path + qs;
      console.log('[EXT Proxy] Fetching:', originalUrl.substring(0, 100));
      const extRes = await (global as any).fetch(originalUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://hppro.planetaltig.com/' } });
      res.status(extRes.status);
      res.setHeader('Access-Control-Allow-Origin', '*');
      const ct = extRes.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', ct);
      const buf = await extRes.arrayBuffer();
      res.send(Buffer.from(buf));
    } catch(e: any) {
      res.status(502).json({ error: 'External proxy error', message: e.message });
    }
  });
  app.get('/api/hppro-s3/*', async (req: any, res: any) => {
    try {
      // Reconstruct S3 URL - the full URL path is everything after /api/hppro-s3/
      const s3Key = req.params[0];
      const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
      // Try to extract original bucket from referer or use generic S3 path
      const originalUrl = 'https://alt-imp-globe-groupletter-prod.s3.amazonaws.com/' + s3Key + qs;
      console.log('[S3 Proxy] Fetching:', originalUrl.substring(0, 100));
      const s3Res = await (global as any).fetch(originalUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      res.status(s3Res.status);
      res.setHeader('Access-Control-Allow-Origin', '*');
      const ct = s3Res.headers.get('content-type') || 'application/pdf';
      res.setHeader('Content-Type', ct);
      const buf = await s3Res.arrayBuffer();
      res.send(Buffer.from(buf));
    } catch(e: any) {
      res.status(502).json({ error: 'S3 proxy error', message: e.message });
    }
  });
  // S3 PDF proxy - routes CORS-blocked S3 PDFs through our server
  // Generic external content proxy for any remaining external domains
  app.get('/api/hppro-ext/:domain/*', async (req: any, res: any) => {
    try {
      const domain = req.params.domain;
      const path = req.params[0];
      const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
      const originalUrl = 'https://' + domain + '/' + path + qs;
      console.log('[EXT Proxy] Fetching:', originalUrl.substring(0, 100));
      const extRes = await (global as any).fetch(originalUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://hppro.planetaltig.com/' } });
      res.status(extRes.status);
      res.setHeader('Access-Control-Allow-Origin', '*');
      const ct = extRes.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', ct);
      const buf = await extRes.arrayBuffer();
      res.send(Buffer.from(buf));
    } catch(e: any) {
      res.status(502).json({ error: 'External proxy error', message: e.message });
    }
  });
  app.get('/api/hppro-s3/*', async (req: any, res: any) => {
    try {
      // Reconstruct S3 URL - the full URL path is everything after /api/hppro-s3/
      const s3Key = req.params[0];
      const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
      // Try to extract original bucket from referer or use generic S3 path
      const originalUrl = 'https://alt-imp-globe-groupletter-prod.s3.amazonaws.com/' + s3Key + qs;
      console.log('[S3 Proxy] Fetching:', originalUrl.substring(0, 100));
      const s3Res = await (global as any).fetch(originalUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      res.status(s3Res.status);
      res.setHeader('Access-Control-Allow-Origin', '*');
      const ct = s3Res.headers.get('content-type') || 'application/pdf';
      res.setHeader('Content-Type', ct);
      const buf = await s3Res.arrayBuffer();
      res.send(Buffer.from(buf));
    } catch(e: any) {
      res.status(502).json({ error: 'S3 proxy error', message: e.message });
    }
  });
  // Catch bare HPPRO paths that escape the proxy (SPA internal navigation)
  app.get('/Account/Login', (_req: any, res: any) => res.redirect(302, '/api/hppro/Account/Login'));
  app.post('/Account/Login', (req: any, res: any) => { req.url = '/Account/Login'; (hpproProxy as any)(req, res, () => {}); });
  app.get('/Account/Logout', (_req: any, res: any) => res.redirect(302, '/api/hppro/Account/Login'));
  // Catch requests from HPPRO iframe that escape the proxy (based on Referer)
  // Only catch HTML page navigations, not asset/image requests
  app.use((req: any, res: any, next: any) => {
    const referer = req.headers.referer || req.headers.referrer || '';
    if (referer.includes('/api/hppro') && !req.path.startsWith('/api/') && !req.path.startsWith('/assets/') && !req.path.startsWith('/src/')) {
      req.url = req.path + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
      return (hpproProxy as any)(req, res, next);
    }
    next();
  });
}).catch((err: any) => console.error('Failed to load hppro-proxy:', err));

// CORS - fully permissive
app.use((req: any, res: any, next: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Session store — Redis if REDIS_URL is set, fallback to MemoryStore for local dev
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';

let sessionStore: any;
let redisClient: any = null;

const REDIS_URL = getRedisUrl();

if (REDIS_URL) {
  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err: Error) => console.error('Redis error:', err.message));
    redisClient.on('connect', () => console.log('✅ Redis connected — using RedisStore for sessions'));
    sessionStore = new RedisStore({ client: redisClient, prefix: 'sess:' });
    console.log('✅ Session store: Redis (URL from env or hardcoded-config via getRedisUrl)');
  } catch (err: any) {
    console.warn('⚠️ Redis setup failed, falling back to MemoryStore:', err.message);
    const MemoryStore = (session as any).MemoryStore;
    sessionStore = MemoryStore ? new MemoryStore() : undefined;
  }
} else {
  console.warn('⚠️ No Redis URL — using MemoryStore (set REDIS_URL on Railway or run on Railway for internal fallback)');
  const MemoryStore = (session as any).MemoryStore;
  sessionStore = MemoryStore ? new MemoryStore() : undefined;
}

export { sessionStore, redisClient };

// Session middleware — must run BEFORE the Electron-only gate so the gate can
// check req.session.user?.email for browser-exception users.
app.use(session({
  store: sessionStore ?? undefined,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Browser redirect removed - all browsers allowed.

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Check if attached_assets folder exists, log warning if not
const attachedAssetsPath = path.join(process.cwd(), 'attached_assets');
if (!fs.existsSync(attachedAssetsPath)) {
  console.error('⚠️ WARNING: attached_assets folder does not exist at:', attachedAssetsPath);
  console.error('⚠️ Video files will not be available. Check Git LFS configuration.');
} else {
  console.log('✅ attached_assets folder found at:', attachedAssetsPath);
  const files = fs.readdirSync(attachedAssetsPath);
  console.log('✅ Files in attached_assets:', files.length, 'files');
  
  // Check video file size to ensure it's not just an LFS pointer
  const videoFile = path.join(attachedAssetsPath, 'ao_globe_life_company_overview_-_dani_jankowski (1080p) (1)_1759594958661.mp4');
  if (fs.existsSync(videoFile)) {
    const stats = fs.statSync(videoFile);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📹 Video file size: ${sizeMB} MB`);
    if (stats.size < 1000000) {
      console.error('⚠️ WARNING: Video file is suspiciously small - might be Git LFS pointer!');
      console.error('⚠️ Expected: ~108 MB, Got:', sizeMB, 'MB');
    }
  }
}

// Serve attached assets with proper video streaming support
app.use('/attached_assets', express.static(attachedAssetsPath, {
  setHeaders: (res, filePath) => {
    // Force correct MIME type for video files
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes'); // Enable range requests for video streaming
    }
  }
}));
// Increase payload limits for large CSV imports
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(requestPerfMiddleware);

app.get("/api/admin/perf/summary", (_req, res) => {
  res.json({ ok: true, ...perfStore.getSummary(30) });
});

app.post("/api/admin/perf/reset", (_req, res) => {
  perfStore.reset();
  res.json({ ok: true, resetAt: new Date().toISOString() });
});

// REMOVED: Hardcoded analytics endpoint - now using the real Supabase endpoint in routes.ts

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const client = twilio(
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN // Note: this is *not* the API secret
);


// REMOVED: Duplicate /api/dial-lead endpoint - using the proper one in routes.ts with shared local presence service instance

// REMOVED: Duplicate /lead-join endpoint - using the proper one in routes.ts


// Helper to detect Electron requests via User-Agent or explicit desktop header.
function isElectronRequest(req: any): boolean {
  const ua = req.headers['user-agent'] || '';
  const desktopHeader = `${req.headers['x-desktop-app'] || ''}`.toLowerCase();
  return ua.includes('AOI-Desktop') || ua.includes('Electron') || desktopHeader === 'true' || desktopHeader === '1';
}

// CRITICAL: Force Electron cookies to use SameSite=None; Secure
// This middleware runs AFTER session middleware to override cookie settings
app.use((req, res, next) => {
  const isElectron = isElectronRequest(req);
  
  if (isElectron) {
    // Override res.cookie to force SameSite=None; Secure for ALL cookies in Electron
    const originalCookie = res.cookie.bind(res);
    res.cookie = function(name: string, value: string, options: any = {}) {
      const electronOptions = {
        ...options,
        sameSite: 'none' as const,
        secure: NODE_ENV === 'production', // HTTPS required for SameSite=None
        httpOnly: options.httpOnly !== false, // Preserve httpOnly unless explicitly disabled
      };
      return originalCookie(name, value, electronOptions);
    };
    
    // Also override session cookie if it exists
    if ((req.session as any)?.cookie) {
      (req.session as any).cookie.sameSite = 'none';
      (req.session as any).cookie.secure = NODE_ENV === 'production';
    }
  }
  
  next();
});

// Force all users to sign back in at 12:00 AM PST daily (clear session store)
// DEBUG: disabled while inbound API is being stabilized
// if (sessionStore && typeof sessionStore.clear === 'function') {
//   // 0 0 * * * = midnight every day; server TZ is America/Los_Angeles so this is midnight PST
//   cron.schedule('0 0 * * *', () => {
//     sessionStore.clear((err: Error | null) => {
//       if (err) console.error('❌ Midnight session clear failed:', err);
//       else console.log('🔒 Midnight PST: all sessions cleared – users must sign back in.');
//     });
//   });
//   console.log('✅ Scheduled midnight PST session clear (users forced to re-login at 12 AM PST).');
// }

// Supabase JWT auth for compartmentalized deploys (cookie or Authorization Bearer)
app.use(jwtAuthMiddleware);

// Ensure req.user is set from session so routes (e.g. dial-lead) can use it as fallback when body lacks agentEmail
app.use((req: any, _res, next) => {
  if (req.session?.user && !req.user) req.user = req.session.user;
  next();
});

// Section path filtering: when SECTION is set, only allow paths for that section
const currentSection = process.env.SECTION as SectionName | undefined;
if (currentSection && SECTION_NAMES.includes(currentSection)) {
  app.use((req, res, next) => {
    if (!isPathAllowedForSection(req.path, currentSection)) {
      return res.status(404).json({ error: 'Not found', path: req.path, section: currentSection });
    }
    next();
  });
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Note: No custom root route handler - let Vite middleware handle all frontend routes

// WebRTC webhook is now handled in routes.ts to match working version

// Dial action callback - fires when Dial verb completes
// THIS IS WHERE WE GET THE CHILD CALL (DialCallSid) WITH THE ACTUAL TO NUMBER!
app.post("/api/twilio/dial-action", async (req, res) => {
  console.log('🔥🔥🔥 STEP DIAL-ACTION: /api/twilio/dial-action HIT 🔥🔥🔥');
  console.log('🔍 DEBUG: Request body:', JSON.stringify(req.body, null, 2));
  console.log('🔍 DEBUG: Request query:', JSON.stringify(req.query, null, 2));
  
  const callSid = req.body.CallSid; // Parent WebRTC call
  const dialCallSid = req.body.DialCallSid; // CHILD CALL - THIS IS THE ONE WITH THE TO NUMBER!
  const dialCallStatus = req.body.DialCallStatus;
  const to = req.body.To || req.body.DialCallTo || req.body.Called || req.body.DialCallToNumber; // THE NUMBER BEING DIALED!
  const from = req.body.From || req.body.Caller;
  const parentCallSid = req.body.ParentCallSid || callSid; // Link to parent call
  
  console.log(`🔍 DEBUG: callSid=${callSid} (parent), dialCallSid=${dialCallSid} (child), dialCallStatus=${dialCallStatus}, to=${to}, from=${from}`);
  console.log(`🔍 DEBUG: Full request body keys:`, Object.keys(req.body));
  console.log('✅ DIAL ACTION: Callback received - THIS IS WHERE WE GET THE TO NUMBER!');
  
  // CRITICAL: If we don't have `to` in the callback, fetch it from Twilio API using DialCallSid
  let finalTo = to;
  if (dialCallSid && !finalTo) {
    console.log(`⚠️ DIAL-ACTION: Missing 'To' in callback, fetching from Twilio API for DialCallSid: ${dialCallSid}`);
    try {
      const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      const twilioCall = await twilioClient.calls(dialCallSid).fetch();
      if (twilioCall.to) {
        finalTo = twilioCall.to;
        console.log(`✅ DIAL-ACTION: Fetched 'To' from Twilio API: ${finalTo}`);
      }
    } catch (twilioError) {
      console.error(`❌ DIAL-ACTION: Failed to fetch from Twilio API:`, twilioError);
    }
  }
  
  // CRITICAL: Log the CHILD CALL (DialCallSid) with the TO NUMBER!
  // This is the actual dialed call that has the phone number!
  if (dialCallSid && finalTo) {
    console.log(`🎯 LOGGING CHILD CALL: dialCallSid=${dialCallSid}, to=${finalTo}, from=${from}`);
    try {
      // Extract call_duration from DialCallDuration in metadata
      let callDuration = 0;
      if (req.body.DialCallDuration) {
        callDuration = parseInt(String(req.body.DialCallDuration), 10) || 0;
        console.log(`🔍 DEBUG: Extracted DialCallDuration: ${callDuration} seconds`);
      }
      
      const logData: any = {
        twilio_call_sid: dialCallSid, // Use the CHILD call SID, not the parent!
        to_number: finalTo, // THIS IS THE NUMBER WE'RE DIALING!
        from_number: from || '',
        call_status: dialCallStatus || 'initiated',
        call_duration: callDuration, // Extract from DialCallDuration
        call_direction: 'outbound',
        call_started_at: new Date().toISOString(),
        parent_call_sid: parentCallSid, // Link to parent WebRTC call
        call_source: 'webrtc_dial_action',
        metadata: req.body // Store full webhook body for debugging
      };
      
      // Extract agent email: 1) From URL query (dial-action?agentEmail=...), 2) parent From "client:email", 3) parent row owner (avoid persisting cnsysop)
      const BAD_OWNER = ['cnsysop@aoglobelife.com', 'unknown@aoglobelife.com', 'system@aoglobelife.com', 'unknown', ''];
      const isBadOwner = (e: string | null | undefined) => !e || !e.includes('@') || BAD_OWNER.includes((e || '').trim().toLowerCase());
      let ownerToSet: string | null = null;
      const agentEmailFromQuery = (req.query?.agentEmail as string)?.trim();
      if (agentEmailFromQuery && agentEmailFromQuery.includes('@')) ownerToSet = agentEmailFromQuery.toLowerCase();
      else if (from && from.startsWith('client:')) ownerToSet = from.replace('client:', '').trim().toLowerCase();
      let existingOwner = "";
      try {
        const existingChild = await getTwilioCallBySidLocal(dialCallSid);
        existingOwner = String((existingChild as any)?.owner_email || "").trim();
      } catch (localErr) {
        console.warn(`⚠️ Local owner lookup failed for ${dialCallSid}; falling back to Supabase:`, localErr);
        const { supabaseAdmin } = await import('./supabase');
        if (!supabaseAdmin) throw new Error('supabaseAdmin unavailable for owner fallback');
        const { data: existingChild } = await supabaseAdmin.from('twilio_call_logs').select('owner_email').eq('twilio_call_sid', dialCallSid).maybeSingle();
        existingOwner = String((existingChild as any)?.owner_email || "").trim();
      }
      if (existingOwner && existingOwner.includes('@') && !BAD_OWNER.includes(existingOwner.toLowerCase()) && isBadOwner(ownerToSet)) ownerToSet = existingOwner.toLowerCase();
      if (isBadOwner(ownerToSet) && parentCallSid) {
        let parentOwner = "";
        try {
          const parentRow = await getTwilioCallBySidLocal(parentCallSid);
          parentOwner = String((parentRow as any)?.owner_email || "").trim();
        } catch (localErr) {
          console.warn(`⚠️ Local parent-owner lookup failed for ${parentCallSid}; falling back to Supabase:`, localErr);
          const { supabaseAdmin } = await import('./supabase');
          if (!supabaseAdmin) throw new Error('supabaseAdmin unavailable for parent-owner fallback');
          const { data: parentRow } = await supabaseAdmin.from('twilio_call_logs').select('owner_email').eq('twilio_call_sid', parentCallSid).maybeSingle();
          parentOwner = String((parentRow as any)?.owner_email || "").trim();
        }
        if (parentOwner && parentOwner.includes('@') && !BAD_OWNER.includes(parentOwner.toLowerCase())) {
          ownerToSet = parentOwner.toLowerCase();
          console.log(`🔧 dial-action: using parent owner for child ${dialCallSid}: ${ownerToSet} (avoid cnsysop)`);
        }
      }
      if (ownerToSet && ownerToSet.includes('@')) {
        logData.owner_email = ownerToSet;
        logData.agent_identity = `client:${ownerToSet}`;
        console.log(`🔍 DEBUG: Using owner_email for child: ${ownerToSet}`);
      }
      
      console.log(`🔍 DEBUG: Logging child call data:`, JSON.stringify(logData, null, 2));
      
      let writeError: unknown = null;
      try {
        await upsertTwilioCallLogLocal(logData);
      } catch (localErr) {
        writeError = localErr;
      }
      
      if (writeError) {
        console.error(`❌ STEP DIAL-ACTION: Failed to log child call:`, writeError);
      } else {
        console.log(`✅✅✅ STEP DIAL-ACTION: Successfully logged CHILD CALL with TO NUMBER: ${dialCallSid} -> ${finalTo}`);
        
        // DEBUG: disabled during inbound API stabilization to reduce per-call DB work
      }
    } catch (error) {
      console.error(`❌ STEP DIAL-ACTION: Exception logging child call:`, error);
    }
  } else {
    console.warn(`⚠️ STEP DIAL-ACTION: Missing dialCallSid or to number - dialCallSid=${dialCallSid}, to=${finalTo || to}`);
    // Even if we don't have to_number, still try to log the call and fetch it later
    if (dialCallSid) {
      try {
        // Extract call_duration from DialCallDuration in metadata
        let callDuration = 0;
        if (req.body.DialCallDuration) {
          callDuration = parseInt(String(req.body.DialCallDuration), 10) || 0;
          console.log(`🔍 DEBUG: Extracted DialCallDuration: ${callDuration} seconds`);
        }
        
        const logData: any = {
          twilio_call_sid: dialCallSid,
          call_status: dialCallStatus || 'initiated',
          call_duration: callDuration, // Extract from DialCallDuration
          call_direction: 'outbound',
          call_started_at: new Date().toISOString(),
          parent_call_sid: parentCallSid,
          call_source: 'webrtc_dial_action',
          metadata: req.body
        };
        
        // Try to fetch from Twilio API
        if (!finalTo && !to) {
          try {
            const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            const twilioCall = await twilioClient.calls(dialCallSid).fetch();
            if (twilioCall.to) {
              logData.to_number = twilioCall.to;
              logData.from_number = twilioCall.from || from || '';
              console.log(`✅ DIAL-ACTION: Fetched to_number from Twilio API: ${twilioCall.to}`);
            }
          } catch (apiError) {
            console.error(`❌ DIAL-ACTION: Failed to fetch from Twilio API:`, apiError);
          }
        } else if (to) {
          // If we have `to` from the webhook, use it
          logData.to_number = to;
          logData.from_number = from || '';
        }
        const BAD_OWNER = ['cnsysop@aoglobelife.com', 'unknown@aoglobelife.com', 'system@aoglobelife.com', 'unknown', ''];
        const isBadOwner = (e: string | null | undefined) => !e || !e.includes('@') || BAD_OWNER.includes((e || '').trim().toLowerCase());
        let ownerToSet: string | null = null;
        const agentFromQuery = (req.query?.agentEmail as string)?.trim();
        if (agentFromQuery && agentFromQuery.includes('@')) ownerToSet = agentFromQuery.toLowerCase();
        else if (from && from.startsWith('client:')) ownerToSet = from.replace('client:', '').trim().toLowerCase();
        let existingOwner = "";
        try {
          const existingChild = await getTwilioCallBySidLocal(dialCallSid);
          existingOwner = String((existingChild as any)?.owner_email || "").trim();
        } catch (localErr) {
          console.warn(`⚠️ Local owner lookup failed for ${dialCallSid}; falling back to Supabase:`, localErr);
          const { supabaseAdmin } = await import('./supabase');
          if (!supabaseAdmin) throw new Error('supabaseAdmin unavailable for owner fallback');
          const { data: existingChild } = await supabaseAdmin.from('twilio_call_logs').select('owner_email').eq('twilio_call_sid', dialCallSid).maybeSingle();
          existingOwner = String((existingChild as any)?.owner_email || "").trim();
        }
        if (existingOwner && existingOwner.includes('@') && !BAD_OWNER.includes(existingOwner.toLowerCase()) && isBadOwner(ownerToSet)) ownerToSet = existingOwner.toLowerCase();
        if (isBadOwner(ownerToSet) && parentCallSid) {
          let parentOwner = "";
          try {
            const parentRow = await getTwilioCallBySidLocal(parentCallSid);
            parentOwner = String((parentRow as any)?.owner_email || "").trim();
          } catch (localErr) {
            console.warn(`⚠️ Local parent-owner lookup failed for ${parentCallSid}; falling back to Supabase:`, localErr);
            const { supabaseAdmin } = await import('./supabase');
            if (!supabaseAdmin) throw new Error('supabaseAdmin unavailable for parent-owner fallback');
            const { data: parentRow } = await supabaseAdmin.from('twilio_call_logs').select('owner_email').eq('twilio_call_sid', parentCallSid).maybeSingle();
            parentOwner = String((parentRow as any)?.owner_email || "").trim();
          }
          if (parentOwner && parentOwner.includes('@') && !BAD_OWNER.includes(parentOwner.toLowerCase())) {
            ownerToSet = parentOwner.toLowerCase();
            console.log(`🔧 dial-action: using parent owner for child ${dialCallSid}: ${ownerToSet} (avoid cnsysop)`);
          }
        }
        if (ownerToSet && ownerToSet.includes('@')) {
          logData.owner_email = ownerToSet;
          logData.agent_identity = `client:${ownerToSet}`;
        }
        try {
          await upsertTwilioCallLogLocal(logData);
        } catch (localErr) {
          throw localErr;
        }
        console.log(`✅ DIAL-ACTION: Logged call without to_number (will be backfilled)`);
      } catch (error) {
        console.error(`❌ DIAL-ACTION: Failed to log call:`, error);
      }
    }
  }
  
  res.type('text/xml');
  res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
});

const basePort = parseInt(process.env.PORT || HARDCODED_CONFIG.PORT.toString() || '5000', 10);
let port = basePort;
const server = http.createServer(app);

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    if (NODE_ENV === 'development') {
      const next = port + 1;
      console.error(
        `❌ Port ${port} is already in use — trying ${next} (set PORT=${next} or free the port; avoid running two dev servers).`,
      );
      port = next;
      server.listen(port);
      return;
    }
    console.error(`❌ Port ${port} is already in use. Stop the other process or set PORT.`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    if (NODE_ENV !== 'production') {
      throw err;
    }
  }
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT', () => { server.close(() => process.exit(0)); });

async function setup() {
  // CRITICAL: Register aoi-precheck agent routes FIRST - production was 404'ing on POST transmit
  const { registerAgentPrecheckAgentRoutes } = await import("./routes-precheck-agent");
  registerAgentPrecheckAgentRoutes(app);

  await registerRoutes(app, server);

  // Initialize post-call write queue handlers (recording URLs, dispositions, call logs)
  try {
    const { registerPostCallHandlers } = await import('./queue/post-call-handlers');
    registerPostCallHandlers();
  } catch (e: any) {
    console.error('[POST_CALL_QUEUE] Failed to register handlers:', e?.message);
  }

  // TaskRouter preload skipped — inbound calls disabled
  // import('./taskrouter-service.js').then((tr) => { if (tr.isTaskRouterConfigured()) tr.getWorkflowSidForEnqueue(); }).catch(() => {});
  
  // Setup OpenAI Realtime WebSocket proxy
  const { setupRealtimeWebSocket } = await import('./routes');
  setupRealtimeWebSocket(server);

  // Setup 914 inbound AI customer service bot
  const { setupCsBot } = await import('./cs-bot.js');
  setupCsBot(app, server);
  
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found', path: req.path, method: req.method });
    next();
  });
  // Only use Vite when explicitly in development. Otherwise serve pre-built static (avoids crash when NODE_ENV unset on Railway).
  const useVite = process.env.NODE_ENV === "development";
  if (useVite) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status || err.statusCode || 500).json({ message: err.message || "Internal Server Error" });
    if (NODE_ENV !== 'production') throw err;
  });
}

async function startBackground() {
  try {
    const leadOnlyMode = String(process.env.LEAD_ONLY_MODE || "").toLowerCase() === "true";
    if (currentSection === "data") {
      if (!leadOnlyMode) {
        console.error("[AOIrail] SECTION=data detected — starting 10-minute dial stats chain.");
        const { startDialStatsChainScheduler } = await import("./dial-stats-chain.js");
        startDialStatsChainScheduler();
        try {
          const { startPlatformSalesNightlySyncScheduler } = await import("./platform-sales-nightly-sync");
          startPlatformSalesNightlySyncScheduler();
        } catch (error) {
          console.error("⚠️ Platform sales nightly sync scheduler failed to start:", error);
        }
      } else {
        console.error("[LEAD_ONLY_MODE] DialStatsChain and platform sales scheduler disabled in data section");
      }
    }

    try {
      const { startCustomerRoutingProfileSyncScheduler, startLeaseDialerQueuePreloaderScheduler } = await import("./leasedialer-assignment-service");
      startCustomerRoutingProfileSyncScheduler();
      if (currentSection === "data") {
        startLeaseDialerQueuePreloaderScheduler();
        console.error("[LEASE_AUTO] disabled by ops - not starting leasedialer automation worker");
      }
    } catch (error) {
      console.error("⚠️ Customer routing profile sync scheduler failed to start:", error);
    }

    if (!leadOnlyMode) {
      try {
        const { startAgentProductionRankScheduler } = await import("./ccpro-rank-service");
        startAgentProductionRankScheduler();
      } catch (error) {
        console.error("⚠️ Agent production rank scheduler failed to start:", error);
      }
    } else {
      console.error("[LEAD_ONLY_MODE] Agent production rank scheduler disabled");
    }

    // CRITICAL: Update TwiML App configuration on startup
    // TwiML App URL is static — no need to update on every boot.
    // Run manually via: node -e "require('./server/configure-twiml-app.js')" if URL changes.
    // console.log('⏭️ Skipping TwiML App update (URL is static, only needed on URL change)');
    // Initialize WebRTC Call Service for video meetings
    console.log('🎥 Setting up WebRTC Call Service...');
    try {
      const { WebRTCCallService } = await import('./webrtc-call-service');
      const webrtcCallService = new WebRTCCallService(server);
      console.log('✅ WebRTC Call Service initialized');
    } catch (error) {
      console.error('⚠️ WebRTC Call Service initialization failed (non-critical):', error);
    }
    
    // Initialize Local Presence Service for local phone numbers (lazy loading for faster startup)
    console.log('🔍 Setting up Local Presence Service...');
    try {
      // Use the shared singleton so dial paths and startup initialization
      // reference the exact same service instance/state.
      (global as any).localPresenceService = localPresenceService;
      
      // Initialize in background to avoid blocking server startup
      localPresenceService.initialize().catch(error => {
        console.warn('⚠️ Local Presence Service initialization failed (non-blocking):', error);
      });
      console.log('✅ Local Presence Service setup complete (initializing in background)');
    } catch (error) {
      console.error('⚠️ Local Presence Service setup failed (non-critical):', error);
    }
    
    const { shouldStartWorkersInWebServer } = await import("./feature-flags.js");
    if (shouldStartWorkersInWebServer()) {
      const { startBackgroundWorkers } = await import("./background-workers.js");
      await startBackgroundWorkers();
      // console.log is a no-op in production below — use stderr so Railway logs prove workers ran
      console.error(
        "[AOIrail] Background workers STARTED on web process (START_WORKERS_IN_WEB=true). Includes billing-transaction-sync every 5m.",
      );
    } else {
      console.error(
        "[AOIrail] Background workers NOT running on this process: START_WORKERS_IN_WEB is false. Set START_WORKERS_IN_WEB=true here, OR run a second Railway service with start command: node dist/worker.js (ENABLE_WORKERS=true). Connect billing_transactions only sync when workers run.",
      );
      // Keep nightly hot-table EOD mirror active even when workers run in another process.
      if (isHotTablesEodOnly()) {
        const { startLocalHotTablesEodSyncScheduler } = await import("./local-hot-tables-sync");
        startLocalHotTablesEodSyncScheduler();
      }
    }

    // ensurePublicLiveCardTables + seedChrisLiveLink moved to worker process


    console.log('✅ Background services initialization complete');
    console.log('✅ Server initialization complete');
    if (isHotTablesEodOnly()) {
      console.log('🕚 Hot-table mode: runtime Supabase writes disabled for twilio_call_logs + agent_dial_metrics (EOD sync at 11 PM)');
    } else {
      console.log('🔄 Automated Twilio sync running - downloading/fixing call data every minute');
    }
  } catch (error) {
    console.error('❌ Critical server initialization failure:', error);
    if (NODE_ENV !== 'production') throw error;
  }
}

// Setup first (routes + static + SPA), then listen. Assets under /assets/* must exist or app 404s.
(async () => {
  if (redisClient) {
    try {
      const rc = redisClient as { isReady?: boolean; connect: () => Promise<unknown> };
      if (!rc.isReady) {
        await Promise.race([
          rc.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Redis connect timeout before listen")), 2_000)),
        ]);
      }
    } catch (err: any) {
      console.error('❌ Redis connect failed before listen:', err?.message);
    }
  }
  await setup();
  // Omit host so Node binds dual-stack where supported; explicit 0.0.0.0 breaks `localhost` → ::1 on some Windows setups.
  server.listen(port, () => {
    log(`serving on port ${port}`);
    startBackground().catch(err => console.error('❌ Background failed:', err));
  });
})().catch(err => {
  console.error('❌ Setup failed:', err);
  process.exit(1);
});
