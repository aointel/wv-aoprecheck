/**
 * Precheck section routes - verification flow, Taalk webhooks.
 * Extracted for compartmentalized builds. Used by entry-precheck.ts and routes.ts (monolith).
 * TODO: Full route extraction from routes.ts - register here when extracted.
 */
import type { Express } from "express";

export async function registerPrecheckRoutes(_app: Express): Promise<void> {
  console.log("🔧 Registering Precheck section routes...");
  // Stub: Full implementation remains in routes.ts. Compartmentalized build uses monolith via SECTION.
  console.log("✅ Precheck section routes registered (stub - use monolith with SECTION=precheck)");
}
