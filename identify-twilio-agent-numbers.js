// Identify which Twilio numbers belong to which agents
// This will help us build the comprehensive phone mapping

async function identifyTwilioNumbers() {
  try {
    console.log('🔍 ANALYZING ALL TWILIO PHONE NUMBERS FOR AGENT ATTRIBUTION');
    
    // Get all Twilio phone numbers
    const response = await fetch('http://localhost:5000/api/analytics/live-stats');
    const data = await response.json();
    
    console.log('📊 Current system attribution:');
    data.agents.forEach(agent => {
      if (agent.dials > 0) {
        console.log(`${agent.email}: ${agent.dials} calls`);
      }
    });
    
    console.log('\n🎯 TWILIO ATTRIBUTION STRATEGY:');
    console.log('1. David uses: +16052500834, +19142289324');
    console.log('2. Need to identify other agent numbers from actual Twilio calls');
    console.log('3. Kingsley has 8 calls in database - need to find his Twilio number');
    
    // The key insight: We need to look at actual Twilio call logs
    // to see which phone numbers are making calls and match them to agents
    
    console.log('\n💡 NEXT STEPS:');
    console.log('- Pull actual Twilio calls from last 3 days');
    console.log('- Identify unique FROM numbers making outbound calls');
    console.log('- Cross-reference with database calls to determine agent attribution');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

identifyTwilioNumbers();