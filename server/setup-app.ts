/**
 * Shared Express app setup for monolith and section entry points.
 * Used by index.ts (monolith) and entry-<section>.ts (compartmentalized builds).
 */
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import session from "express-session";
import { SESSION_SECRET, NODE_ENV } from "./hardcoded-config";
import { setupVite, serveStatic, log } from "./vite";
import type { Server } from "http";

process.env.TZ = "America/Los_Angeles";

export interface CreateAppOptions {
  /** When true, adds / and /dashboard SPA routes and static/Vite setup. API-only sections (twilio, api) use false. */
  serveSpa?: boolean;
}

export function createApp(options: CreateAppOptions = {}): express.Application {
  const { serveSpa = true } = options;

  const app = express();

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
  app.get("/dashboard", (_req, res) => res.redirect(302, "/dashboard/connect"));

  const isShellApp = process.env.SHELL_APP === "1";
  if (serveSpa) {
    const isProd = NODE_ENV === "production";
    const distPath = path.resolve(process.cwd(), "dist", isShellApp ? "shell-public" : "public");
    const indexPath = path.join(distPath, "index.html");

    function sendIndex(_req: Request, res: Response) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Content-Type", "text/html");
      res.sendFile(indexPath);
    }

    if (isProd && fs.existsSync(indexPath)) {
      app.get("/", sendIndex);
      app.get(/^\/dashboard\/.*/, sendIndex);
    }
  }

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    
    // CSP REMOVED - It was blocking WebRTC connections and causing constant issues
    // Browser's default security is sufficient for this trusted internal app
    // If you need CSP later, add it back, but it's not necessary
    
    if (req.path.endsWith(".html") || req.path.endsWith(".js") || req.path.endsWith(".css") || req.path === "/") {
      res.header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.header("Pragma", "no-cache");
      res.header("Expires", "0");
      res.header("ETag", "");
      res.header("Last-Modified", "");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  const attachedAssetsPath = path.join(process.cwd(), "attached_assets");
  if (fs.existsSync(attachedAssetsPath)) {
    app.use("/attached_assets", express.static(attachedAssetsPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".mp4")) {
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader("Accept-Ranges", "bytes");
        }
      },
    }));
  }

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: false, limit: "50mb" }));

  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined;
    const originalResJson = res.json;
    res.json = function (bodyJson: unknown, ...args: unknown[]) {
      capturedJsonResponse = bodyJson as Record<string, unknown>;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (reqPath.startsWith("/api")) {
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
        log(logLine);
      }
    });
    next();
  });

  return app;
}

/** Add global error handler. Call after all routes. */
export function addErrorHandler(app: express.Application): void {
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { status?: number; statusCode?: number; message?: string };
    res.status(e?.status ?? e?.statusCode ?? 500).json({ message: e?.message ?? "Internal Server Error" });
    if (NODE_ENV !== "production") throw err;
  });
}

/**
 * Add SPA static serving (production) or Vite dev server (development).
 * Call after registering routes. Requires server for Vite HMR.
 */
export async function setupSpa(app: express.Application, server: Server): Promise<void> {
  const isProd = NODE_ENV === "production" || app.get("env") === "production";
  const shellStatic = process.env.SHELL_APP === "1";
  if (isProd) serveStatic(app, shellStatic ? "shell-public" : "public");
  else await setupVite(app, server);
}
