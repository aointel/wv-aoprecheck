import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { seedSampleData } from "./storage";
import { seedSampleUsers } from "./seed";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { randomBytes } from "crypto";
import fileUpload from "express-fileupload";

// Set up environment variables if not already set
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
  console.log('Generated random SESSION_SECRET');
}

// Set TaalkAI API credentials from environment variables if not already set
if (!process.env.TAALK_API_USERNAME) {
  process.env.TAALK_API_USERNAME = 'michaelmandella@aoglobelife.com';
  console.log('Set TAALK_API_USERNAME from default value');
}
if (!process.env.TAALK_API_PASSWORD) {
  process.env.TAALK_API_PASSWORD = 'Aoletsgrow24!';
  console.log('Set TAALK_API_PASSWORD from default value');
}
if (!process.env.TAALK_API_KEY) {
  // Set the JWT token for API authentication
  process.env.TAALK_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
  console.log('Set TAALK_API_KEY from default value');
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
}));

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

(async () => {
  // Initialize database schema and seed sample data
  try {
    console.log("Initializing database...");
    await seedSampleData();
    await seedSampleUsers();
    console.log("Database initialization complete.");
    
    // Test Supabase connection
    try {
      const { testSupabaseConnection } = await import('./supabase');
      console.log("Testing Supabase connection...");
      const connected = await testSupabaseConnection();
      if (connected) {
        console.log("Successfully connected to Supabase!");
      } else {
        console.warn("Could not connect to Supabase. Call syncing will not work properly.");
      }
    } catch (error) {
      console.error("Error testing Supabase connection:", error);
    }
  } catch (error) {
    console.error("Error initializing database:", error);
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
