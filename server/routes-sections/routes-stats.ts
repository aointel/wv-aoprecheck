/**
 * Stats section routes - Live Call Board, analytics, reports.
 * Extracted for compartmentalized builds. Used by entry-stats.ts and routes.ts (monolith).
 * TODO: Full route extraction from routes.ts - register here when extracted.
 */
import type { Express } from "express";

export async function registerStatsRoutes(_app: Express): Promise<void> {
  console.log("🔧 Registering Stats section routes...");
  // Stub: Full implementation remains in routes.ts. Compartmentalized build uses monolith via SECTION.
  console.log("✅ Stats section routes registered (stub - use monolith with SECTION=stats)");
}
