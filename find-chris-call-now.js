// Find Chris LaFond's call that just happened
import { supabase } from './server/supabase.js';

async function findChrisCallNow() {
  console.log('🎯 SEARCHING FOR CHRIS LAFOND CALL THAT JUST HAPPENED');
  
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  
  console.log(`⏰ Searching last 10 minutes: ${tenMinutesAgo.toISOString()} to ${now.toISOString()}`);
  
  try {
    // Get all recent calls
    const { data: recentCalls, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', tenMinutesAgo.toISOString())
      .order('call_started_at', { ascending: false });
    
    console.log(`\n📞 ALL RECENT CALLS (last 10 min): ${recentCalls?.length || 0}`);
    
    if (recentCalls && recentCalls.length > 0) {
      recentCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        const isChris = call.owner_email?.toLowerCase().includes('chrislafond');
        
        console.log(`\n${i+1}. ${isChris ? '🎯 CHRIS LAFOND!' : '📞'} Call`);
        console.log(`   Owner: ${call.owner_email}`);
        console.log(`   Direction: ${call.call_direction}`);
        console.log(`   From: ${call.from_number}`);
        console.log(`   To: ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration} seconds`);
        console.log(`   Status: ${call.call_status}`);
        console.log(`   Time: ${callTime.toLocaleString()}`);
        console.log(`   SID: ${call.twilio_call_sid}`);
        
        if (isChris) {
          console.log('🔥 FOUND CHRIS LAFOND\'S CALL!');
          if (call.call_duration >= 60) {
            console.log('✅ REACHED (60+ seconds)');
          } else {
            console.log(`❌ Not reached (${call.call_duration} seconds)`);
          }
        }
      });
    } else {
      console.log('❌ No calls found in last 10 minutes');
    }
    
    // Also check for any Chris calls in the last hour just in case
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const { data: chrisHour, error: hourError } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .ilike('owner_email', '%chrislafond%')
      .gte('call_started_at', oneHourAgo.toISOString())
      .order('call_started_at', { ascending: false});
    
    console.log(`\n🔍 CHRIS CALLS (last hour): ${chrisHour?.length || 0}`);
    
    if (chrisHour && chrisHour.length > 0) {
      console.log('🎯 CHRIS LAFOND CALLS FOUND:');
      chrisHour.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        const minutesAgo = Math.floor((now - callTime) / 60000);
        console.log(`${i+1}. ${callTime.toLocaleString()} (${minutesAgo} min ago)`);
        console.log(`   ${call.from_number} → ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration}s | Status: ${call.call_status}`);
        console.log(`   SID: ${call.twilio_call_sid}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

findChrisCallNow();