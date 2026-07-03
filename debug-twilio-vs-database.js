// Debug: Check if Chris LaFond's call exists in database but not in tracking
import { supabase } from './server/supabase.js';

async function debugTwilioVsDatabase() {
  console.log('🚨 DEBUGGING: CHRIS LAFOND CALL TRACKING DISCREPANCY');
  
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  console.log(`\n⏰ Checking last hour: ${oneHourAgo.toISOString()} to ${now.toISOString()}`);
  
  try {
    // 1. Check ALL recent calls in twilio_call_logs
    const { data: allRecentCalls, error: allError } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', oneHourAgo.toISOString())
      .order('call_started_at', { ascending: false });
    
    console.log(`\n📞 ALL RECENT CALLS IN TWILIO_CALL_LOGS: ${allRecentCalls?.length || 0}`);
    
    if (allRecentCalls && allRecentCalls.length > 0) {
      allRecentCalls.forEach((call, i) => {
        console.log(`${i+1}. ${call.call_direction} | ${call.owner_email} | ${call.call_duration}s`);
        console.log(`   ${call.from_number} → ${call.to_number}`);
        console.log(`   Time: ${new Date(call.call_started_at).toLocaleString()}`);
        console.log(`   SID: ${call.twilio_call_sid}`);
        console.log('');
      });
    }
    
    // 2. Check old database tables that might have Chris's call
    console.log('\n🔍 CHECKING OTHER DATABASE SOURCES...');
    
    // Check war_connects table
    const { data: warConnects, error: warError } = await supabase
      .from('war_connects')
      .select('*')
      .ilike('agent_email', '%chrislafond%')
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false });
    
    console.log(`📊 WAR_CONNECTS (Chris, last hour): ${warConnects?.length || 0}`);
    
    if (warConnects && warConnects.length > 0) {
      warConnects.forEach((call, i) => {
        console.log(`${i+1}. 🎯 FOUND IN WAR_CONNECTS: ${call.agent_email}`);
        console.log(`   Lead: ${call.lead_name} (${call.lead_phone})`);
        console.log(`   Time: ${new Date(call.created_at).toLocaleString()}`);
        console.log(`   Status: ${call.disposition}`);
        console.log('');
      });
    }
    
    // Check outbound_call_history table
    const { data: callHistory, error: histError } = await supabase
      .from('outbound_call_history')
      .select('*')
      .ilike('agent_email', '%chrislafond%')
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false});
    
    console.log(`📊 OUTBOUND_CALL_HISTORY (Chris, last hour): ${callHistory?.length || 0}`);
    
    if (callHistory && callHistory.length > 0) {
      callHistory.forEach((call, i) => {
        console.log(`${i+1}. 🎯 FOUND IN CALL_HISTORY: ${call.agent_email}`);
        console.log(`   Lead: ${call.lead_phone}`);
        console.log(`   Time: ${new Date(call.created_at).toLocaleString()}`);
        console.log(`   Duration: ${call.call_duration}s`);
        console.log('');
      });
    }
    
    // Check call_logs table  
    const { data: callLogs, error: logsError } = await supabase
      .from('call_logs')
      .select('*')
      .ilike('agent_email', '%chrislafond%')
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false});
    
    console.log(`📊 CALL_LOGS (Chris, last hour): ${callLogs?.length || 0}`);
    
    if (callLogs && callLogs.length > 0) {
      callLogs.forEach((call, i) => {
        console.log(`${i+1}. 🎯 FOUND IN CALL_LOGS: ${call.agent_email}`);
        console.log(`   Phone: ${call.phone_number}`);
        console.log(`   Time: ${new Date(call.created_at).toLocaleString()}`);
        console.log(`   Status: ${call.call_status}`);
        console.log('');
      });
    }
    
    // 3. Check if Chris made ANY calls today in any table
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    console.log(`\n📅 CHRIS LAFOND'S CALLS TODAY (all sources):`);
    
    // Today's twilio_call_logs
    const { data: todayTwilio } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .ilike('owner_email', '%chrislafond%')
      .gte('call_started_at', todayStart.toISOString());
    
    console.log(`🔹 Twilio logs today: ${todayTwilio?.length || 0}`);
    
    // Today's war_connects  
    const { data: todayWar } = await supabase
      .from('war_connects')
      .select('*')
      .ilike('agent_email', '%chrislafond%')
      .gte('created_at', todayStart.toISOString());
    
    console.log(`🔹 War connects today: ${todayWar?.length || 0}`);
    
    // Today's call history
    const { data: todayHistory } = await supabase
      .from('outbound_call_history')
      .select('*')
      .ilike('agent_email', '%chrislafond%')
      .gte('created_at', todayStart.toISOString());
    
    console.log(`🔹 Call history today: ${todayHistory?.length || 0}`);
    
    // Today's call logs
    const { data: todayCallLogs } = await supabase
      .from('call_logs')  
      .select('*')
      .ilike('agent_email', '%chrislafond%')
      .gte('created_at', todayStart.toISOString());
    
    console.log(`🔹 Call logs today: ${todayCallLogs?.length || 0}`);
    
    if (todayHistory && todayHistory.length > 0) {
      console.log(`\n🔍 TODAY'S CALL HISTORY DETAILS:`);
      todayHistory.forEach((call, i) => {
        console.log(`${i+1}. ${new Date(call.created_at).toLocaleString()}`);
        console.log(`   Agent: ${call.agent_email}`);
        console.log(`   Phone: ${call.lead_phone}`);
        console.log(`   Duration: ${call.call_duration}s`);
        console.log(`   Status: ${call.disposition}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Database debug failed:', error);
  }
}

debugTwilioVsDatabase();