// Test the new Supabase-only analytics endpoint
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

async function testSupabaseAnalytics() {
  console.log('🧪 TESTING SUPABASE-ONLY ANALYTICS ENDPOINT\n');
  
  try {
    const url = 'https://aointelligence.replit.app/api/analytics/live-stats';
    console.log(`📡 Making request to: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response headers:`, response.headers.get('content-type'));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS: Analytics data received');
      console.log(`🔍 Data source: ${data.dataSource || 'not specified'}`);
      console.log(`📊 Total dials: ${data.totals?.total_dials || 0}`);
      console.log(`👥 Active agents: ${data.agents?.length || 0}`);
      
      if (data.agents?.length > 0) {
        console.log('\n📋 Agent breakdown:');
        data.agents.forEach(agent => {
          console.log(`   ${agent.name}: ${agent.dials} dials, ${agent.reached} reached`);
        });
      }
      
      console.log('\n🎯 EXPECTED RESULTS:');
      console.log('   - dataSource: "supabase_twilio_call_logs_only"');
      console.log('   - Chris LaFond: 0 dials (Supabase table is empty)');
      console.log('   - Total dials: 0 (from Supabase only)');
      
    } else {
      const text = await response.text();
      console.log('❌ FAILED: Non-JSON response received');
      console.log('Response preview:', text.substring(0, 200));
      console.log('\n🔍 This suggests the request is being routed to the frontend instead of API');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSupabaseAnalytics();