/**
 * Connect section routes - Connect UI, dialer, VDP, credits.
 * Extracted for compartmentalized builds. Used by entry-connect.ts and routes.ts (monolith).
 * TODO: Full route extraction from routes.ts - register here when extracted.
 */
import type { Express } from "express";

export async function registerConnectRoutes(_app: Express): Promise<void> {
  console.log("🔧 Registering Connect section routes...");
  // Stub: Full implementation remains in routes.ts. Compartmentalized build uses monolith via SECTION.
  console.log("✅ Connect section routes registered (stub - use monolith with SECTION=connect)");
}
