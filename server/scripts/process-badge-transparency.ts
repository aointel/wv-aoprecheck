/**
 * Process badge images to remove black/white backgrounds and make them transparent
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const badgesDir = path.join(__dirname, '../../client/public/images/badges');
const badgeFiles = [
  'Gold_256px.png',
  'Plat_256px.png',
  'Diamond_256px.png',
  'Unreal_256px.png',
];

async function processBadge(fileName: string) {
  const inputPath = path.join(badgesDir, fileName);
  const outputPath = path.join(badgesDir, fileName.replace('.png', '_transparent.png'));

  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠️ File not found: ${inputPath}`);
    return;
  }

  console.log(`\n🔄 Processing ${fileName}...`);

  try {
    // Read the image
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Remove black/white/dark backgrounds and make transparent
    const processed = await image
      .ensureAlpha()
      .composite([
        {
          input: Buffer.from([0, 0, 0, 0]), // Transparent
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in'
        }
      ])
      .removeAlpha()
      .ensureAlpha()
      .toBuffer();

    // Use threshold to remove dark backgrounds
    const { data, info } = await sharp(inputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);
    const newPixels = new Uint8Array(pixels.length);

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      // If pixel is very dark (black background), make it transparent
      const isDark = r < 30 && g < 30 && b < 30;
      // If pixel is very light (white background), make it transparent
      const isLight = r > 240 && g > 240 && b > 240;

      if (isDark || isLight) {
        newPixels[i] = r;
        newPixels[i + 1] = g;
        newPixels[i + 2] = b;
        newPixels[i + 3] = 0; // Transparent
      } else {
        newPixels[i] = r;
        newPixels[i + 1] = g;
        newPixels[i + 2] = b;
        newPixels[i + 3] = a;
      }
    }

    await sharp(newPixels, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .png()
      .toFile(outputPath);

    // Replace original with processed version
    fs.renameSync(outputPath, inputPath);
    console.log(`✅ Processed ${fileName} - removed background`);

  } catch (error: any) {
    console.error(`❌ Error processing ${fileName}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Processing badges to remove backgrounds...');
  
  for (const file of badgeFiles) {
    await processBadge(file);
  }

  console.log('\n✅ Background removal complete!');
}

main().catch(console.error);
