/**
 * Add demo AOI cards for cnsysop for testing
 * Run: npx tsx server/scripts/add-demo-cards-cnsysop.ts
 */

import { warService } from '../war-service';

async function main() {
  const agentEmail = 'cnsysop@aoglobelife.com';
  
  console.log(`🎯 Adding 5 demo AOI cards for ${agentEmail}...`);
  
  try {
    const demoCards = await warService.addDemoAoiCards(agentEmail);
    
    console.log(`✅ Successfully added ${demoCards.length} demo AOI cards:`);
    demoCards.forEach((card: any, index: number) => {
      console.log(`   ${index + 1}. ${card.lead_name} - ${card.connect_id}`);
    });
    
    console.log(`\n🎉 Demo cards added! Visit /war-reports to see them.`);
  } catch (error) {
    console.error('❌ Failed to add demo cards:', error);
    process.exit(1);
  }
}

main();
