// Find unattributed calls that might be Chris LaFond's
import { supabase } from './server/supabase.js';

async function findUnattributedCalls() {
  console.log('🔍 SEARCHING FOR UNATTRIBUTED CALLS THAT MIGHT BE CHRIS LAFOND');
  
  try {
    const now = new Date();
    const last60Minutes = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Get all recent calls, including those with 'unknown' attribution
    const { data: allCalls, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', last60Minutes.toISOString())
      .order('call_started_at', { ascending: false});
    
    console.log(`📞 ALL CALLS LAST 60 MINUTES: ${allCalls?.length || 0}`);
    
    if (allCalls && allCalls.length > 0) {
      allCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        const isUnknownOwner = !call.owner_email || 
                               call.owner_email.includes('unknown') || 
                               call.owner_email === 'unknown@aoglobelife.com';
        
        console.log(`\n${i+1}. ${isUnknownOwner ? '❓ UNATTRIBUTED' : '✅'} Call`);
        console.log(`   Owner: ${call.owner_email || 'NULL'}`);
        console.log(`   Direction: ${call.call_direction}`);
        console.log(`   From: ${call.from_number} → To: ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration}s`);
        console.log(`   Status: ${call.call_status}`);
        console.log(`   Time: ${callTime.toLocaleString()}`);
        console.log(`   SID: ${call.twilio_call_sid}`);
        
        if (isUnknownOwner) {
          console.log('   🚨 THIS COULD BE CHRIS LAFOND\'S CALL!');
          
          // Check if it's an outbound call (likely from agent)
          if (call.call_direction === 'outbound-api' || call.call_direction === 'outbound') {
            console.log('   🎯 OUTBOUND CALL - LIKELY AGENT INITIATED');
            
            if (call.call_duration > 0) {
              console.log(`   ✅ Call connected (${call.call_duration}s duration)`);
            }
          }
        }
      });
    }
    
    // Look for any recent calls that might be from Chris's potential phone numbers
    // Check different possible attribution patterns
    const possibleChrisPatterns = [
      'chrislafond',
      'chris.lafond', 
      'christopher',
      'lafond'
    ];
    
    const { data: possibleChrisCalls } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', last60Minutes.toISOString())
      .or(possibleChrisPatterns.map(pattern => 
        `owner_email.ilike.%${pattern}%,agent_identity.ilike.%${pattern}%`
      ).join(','))
      .order('call_started_at', { ascending: false});
    
    console.log(`\n🔍 CALLS WITH CHRIS-RELATED PATTERNS: ${possibleChrisCalls?.length || 0}`);
    
    if (possibleChrisCalls && possibleChrisCalls.length > 0) {
      possibleChrisCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        console.log(`\n${i+1}. 🎯 POTENTIAL CHRIS CALL FOUND!`);
        console.log(`   Owner: ${call.owner_email}`);
        console.log(`   Agent Identity: ${call.agent_identity}`);
        console.log(`   From: ${call.from_number} → To: ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration}s`);
        console.log(`   Time: ${callTime.toLocaleString()}`);
        console.log(`   SID: ${call.twilio_call_sid}`);
      });
    }
    
    // Look for the newest call that might be misattributed
    const { data: newestCalls } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', last60Minutes.toISOString())
      .eq('call_direction', 'outbound-api')
      .order('call_started_at', { ascending: false})
      .limit(5);
    
    console.log(`\n📞 NEWEST OUTBOUND-API CALLS (might be Chris's):`);
    
    if (newestCalls && newestCalls.length > 0) {
      newestCalls.forEach((call, i) => {
        const callTime = new Date(call.call_started_at);
        const minutesAgo = Math.floor((now - callTime) / 60000);
        
        console.log(`\n${i+1}. Call ${minutesAgo} minutes ago`);
        console.log(`   Current Owner: ${call.owner_email}`);
        console.log(`   From: ${call.from_number} → To: ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration}s`);
        console.log(`   Status: ${call.call_status}`);
        console.log(`   Time: ${callTime.toLocaleString()}`);
        
        if (call.owner_email !== 'chrislafond@aoglobelife.com') {
          console.log('   ❓ Could this be Chris\'s misattributed call?');
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

findUnattributedCalls();