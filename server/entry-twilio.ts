/**
 * Twilio section entry point for compartmentalized builds.
 * Build with: esbuild server/entry-twilio.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/twilio.js
 */
import http from "http";
import twilio from "twilio";
import { createApp, addErrorHandler } from "./setup-app";
import { registerTwilioRoutes } from "./routes-sections/routes-twilio";
import { LocalPresenceService } from "./local-presence-service";
import { TWILIO_TWIML_APP_SID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, NODE_ENV, PRODUCTION_URL } from "./hardcoded-config";

const PRODUCTION_BASE_URL = PRODUCTION_URL;

process.env.TZ = "America/Los_Angeles";

if (NODE_ENV === "production") {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  console.warn = () => {};
}

process.on("uncaughtException", (err: Error) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  if (NODE_ENV !== "production") process.exit(1);
});
process.on("unhandledRejection", (reason: unknown) => {
  console.error("UNHANDLED REJECTION:", reason);
  if (NODE_ENV !== "production") process.exit(1);
});

const app = createApp({ serveSpa: false });

async function main() {
  await registerTwilioRoutes(app);
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

  // Twilio-specific background services
  try {
    if (TWILIO_TWIML_APP_SID && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      await twilioClient.applications(TWILIO_TWIML_APP_SID).update({
        voiceUrl: `${PRODUCTION_BASE_URL}/webhook/webrtc`,
        voiceMethod: "POST",
        statusCallback: `${PRODUCTION_BASE_URL}/api/twilio/call-status`,
        statusCallbackMethod: "POST",
      });
      console.log("TwiML App configured");
    }
  } catch (e) {
    console.error("TwiML App config failed:", e);
  }

  // Initialize post-call queue handlers
  try {
    const { registerPostCallHandlers } = await import('./queue/post-call-handlers');
    registerPostCallHandlers();
  } catch (e: any) {
    console.error('[POST_CALL_QUEUE] Failed to register handlers:', e?.message);
  }

  const localPresenceService = new LocalPresenceService();
  (global as any).localPresenceService = localPresenceService;
  localPresenceService.initialize().catch((e) => console.warn("LocalPresence init:", e));

  try {
    const { WebRTCCallService } = await import("./webrtc-call-service");
    new WebRTCCallService(server);
    console.log("WebRTC Call Service initialized");
  } catch (e) {
    console.warn("WebRTC Call Service init failed:", e);
  }

  server.listen(port, () => {
    console.log("Twilio server listening on port", port);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
