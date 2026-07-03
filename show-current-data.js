// Show current data to find Chris's call
import { supabase } from './server/supabase.js';

async function showCurrentData() {
  console.log('🔍 SHOWING ALL CURRENT DATA FOR CHRIS LAFOND');
  
  try {
    // Wait for sync to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const now = new Date();
    const last30Minutes = new Date(now.getTime() - 30 * 60 * 1000);
    
    console.log(`📅 Checking from ${last30Minutes.toISOString()} to now`);
    
    // Get all recent calls
    const { data: allCalls, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', last30Minutes.toISOString())
      .order('call_started_at', { ascending: false });
    
    console.log(`\n📞 ALL CALLS LAST 30 MINUTES: ${allCalls?.length || 0}`);
    
    if (allCalls && allCalls.length > 0) {
      allCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        const isChris = call.owner_email?.toLowerCase().includes('chrislafond');
        
        console.log(`\n${i+1}. ${isChris ? '🎯 CHRIS LAFOND CALL!' : '📞'}`);
        console.log(`   Email: ${call.owner_email}`);
        console.log(`   From: ${call.from_number} → To: ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration}s`);
        console.log(`   Status: ${call.call_status}`);
        console.log(`   Time: ${callTime.toLocaleString()}`);
        console.log(`   Direction: ${call.call_direction}`);
        console.log(`   Phone SID: ${call.phone_number_sid}`);
        console.log(`   Call SID: ${call.twilio_call_sid}`);
      });
    } else {
      console.log('❌ NO RECENT CALLS FOUND');
    }
    
    // Check all Chris calls today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: chrisToday } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .ilike('owner_email', '%chrislafond%')
      .gte('call_started_at', todayStart.toISOString())
      .order('call_started_at', { ascending: false });
    
    console.log(`\n🎯 CHRIS LAFOND CALLS TODAY: ${chrisToday?.length || 0}`);
    
    if (chrisToday && chrisToday.length > 0) {
      console.log('✅ FOUND CHRIS CALLS:');
      chrisToday.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        console.log(`\n${i+1}. Call at ${callTime.toLocaleString()}`);
        console.log(`   ${call.from_number} → ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration} seconds`);
        console.log(`   Status: ${call.call_status}`);
        console.log(`   SID: ${call.twilio_call_sid}`);
        
        if (call.call_duration >= 60) {
          console.log('   🔥 REACHED (60+ seconds)');
        } else {
          console.log(`   ❌ Not reached (${call.call_duration}s)`);
        }
      });
    }
    
    // Show the absolute latest call regardless of owner
    const { data: latestCall } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .order('call_started_at', { ascending: false })
      .limit(1);
    
    if (latestCall && latestCall.length > 0) {
      const call = latestCall[0];
      const callTime = new Date(call.call_started_at);
      const timeDiff = Math.floor((now - callTime) / 1000);
      
      console.log(`\n🕐 LATEST CALL IN ENTIRE DATABASE:`);
      console.log(`   Owner: ${call.owner_email}`);
      console.log(`   Time: ${callTime.toLocaleString()} (${timeDiff} seconds ago)`);
      console.log(`   ${call.from_number} → ${call.to_number}`);
      console.log(`   Duration: ${call.call_duration}s`);
      console.log(`   Status: ${call.call_status}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

showCurrentData();