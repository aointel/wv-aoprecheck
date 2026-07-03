import type { Express } from "express";

/**
 * Landing image routes (e.g. generate-image).
 * Stub implementation so build passes; replace with real image generation if needed.
 */
export function registerLandingImageRoutes(app: Express): void {
  app.post("/api/landing/generate-image", (req, res) => {
    // Stub: return no image URL so client can skip or use fallback
    res.json({ imageUrl: null });
  });
}
