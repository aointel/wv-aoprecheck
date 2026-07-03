// Check the most recent Twilio call that just happened
import { supabase } from './server/supabase.js';

async function checkLatestTwilioCall() {
  console.log('🚨 CHECKING MOST RECENT TWILIO CALL - JUST HAPPENED');
  
  const now = new Date();
  const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
  
  console.log(`\n⏰ Checking last 2 minutes: ${twoMinutesAgo.toISOString()} to ${now.toISOString()}`);
  
  try {
    // Get the most recent calls from Supabase
    const { data: recentCalls, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', twoMinutesAgo.toISOString())
      .order('call_started_at', { ascending: false })
      .limit(5);
    
    console.log(`\n📞 MOST RECENT CALLS (last 2 min): ${recentCalls?.length || 0}`);
    
    if (recentCalls && recentCalls.length > 0) {
      recentCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        const isChris = call.owner_email?.includes('chrislafond');
        
        console.log(`\n${i+1}. ${isChris ? '🎯 CHRIS LAFOND CALL!' : '📞'} ${call.call_direction.toUpperCase()}`);
        console.log(`   Owner: ${call.owner_email}`);
        console.log(`   From: ${call.from_number}`);
        console.log(`   To: ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration}s`);
        console.log(`   Status: ${call.call_status}`);
        console.log(`   Time: ${callTime.toLocaleString()}`);
        console.log(`   SID: ${call.twilio_call_sid}`);
        console.log(`   Phone SID: ${call.phone_number_sid}`);
        
        if (isChris) {
          console.log(`   🔥 FOUND CHRIS'S CALL! Duration: ${call.call_duration}s`);
          if (call.call_duration >= 60) {
            console.log(`   ✅ REACHED (60+ seconds)`);
          } else {
            console.log(`   ❌ Not reached (under 60 seconds)`);
          }
        }
      });
    } else {
      console.log('❌ NO RECENT CALLS FOUND');
    }
    
    // Also check the absolute latest call regardless of time
    const { data: latestCall } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .order('call_started_at', { ascending: false })
      .limit(1);
    
    if (latestCall && latestCall.length > 0) {
      const call = latestCall[0];
      const callTime = new Date(call.call_started_at);
      const timeDiff = Math.floor((now - callTime) / 1000);
      
      console.log(`\n🕒 ABSOLUTE LATEST CALL IN DATABASE:`);
      console.log(`   Time: ${callTime.toLocaleString()} (${timeDiff} seconds ago)`);
      console.log(`   Owner: ${call.owner_email}`);
      console.log(`   Direction: ${call.call_direction}`);
      console.log(`   Duration: ${call.call_duration}s`);
      console.log(`   Status: ${call.call_status}`);
      console.log(`   From: ${call.from_number} → ${call.to_number}`);
    }
    
    // Check if Chris has ANY calls today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: chrisToday } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .ilike('owner_email', '%chrislafond%')
      .gte('call_started_at', todayStart.toISOString())
      .order('call_started_at', { ascending: false});
    
    console.log(`\n🔍 CHRIS LAFOND'S CALLS TODAY: ${chrisToday?.length || 0}`);
    
    if (chrisToday && chrisToday.length > 0) {
      chrisToday.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        console.log(`${i+1}. ${callTime.toLocaleString()}`);
        console.log(`   ${call.from_number} → ${call.to_number} (${call.call_duration}s)`);
        console.log(`   Status: ${call.call_status}`);
        console.log('');
      });
    } else {
      console.log('❌ CHRIS LAFOND HAS NO CALLS IN DATABASE TODAY');
    }
    
  } catch (error) {
    console.error('❌ Latest call check failed:', error);
  }
}

checkLatestTwilioCall();