// Force immediate sync to check for Chris's call
import { supabase } from './server/supabase.js';

async function checkAfterForcedSync() {
  console.log('🔄 CHECKING AFTER FORCED SYNC FOR CHRIS LAFOND CALL');
  
  // Wait a moment for sync to complete
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  try {
    // Check for any new calls in last 5 minutes
    const { data: newCalls } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', fiveMinutesAgo.toISOString())
      .order('call_started_at', { ascending: false });
    
    console.log(`\n📞 CALLS AFTER FORCED SYNC (last 5 min): ${newCalls?.length || 0}`);
    
    if (newCalls && newCalls.length > 0) {
      newCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        const isChris = call.owner_email?.includes('chrislafond');
        
        console.log(`${i+1}. ${isChris ? '🎯 CHRIS!' : '📞'} ${call.owner_email}`);
        console.log(`   ${call.from_number} → ${call.to_number} (${call.call_duration}s)`);
        console.log(`   Time: ${callTime.toLocaleString()}`);
        console.log(`   Status: ${call.call_status}`);
        console.log('');
      });
    } else {
      console.log('❌ STILL NO NEW CALLS FOUND');
    }
    
    // Check specifically for Chris
    const { data: chrisCheck } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .ilike('owner_email', '%chrislafond%')
      .gte('call_started_at', fiveMinutesAgo.toISOString());
    
    if (chrisCheck && chrisCheck.length > 0) {
      console.log('🎯 CHRIS LAFOND CALLS FOUND AFTER SYNC!');
      chrisCheck.forEach(call => {
        console.log(`Found: ${call.twilio_call_sid} at ${new Date(call.call_started_at).toLocaleString()}`);
      });
    } else {
      console.log('❌ Chris LaFond call still NOT found after forced sync');
      console.log('📝 This suggests the call either:');
      console.log('   1. Never actually happened');
      console.log('   2. Failed before reaching Twilio');
      console.log('   3. Was made through a different system');
    }
    
  } catch (error) {
    console.error('❌ Post-sync check failed:', error);
  }
}

checkAfterForcedSync();