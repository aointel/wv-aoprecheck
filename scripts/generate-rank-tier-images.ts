/**
 * Generate rank tier images (Bronze, Silver, Gold, Platinum) using OpenAI DALL-E 3.
 * Saves to client/public/images/ranks/
 *
 * Run: npx tsx scripts/generate-rank-tier-images.ts
 * Or with app running: curl -X POST http://localhost:5000/api/rank/generate-tier-images
 */

import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "client", "public", "images", "ranks");

async function main() {
  const { generateRankTierImages } = await import("../server/rank-tier-images");
  console.log("🎨 Generating rank tier images (DALL-E 3)...\n");
  const { saved, errors } = await generateRankTierImages(outDir);
  if (saved.length) console.log("✅ Saved:", saved.join(", "));
  if (errors.length) console.error("❌ Errors:", errors);
  console.log("\n🎉 Done. Images in client/public/images/ranks/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
