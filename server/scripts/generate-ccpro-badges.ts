/**
 * One-time script to generate CCPro badge images using OpenAI DALL-E
 * Generates 4 badge images: gold, platinum, diamond, blue-diamond
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get OpenAI API key from hardcoded-config
const { HARDCODED_CONFIG } = await import('../hardcoded-config.js');
const OPENAI_API_KEY = (HARDCODED_CONFIG as any).OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in hardcoded-config or environment variables');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const badges = [
  {
    id: 'gold',
    name: 'Gold',
    prompt: 'A premium animated badge icon for Gold rank, gaming aesthetic, metallic gold with glow effects, professional design, circular badge with elegant borders, shiny gold texture, subtle animation hints, high quality, 512x512 pixels, centered composition',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    prompt: 'A premium animated badge icon for Platinum rank, gaming aesthetic, metallic platinum silver with blue glow effects, professional design, circular badge with elegant borders, shiny platinum texture, subtle animation hints, high quality, 512x512 pixels, centered composition',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    prompt: 'A premium animated badge icon for Diamond rank, gaming aesthetic, brilliant diamond with cyan and blue glow effects, professional design, circular badge with elegant borders, crystalline diamond texture, subtle animation hints, high quality, 512x512 pixels, centered composition',
  },
  {
    id: 'blue-diamond',
    name: 'Blue Diamond',
    prompt: 'A premium animated badge icon for Blue Diamond rank, gaming aesthetic, brilliant blue diamond with purple and indigo glow effects, professional design, circular badge with elegant borders, crystalline blue diamond texture, subtle animation hints, high quality, 512x512 pixels, centered composition',
  },
];

async function generateBadge(badge: typeof badges[0]): Promise<void> {
  console.log(`\n🎨 Generating ${badge.name} badge...`);
  
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: badge.prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }

    console.log(`✅ Generated ${badge.name} badge image URL: ${imageUrl}`);

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Create output directory
    const outputDir = path.join(__dirname, '../../client/public/images/ccpro-ranks');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created directory: ${outputDir}`);
    }

    // Save image
    const outputPath = path.join(outputDir, `${badge.id}.png`);
    fs.writeFileSync(outputPath, Buffer.from(imageBuffer));
    console.log(`💾 Saved ${badge.name} badge to: ${outputPath}`);

  } catch (error: any) {
    console.error(`❌ Error generating ${badge.name} badge:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting CCPro badge generation...');
  console.log(`📂 Output directory: ${path.join(__dirname, '../../client/public/images/ccpro-ranks')}`);
  
  for (const badge of badges) {
    try {
      await generateBadge(badge);
      // Wait 1 second between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`❌ Failed to generate ${badge.name} badge:`, error.message);
      // Continue with next badge
    }
  }

  console.log('\n✅ Badge generation complete!');
  console.log('📁 Badges saved to: client/public/images/ccpro-ranks/');
}

// Always run when executed directly
main().catch(console.error);
