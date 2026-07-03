/**
 * Recruit section routes - AO Recruit UI and recruit APIs.
 * Extracted for compartmentalized builds. Used by entry-recruit.ts and routes.ts (monolith).
 * TODO: Full route extraction from routes.ts - register here when extracted.
 */
import type { Express } from "express";

export async function registerRecruitRoutes(_app: Express): Promise<void> {
  console.log("🔧 Registering Recruit section routes...");
  // Stub: Full implementation remains in routes.ts. Compartmentalized build uses monolith via SECTION.
  console.log("✅ Recruit section routes registered (stub - use monolith with SECTION=recruit)");
}
