/**
 * Generate 20 variations of simple Fortnite-style gold shield/badge
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { HARDCODED_CONFIG } = await import('../hardcoded-config.js');
const OPENAI_API_KEY = (HARDCODED_CONFIG as any).OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Simple Fortnite-style gold shield/badge prompt - NOT exotic or intricate
const basePrompt = 'Simple Fortnite-style esports badge: basic gold shield or badge shape, clean metallic gold color, minimal design, no intricate details, no gems or complex elements, just a simple shield or badge icon. Icon-style, vector-like, transparent background, designed to overlay cleanly, 1024x1024';

async function generateGoldBadgeVariation(version: number): Promise<void> {
  console.log(`\n🎨 Generating Gold badge variation ${version}/20...`);
  
  try {
    // Add slight variation to prompt for each version
    const variationPrompts = [
      'Simple Fortnite-style esports badge: basic gold shield shape, clean metallic gold, minimal design, no intricate details, just a simple shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold badge shape, clean metallic gold, minimal design, no intricate details, just a simple badge icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold rounded shield, clean metallic gold, minimal design, no intricate details, just a simple rounded shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold hexagonal shield, clean metallic gold, minimal design, no intricate details, just a simple hexagonal shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold circular badge, clean metallic gold, minimal design, no intricate details, just a simple circular badge icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold oval shield, clean metallic gold, minimal design, no intricate details, just a simple oval shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold square shield, clean metallic gold, minimal design, no intricate details, just a simple square shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold rectangular badge, clean metallic gold, minimal design, no intricate details, just a simple rectangular badge icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold triangular shield, clean metallic gold, minimal design, no intricate details, just a simple triangular shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold pentagon shield, clean metallic gold, minimal design, no intricate details, just a simple pentagon shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold shield with rounded top, clean metallic gold, minimal design, no intricate details, just a simple shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold shield with pointed top, clean metallic gold, minimal design, no intricate details, just a simple shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold badge with thick border, clean metallic gold, minimal design, no intricate details, just a simple badge icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold badge with thin border, clean metallic gold, minimal design, no intricate details, just a simple badge icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold shield with flat top, clean metallic gold, minimal design, no intricate details, just a simple shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold shield with curved sides, clean metallic gold, minimal design, no intricate details, just a simple shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold badge with straight edges, clean metallic gold, minimal design, no intricate details, just a simple badge icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold shield with beveled edges, clean metallic gold, minimal design, no intricate details, just a simple shield icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold badge with soft glow, clean metallic gold, minimal design, no intricate details, just a simple badge icon. Icon-style, vector-like, transparent background, 1024x1024',
      'Simple Fortnite-style esports badge: basic gold shield with subtle shine, clean metallic gold, minimal design, no intricate details, just a simple shield icon. Icon-style, vector-like, transparent background, 1024x1024',
    ];

    const prompt = variationPrompts[version - 1] || basePrompt;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }

    console.log(`✅ Generated Gold badge v${version} image URL`);

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Post-process with sharp to remove black background and make it transparent
    const image = sharp(Buffer.from(imageBuffer));
    const { width, height } = await image.metadata();
    
    // Convert to RGBA to ensure alpha channel exists
    let processed = image.ensureAlpha();
    
    // Create a mask that makes black/dark pixels transparent
    // We'll extract the image, create a mask from it, and composite
    const imageData = await processed.raw().toBuffer();
    const maskData = Buffer.alloc(width! * height! * 4);
    
    // Process each pixel: if it's very dark (black background), make it transparent
    for (let i = 0; i < imageData.length; i += 4) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const a = imageData[i + 3];
      
      // Calculate brightness
      const brightness = (r + g + b) / 3;
      
      // If pixel is very dark (likely black background), make it transparent
      // Otherwise keep original alpha
      const newAlpha = brightness < 30 ? 0 : a;
      
      maskData[i] = r;
      maskData[i + 1] = g;
      maskData[i + 2] = b;
      maskData[i + 3] = newAlpha;
    }
    
    // Create new image with modified alpha
    const processedBuffer = await sharp(maskData, {
      raw: {
        width: width!,
        height: height!,
        channels: 4
      }
    })
    .png({ quality: 90, compressionLevel: 9, force: true })
    .toBuffer();
    
    // Create badges directory
    const badgesDir = path.join(__dirname, '../../client/public/images/badges');
    if (!fs.existsSync(badgesDir)) {
      fs.mkdirSync(badgesDir, { recursive: true });
      console.log(`📁 Created directory: ${badgesDir}`);
    }
    
    // Save with version number
    const outputPath = path.join(badgesDir, `Gold_256px_v${version}.png`);
    fs.writeFileSync(outputPath, processedBuffer);
    console.log(`💾 Saved Gold badge v${version} to: ${outputPath}`);

    // Wait 2 seconds between generations to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error: any) {
    console.error(`❌ Error generating Gold badge v${version}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Generating 20 variations of simple Fortnite-style Gold badge...');
  console.log(`📂 Output directory: ${path.join(__dirname, '../../client/public/images/badges')}`);
  
  const totalVariations = 20;
  let successCount = 0;
  let failCount = 0;

  for (let i = 1; i <= totalVariations; i++) {
    try {
      await generateGoldBadgeVariation(i);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Failed to generate Gold badge v${i}:`, error.message);
      failCount++;
    }
  }

  console.log(`\n✅ Gold badge generation complete!`);
  console.log(`   Success: ${successCount}/${totalVariations}`);
  console.log(`   Failed: ${failCount}/${totalVariations}`);
}

main().catch(console.error);
