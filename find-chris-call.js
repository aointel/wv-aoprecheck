// URGENT: Find Chris LaFond's recent call
import { supabase } from './server/supabase.js';

async function findChrisCall() {
  console.log('🚨 URGENT: SEARCHING FOR CHRIS LAFOND\'S RECENT CALL');
  
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  console.log(`\n⏰ Searching for calls in last 5 minutes:`);
  console.log(`From: ${fiveMinutesAgo.toISOString()}`);
  console.log(`To: ${now.toISOString()}`);
  
  try {
    // 1. Check Supabase twilio_call_logs for recent calls
    const { data: recentCalls, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', fiveMinutesAgo.toISOString())
      .order('call_started_at', { ascending: false });
    
    console.log(`\n📞 RECENT TWILIO CALLS (last 5 min): ${recentCalls?.length || 0}`);
    
    if (recentCalls && recentCalls.length > 0) {
      recentCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        console.log(`${i+1}. ${call.call_direction} | ${call.owner_email}`);
        console.log(`   ${call.from_number} → ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration}s | Status: ${call.call_status}`);
        console.log(`   Time: ${callTime.toLocaleString()}`);
        console.log(`   SID: ${call.twilio_call_sid}`);
        console.log('');
      });
    }
    
    // 2. Check for any Chris LaFond calls in last 30 minutes
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    
    const { data: chrisCalls } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .ilike('owner_email', '%chrislafond%')
      .gte('call_started_at', thirtyMinutesAgo.toISOString())
      .order('call_started_at', { ascending: false });
    
    console.log(`\n🔍 CHRIS LAFOND CALLS (last 30 min): ${chrisCalls?.length || 0}`);
    
    if (chrisCalls && chrisCalls.length > 0) {
      chrisCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        console.log(`${i+1}. FOUND CHRIS CALL!`);
        console.log(`   Direction: ${call.call_direction}`);
        console.log(`   ${call.from_number} → ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration}s`);
        console.log(`   Status: ${call.call_status}`);
        console.log(`   Time: ${callTime.toLocaleString()}`);
        console.log(`   Owner: ${call.owner_email}`);
        console.log('');
      });
    } else {
      console.log('❌ NO CHRIS LAFOND CALLS FOUND IN SUPABASE');
    }
    
    // 3. Check all recent calls regardless of owner to see if attribution failed
    const { data: allRecentCalls } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', fiveMinutesAgo.toISOString())
      .order('call_started_at', { ascending: false});
    
    console.log(`\n🔍 ALL RECENT CALLS (any owner): ${allRecentCalls?.length || 0}`);
    
    if (allRecentCalls && allRecentCalls.length > 0) {
      allRecentCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        console.log(`${i+1}. ${call.call_direction} | Owner: ${call.owner_email}`);
        console.log(`   ${call.from_number} → ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration}s`);
        console.log(`   Time: ${callTime.toLocaleString()}`);
        console.log('');
      });
    }
    
    // 4. Force immediate sync check
    console.log('\n🔄 CHECKING IF AUTO SYNC IS BEHIND...');
    console.log('Next scheduled sync should capture any new Twilio calls within 60 seconds');
    
  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

findChrisCall();