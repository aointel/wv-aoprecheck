/** Auth-only entry: /api/auth/* + SPA. See register-auth-routes.ts */
import http from "http";
import type { Request, Response, NextFunction } from "express";
import { createApp, addErrorHandler, setupSpa } from "./setup-app";
import { registerAuthRoutes } from "./register-auth-routes";
import { jwtAuthMiddleware } from "./jwt-auth-middleware";
process.env.TZ = "America/Los_Angeles";
const app = createApp({ serveSpa: true });
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api") && !req.path.startsWith("/api/auth")) {
    return res.status(404).json({ error: "Not found", path: req.path });
  }
  next();
});
app.use(jwtAuthMiddleware);
registerAuthRoutes(app);
addErrorHandler(app);
async function main() {
  const port = parseInt(process.env.PORT || "5000", 10);
  const server = http.createServer(app);
  server.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code === "EADDRINUSE") process.exit(1);
    throw e;
  });
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
  await setupSpa(app, server);
  server.listen(port, "0.0.0.0", () => console.log("auth service", port));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
