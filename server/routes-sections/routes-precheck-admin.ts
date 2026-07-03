/**
 * Precheck Admin section routes - AOIPrecheckAdmin UI, aoi-precheck APIs.
 * Extracted for compartmentalized builds. Used by entry-precheck-admin.ts and routes.ts (monolith).
 * TODO: Full route extraction from routes.ts - register here when extracted.
 */
import type { Express } from "express";

export async function registerPrecheckAdminRoutes(_app: Express): Promise<void> {
  console.log("🔧 Registering Precheck Admin section routes...");
  // Stub: Full implementation remains in routes.ts. Compartmentalized build uses monolith via SECTION.
  console.log("✅ Precheck Admin section routes registered (stub - use monolith with SECTION=precheck-admin)");
}
