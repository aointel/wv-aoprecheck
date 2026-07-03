/**
 * API section entry point for compartmentalized builds.
 * Auth, profile, notifications, shared lookups.
 */
import http from "http";
import { createApp, addErrorHandler } from "./setup-app";

process.env.TZ = "America/Los_Angeles";

const app = createApp({ serveSpa: false });

async function main() {
  const { registerApiRoutes } = await import("./routes-sections/routes-api");
  await registerApiRoutes(app);
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not found", path: req.path });
    next();
  });
  addErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  const server = http.createServer(app);

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error("Port", port, "in use");
      process.exit(1);
    }
    throw err;
  });
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));

  server.listen(port, () => {
    console.log("API server listening on port", port);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
