// Check timezone differences between Twilio UTC and local time
import { supabase } from './server/supabase.js';

async function checkTimezoneIssue() {
  console.log('🕐 CHECKING TIMEZONE DIFFERENCES - TWILIO UTC vs LOCAL TIME');
  
  const now = new Date();
  console.log('\n📅 CURRENT TIME ANALYSIS:');
  console.log(`Local time: ${now.toString()}`);
  console.log(`UTC time: ${now.toISOString()}`);
  console.log(`Local date: ${now.toDateString()}`);
  console.log(`UTC date: ${now.toISOString().split('T')[0]}`);
  
  // Check if we're in a different day due to timezone
  const localDate = new Date();
  localDate.setHours(0, 0, 0, 0);
  
  const utcDate = new Date();
  utcDate.setUTCHours(0, 0, 0, 0);
  
  console.log(`\n🌍 TIMEZONE COMPARISON:`);
  console.log(`Local midnight: ${localDate.toISOString()}`);
  console.log(`UTC midnight: ${utcDate.toISOString()}`);
  console.log(`Difference: ${(localDate - utcDate) / (1000 * 60 * 60)} hours`);
  
  try {
    // Get recent Twilio calls to see actual timestamps
    const { data: recentCalls, error } = await supabase
      .from('twilio_call_logs')
      .select('twilio_call_sid, call_started_at, call_direction, owner_email, call_duration')
      .order('call_started_at', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error('❌ Error getting recent calls:', error);
      return;
    }
    
    console.log(`\n📞 RECENT TWILIO CALLS (last 10):`);
    if (recentCalls && recentCalls.length > 0) {
      recentCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        const localTime = callTime.toLocaleString();
        const utcTime = callTime.toISOString();
        
        console.log(`${i+1}. ${call.call_direction} call (${call.call_duration}s) - ${call.owner_email}`);
        console.log(`   UTC: ${utcTime}`);
        console.log(`   Local: ${localTime}`);
        console.log(`   Date: ${callTime.toDateString()}`);
        console.log('');
      });
    } else {
      console.log('No recent calls found');
    }
    
    // Check today's calls using different timezone approaches
    console.log('\n🔍 TESTING DIFFERENT TIMEZONE FILTERS:');
    
    // Method 1: Local date boundaries
    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const tomorrowLocal = new Date(todayLocal);
    tomorrowLocal.setDate(tomorrowLocal.getDate() + 1);
    
    const { data: localCalls } = await supabase
      .from('twilio_call_logs')
      .select('twilio_call_sid')
      .gte('call_started_at', todayLocal.toISOString())
      .lt('call_started_at', tomorrowLocal.toISOString());
    
    console.log(`Method 1 - Local boundaries (${todayLocal.toISOString()} to ${tomorrowLocal.toISOString()}):`);
    console.log(`Found ${localCalls?.length || 0} calls`);
    
    // Method 2: UTC date boundaries  
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const tomorrowUTC = new Date(todayUTC);
    tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);
    
    const { data: utcCalls } = await supabase
      .from('twilio_call_logs')
      .select('twilio_call_sid')
      .gte('call_started_at', todayUTC.toISOString())
      .lt('call_started_at', tomorrowUTC.toISOString());
    
    console.log(`Method 2 - UTC boundaries (${todayUTC.toISOString()} to ${tomorrowUTC.toISOString()}):`);
    console.log(`Found ${utcCalls?.length || 0} calls`);
    
    // Method 3: Check recent outbound calls regardless of date
    const { data: outboundCalls } = await supabase
      .from('twilio_call_logs')
      .select('twilio_call_sid, call_started_at, owner_email, call_duration, call_direction')
      .eq('call_direction', 'outbound')
      .order('call_started_at', { ascending: false })
      .limit(20);
    
    console.log(`\n📞 RECENT OUTBOUND CALLS (last 20):`);
    if (outboundCalls && outboundCalls.length > 0) {
      outboundCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        const isToday = callTime.toDateString() === now.toDateString();
        console.log(`${i+1}. ${call.owner_email} - ${callTime.toLocaleString()} (${call.call_duration}s) ${isToday ? '🔥 TODAY' : ''}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Timezone check failed:', error);
  }
}

checkTimezoneIssue();