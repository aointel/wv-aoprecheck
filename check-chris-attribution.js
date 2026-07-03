// Check Chris LaFond's phone number attribution
import { supabase } from './server/supabase.js';

async function checkChrisAttribution() {
  console.log('🔍 CHECKING CHRIS LAFOND PHONE NUMBER ATTRIBUTION');
  
  try {
    // Check if there are any phone numbers associated with Chris LaFond
    const { data: phoneNumbers, error } = await supabase
      .from('twilio_call_logs')
      .select('phone_number_sid, from_number')
      .ilike('owner_email', '%chrislafond%')
      .limit(10);
    
    console.log('📞 Chris LaFond phone numbers from previous calls:', phoneNumbers?.length || 0);
    
    // Check all recent calls and their phone number SIDs for attribution patterns
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const { data: recentCalls } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', oneHourAgo.toISOString())
      .order('call_started_at', { ascending: false});
    
    console.log(`\n🔍 RECENT CALL ATTRIBUTION ANALYSIS:`);
    recentCalls?.forEach(call => {
      console.log(`Call SID: ${call.twilio_call_sid}`);
      console.log(`  Owner: ${call.owner_email}`);
      console.log(`  Phone SID: ${call.phone_number_sid || 'undefined'}`);
      console.log(`  From: ${call.from_number}`);
      console.log(`  Time: ${new Date(call.call_started_at).toLocaleString()}`);
      console.log('');
    });
    
    // Check if Chris has any phone number mappings in the database
    const { data: agentPhones } = await supabase
      .from('twilio_call_logs')
      .select('DISTINCT owner_email, phone_number_sid, from_number')
      .not('phone_number_sid', 'is', null)
      .order('owner_email');
    
    console.log('\n📱 ALL AGENT PHONE MAPPINGS:');
    agentPhones?.forEach(mapping => {
      const isChris = mapping.owner_email?.includes('chrislafond');
      console.log(`${isChris ? '🎯' : '📞'} ${mapping.owner_email}`);
      console.log(`  Phone SID: ${mapping.phone_number_sid}`);
      console.log(`  From Number: ${mapping.from_number}`);
      console.log('');
    });
    
    // Check if there are any unattributed calls that might be Chris's
    const { data: unattributedCalls } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_started_at', oneHourAgo.toISOString())
      .or('owner_email.is.null,owner_email.eq.unknown')
      .order('call_started_at', { ascending: false});
    
    console.log(`\n❓ UNATTRIBUTED RECENT CALLS: ${unattributedCalls?.length || 0}`);
    unattributedCalls?.forEach(call => {
      console.log(`SID: ${call.twilio_call_sid}`);
      console.log(`  From: ${call.from_number} → To: ${call.to_number}`);
      console.log(`  Duration: ${call.call_duration}s`);
      console.log(`  Time: ${new Date(call.call_started_at).toLocaleString()}`);
      console.log(`  Owner: ${call.owner_email}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Attribution check failed:', error);
  }
}

checkChrisAttribution();