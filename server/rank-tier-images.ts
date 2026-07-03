/**
 * Generate rank tier images (Bronze, Silver, Gold, Platinum) via DALL-E 3.
 * Used by POST /api/rank/generate-tier-images and by scripts/generate-rank-tier-images.ts
 */

import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

const RANKS = [
  { id: "bronze", name: "Bronze", prompt: "A premium gaming battle pass tier badge icon for BRONZE rank. Metallic bronze color, shield or medal shape, subtle shine and depth. Clean icon style, no text, suitable for a mobile game or app UI. Square format, centered, dark background." },
  { id: "silver", name: "Silver", prompt: "A premium gaming battle pass tier badge icon for SILVER rank. Metallic silver color, shield or medal shape, reflective shine. Clean icon style, no text, suitable for a mobile game or app UI. Square format, centered, dark background." },
  { id: "gold", name: "Gold", prompt: "A premium gaming battle pass tier badge icon for GOLD rank. Rich metallic gold color, shield or medal shape, luxurious shine and highlight. Clean icon style, no text, suitable for a mobile game or app UI. Square format, centered, dark background." },
  { id: "platinum", name: "Platinum", prompt: "A premium gaming battle pass tier badge icon for PLATINUM rank. Iridescent platinum and light blue-white metallic color, shield or medal shape, elite premium shine. Clean icon style, no text, suitable for a mobile game or app UI. Square format, centered, dark background." },
];

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateRankTierImages(outDir?: string): Promise<{ saved: string[]; errors: string[] }> {
  const { OPENAI_API_KEY } = await import("./hardcoded-config.js");
  const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  if (!apiKey) {
    return { saved: [], errors: ["OPENAI_API_KEY not set"] };
  }

  const dir = outDir ?? path.join(process.cwd(), "client", "public", "images", "ranks");
  fs.mkdirSync(dir, { recursive: true });

  const openai = new OpenAI({ apiKey });
  const saved: string[] = [];
  const errors: string[] = [];

  for (const tier of RANKS) {
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: tier.prompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
      });
      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        errors.push(`${tier.id}: No image URL returned`);
        continue;
      }
      const buffer = await downloadImage(imageUrl);
      const outPath = path.join(dir, `${tier.id}.png`);
      fs.writeFileSync(outPath, buffer);
      saved.push(`${tier.id}.png`);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err: any) {
      errors.push(`${tier.id}: ${err.message ?? String(err)}`);
    }
  }

  return { saved, errors };
}
