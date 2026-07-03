/**
 * API section routes - auth, profile, notifications, shared lookups.
 * Extracted for compartmentalized builds. Used by entry-api.ts and routes.ts (monolith).
 * TODO: Full route extraction from routes.ts - register here when extracted.
 */
import type { Express } from "express";

export async function registerApiRoutes(_app: Express): Promise<void> {
  console.log("🔧 Registering API section routes...");
  // Stub: Full implementation remains in routes.ts. Compartmentalized build uses monolith via SECTION.
  console.log("✅ API section routes registered (stub - use monolith with SECTION=api)");
}
