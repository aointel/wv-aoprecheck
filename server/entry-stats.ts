/**
 * Stats section entry point for compartmentalized builds.
 * Live Call Board, analytics, reports.
 */
import http from "http";
import { createApp, addErrorHandler, setupSpa } from "./setup-app";

process.env.TZ = "America/Los_Angeles";

const app = createApp({ serveSpa: true });

async function main() {
  const { registerStatsRoutes } = await import("./routes-sections/routes-stats");
  await registerStatsRoutes(app);
  addErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  const server = http.createServer(app);

  await setupSpa(app, server);

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
    console.log("Stats server listening on port", port);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
