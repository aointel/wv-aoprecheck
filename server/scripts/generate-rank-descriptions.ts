/**
 * Generate AI-powered rank descriptions and advantages using OpenAI
 * Creates Fortnite-style gaming descriptions for Gold, Platinum, Diamond, Blue Diamond
 */

import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { HARDCODED_CONFIG } from '../hardcoded-config.js';

const OPENAI_API_KEY = (HARDCODED_CONFIG as any).OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const tiers = [
  {
    id: 'gold',
    name: 'Gold',
    threshold: 0,
    color: '#D4AF37',
    prompt: 'Create a Fortnite-style gaming description for a Gold tier rank badge. This is the entry elite tier - clean, prestigious, strong. The badge has a hexagonal shield with minimal wings, warm metallic gold color. Write a cool, exciting description (2-3 sentences) that makes players feel like they\'ve achieved something special. Also provide 3-4 advantages that sound like gaming perks (e.g., "Priority Queue Access", "Exclusive Gold Badge", etc.). Make it sound like a battle pass or prestige system.',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    threshold: 1000,
    color: '#C8CCD6',
    prompt: 'Create a Fortnite-style gaming description for a Platinum tier rank badge. This is refined, cold prestige - sharp and elevated. The badge has a hexagonal shield with small wing extensions, silver-platinum metallic color. Write a cool, exciting description (2-3 sentences) that makes players feel elite and powerful. Also provide 3-4 advantages that sound like premium gaming perks. Make it sound like a battle pass or prestige system.',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    threshold: 2000,
    color: '#9B5CF6',
    prompt: 'Create a Fortnite-style gaming description for a Diamond tier rank badge. This is high rank - energetic, elite, competitive. The badge has a hexagonal shield with medium wings and dual ribbon tails, purple diamond core. Write a cool, exciting description (2-3 sentences) that makes players feel like top-tier competitors. Also provide 4-5 advantages that sound like exclusive gaming perks. Make it sound like a battle pass or prestige system.',
  },
  {
    id: 'blue-diamond',
    name: 'Blue Diamond',
    threshold: 5000,
    color: '#3B82F6',
    prompt: 'Create a Fortnite-style gaming description for a Blue Diamond tier rank badge. This is the ultimate tier - rare, premium, commanding. The badge has a hexagonal shield with large extended wings and triple ribbon tails, electric blue diamond core with neon glow. Write a cool, exciting description (2-3 sentences) that makes players feel legendary and unstoppable. Also provide 5-6 advantages that sound like the most exclusive gaming perks. Make it sound like a battle pass or prestige system.',
  },
];

async function generateTierContent(tier: typeof tiers[0]) {
  console.log(`\n🎮 Generating ${tier.name} tier content...`);
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a creative gaming content writer specializing in Fortnite-style battle pass and prestige systems. Write exciting, engaging descriptions that make players feel accomplished and motivated.',
        },
        {
          role: 'user',
          content: tier.prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    console.log(`✅ Generated ${tier.name} content:`);
    console.log(content);
    console.log('\n---\n');

    // Parse the response to extract description and advantages
    // The AI should return a description and a list of advantages
    return content;

  } catch (error: any) {
    console.error(`❌ Error generating ${tier.name} content:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Generating AI-powered rank descriptions and advantages...\n');
  
  const results: Record<string, { description: string; advantages: string[] }> = {};

  for (const tier of tiers) {
    try {
      const content = await generateTierContent(tier);
      
      // Try to parse the content (AI should format it nicely)
      // For now, we'll manually extract or use the full content
      results[tier.id] = {
        description: content.split('\n')[0] || content,
        advantages: content.split('\n').slice(1).filter(line => line.trim().length > 0),
      };
      
      // Wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`❌ Failed to generate ${tier.name} content:`, error.message);
    }
  }

  console.log('\n✅ Generation complete!');
  console.log('\n📋 Results:');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
