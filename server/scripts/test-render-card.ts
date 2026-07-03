/**
 * Test script: Render activity card directly
 */

import { renderActivityCard } from './render-activity-card';

async function testRenderCard() {
  try {
    console.log('🎨 Rendering activity card with demo data...');
    
    const outputPath = await renderActivityCard();
    
    console.log('✅ Activity card rendered successfully!');
    console.log('📁 Output path:', outputPath);
    return outputPath;
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run if executed directly
if (process.argv[1]?.includes('test-render-card.ts')) {
  testRenderCard()
    .then(() => {
      console.log('✅ Test complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}
