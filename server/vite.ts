import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

/** One bust per server start — per-request nanoid() made every HTML response unique and caused constant full reloads in dev. */
const MAIN_TSX_CACHE_BUST = nanoid(8);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Serve test HTML files directly (BEFORE Vite middleware catches everything)
  // These routes must be registered before vite.middlewares
  const testFiles = [
    "test-webrtc-comprehensive-diagnostics.html",
    "test-webrtc-registration.html",
    "test-webrtc-call.html",
    "test-webrtc-speed.html",
  ];
  
  testFiles.forEach((testFile) => {
    app.get(`/${testFile}`, async (req, res) => {
      try {
        // Try client/public first (dev), then root directory
        const clientPublicPath = path.resolve(import.meta.dirname, "..", "client", "public", testFile);
        const rootPath = path.resolve(import.meta.dirname, "..", "..", testFile);
        
        let filePath: string | null = null;
        try {
          await fs.promises.access(clientPublicPath);
          filePath = clientPublicPath;
        } catch {
          try {
            await fs.promises.access(rootPath);
            filePath = rootPath;
          } catch {
            // File not found
          }
        }
        
        if (filePath) {
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.sendFile(filePath);
        } else {
          res.status(404).send(`Test file not found: ${testFile}`);
        }
      } catch (error) {
        console.error(`Error serving ${testFile}:`, error);
        res.status(500).send(`Error serving test file: ${error}`);
      }
    });
  });

  // Bind Vite HMR to the same HTTP server so it does not spawn a standalone WS port (24678),
  // which causes repeated "[vite] server connection lost" reconnect loops in local dev.
  const resolvedDevPort = Number(process.env.PORT || 5000);
  const hmrHost = String(process.env.VITE_HMR_HOST || "localhost").trim() || "localhost";
  const hmrPort = Number(process.env.VITE_HMR_PORT || resolvedDevPort || 5000);

  const serverOptions = {
    middlewareMode: true,
    hmr: {
      server,
      host: hmrHost,
      protocol: "ws" as const,
      clientPort: hmrPort,
      port: hmrPort,
    },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Do not process.exit — Vite logs recoverable issues; exiting mimics a deploy crash.
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // Reload index.html from disk when it changes; stable query so the browser is not forced to re-fetch the entry on every navigation.
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${MAIN_TSX_CACHE_BUST}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export const serveStatic = (app: express.Application, subDir: "public" | "shell-public" = "public") => {
  const distPath = path.resolve("dist", subDir);

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the production build. Ensure you've run the build command.`
    );
  }

  // Clear any cached static files on deployment
  console.log('🧹 Clearing static file cache for fresh deployment...');
  console.log('📁 Serving static files from:', distPath);

  // Serve static files: hashed assets get long cache; index.html handled by catch-all with no-store
  app.use(
    express.static(distPath, {
      index: false, // Don't serve index.html directly — catch-all below handles it with data injection
      maxAge: 0,
      etag: false,
      lastModified: false,
      setHeaders: (res, filePath) => {
        const p = filePath.replace(/\\/g, "/");
        // Hashed assets under /assets/*: long cache (immutable). Reduces asset 404 risk after rebuild.
        if (p.includes("/assets/") && (/\.(js|css)(\?|$)/.test(p) || /-[a-f0-9]{8,}\.(js|css)/.test(p))) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }
        // Everything else (non-hashed): no-store
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      },
    })
  );

  // SPA catch-all: serve index.html for any non-API, non-webhook GET (must be after express.static)
  // Note: Test HTML files are served by express.static from dist/public, so they work automatically
  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/webhook/")) return next();

    const indexPath = path.join(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      console.error("❌ index.html not found at:", indexPath);
      return res.status(500).send("Application build not found. Please rebuild the application.");
    }

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Content-Type", "text/html");

    // Inject data service URL so client routes masterlead/outbound-dialer calls correctly
    const dataUrl = process.env.AOIRAIL_DATA_SERVICE_URL || process.env.DATA_SERVICE_URL || 
      (process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL ? `https://${process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL}` : '');
    if (dataUrl) {
      try {
        const html = fs.readFileSync(indexPath, 'utf8');
        const inject = `<script>window.__AOIRAIL_DATA_SERVICE_URL__=${JSON.stringify(dataUrl)};</script>`;
        const out = html.includes('</head>') ? html.replace('</head>', `${inject}</head>`) : `${inject}${html}`;
        return res.status(200).send(out);
      } catch { /* fall through */ }
    }

    res.sendFile(indexPath);
  });

  console.log('✅ SPA routing configured - all non-API routes will serve index.html');
};