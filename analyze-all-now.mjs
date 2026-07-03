import fetch from 'node-fetch';

console.log('🤖 Triggering AI analysis on ALL sessions with scraped data...\n');

// Get all sessions that need analysis
const sessionsResponse = await fetch('https://aoirail-production.up.railway.app/api/presentations/sessions');
const sessionsData = await sessionsResponse.json();

console.log(`📊 Found ${sessionsData.total} total sessions\n`);

// Filter to sessions that have scraped data but no ai_summary
const needAnalysis = sessionsData.sessions?.filter(s => 
  !s.ai_summary && s.electron_session_id
) || [];

console.log(`🎯 ${needAnalysis.length} sessions need analysis\n`);

let analyzed = 0;
let failed = 0;

for (const session of needAnalysis.slice(0, 20)) { // Limit to 20 to avoid timeout
  console.log(`Analyzing: ${session.agent_email} - ${session.electron_session_id}`);
  
  try {
    const response = await fetch(`https://aoirail-production.up.railway.app/api/presentations/analyze/${session.electron_session_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`  ✅ Success! Client: ${data.analysis?.clientInfo?.full_name || 'N/A'}, ALP: ${data.analysis?.alp || 'N/A'}`);
      analyzed++;
    } else {
      console.log(`  ❌ Failed: ${data.error}`);
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    failed++;
  }
  
  // Wait 2 seconds between each to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 2000));
}

console.log(`\n✅ Batch complete!`);
console.log(`   Analyzed: ${analyzed}`);
console.log(`   Failed: ${failed}`);
console.log(`\n🔄 Refresh presentation-analytics to see results!`);

