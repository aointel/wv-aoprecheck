import fetch from 'node-fetch';

console.log('🤖 Running AI analysis on sessions with scraped data...\n');

// Sessions with scraped data (from backfill)
const sessionsToAnalyze = [
  'session_1761428935414_58d3y3a7c', // Leyna - 88 points
  'session_1761440606476_lsdsbql0l', // Leyna - 32 points
  'session_1761450648520_v9c799qvv'  // Dianka - 880 points
];

for (const sessionId of sessionsToAnalyze) {
  console.log(`\n🔍 Analyzing: ${sessionId}`);
  
  try {
    const response = await fetch(`https://aoirail-production.up.railway.app/api/presentations/analyze/${sessionId}`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Analysis complete!`);
      console.log(`   - Data points: ${data.metadata?.dataPointsAnalyzed}`);
      console.log(`   - Client: ${data.analysis?.clientInfo?.primary_first_name} ${data.analysis?.clientInfo?.primary_last_name}`);
      console.log(`   - Disposition: ${data.analysis?.disposition}`);
      console.log(`   - Furthest milestone: ${data.analysis?.furthestMilestone}`);
      console.log(`   - ALP: ${data.analysis?.premiumAmounts?.selected_plan_alp}`);
    } else {
      console.log(`❌ Failed: ${data.error}`);
    }
    
    // Wait 2 seconds between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

console.log(`\n✅ All sessions analyzed! Check presentation-analytics to see results.`);

