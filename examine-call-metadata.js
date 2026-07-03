// Examine the metadata of Kingsley's call to see if it might be Chris's
import { supabase } from './server/supabase.js';

async function examineCallMetadata() {
  console.log('🔍 EXAMINING KINGSLEY\'S CALL - MIGHT BE CHRIS LAFOND\'S MISATTRIBUTED');
  
  try {
    // Get Kingsley's recent call in detail
    const { data: call, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .eq('twilio_call_sid', 'CA31db224df94c03c19861a9290c2e98f2')
      .single();
    
    if (error || !call) {
      console.error('❌ Could not find the call:', error);
      return;
    }
    
    console.log('📞 CALL DETAILS:');
    console.log(`   SID: ${call.twilio_call_sid}`);
    console.log(`   Current Owner: ${call.owner_email}`);
    console.log(`   Direction: ${call.call_direction}`);
    console.log(`   From: ${call.from_number}`);
    console.log(`   To: ${call.to_number}`);
    console.log(`   Duration: ${call.call_duration}s`);
    console.log(`   Status: ${call.call_status}`);
    console.log(`   Start Time: ${new Date(call.call_started_at).toLocaleString()}`);
    console.log(`   Phone SID: ${call.phone_number_sid || 'undefined'}`);
    console.log(`   Agent Identity: ${call.agent_identity || 'undefined'}`);
    console.log(`   Call Source: ${call.call_source || 'undefined'}`);
    
    console.log('\n🔍 METADATA ANALYSIS:');
    if (call.metadata) {
      console.log('   Metadata:', JSON.stringify(call.metadata, null, 2));
    } else {
      console.log('   No metadata available');
    }
    
    console.log('\n🤔 ATTRIBUTION QUESTIONS:');
    console.log('   1. Is this call timing suspicious?');
    const callTime = new Date(call.call_started_at);
    const now = new Date();
    const minutesAgo = Math.floor((now - callTime) / 60000);
    console.log(`      Call was ${minutesAgo} minutes ago`);
    
    console.log('   2. Could this phone number belong to Chris LaFond?');
    console.log(`      From number: ${call.from_number}`);
    
    console.log('   3. Is the attribution system working correctly?');
    console.log(`      Currently attributed to: ${call.owner_email}`);
    console.log(`      But could belong to: chrislafond@aoglobelife.com`);
    
    // Check if we can see any phone number history for this number
    const { data: phoneHistory } = await supabase
      .from('twilio_call_logs')
      .select('owner_email, call_started_at')
      .eq('from_number', call.from_number)
      .order('call_started_at', { ascending: false })
      .limit(10);
    
    console.log(`\n📊 PHONE NUMBER HISTORY (+${call.from_number.slice(1)}):`);
    if (phoneHistory && phoneHistory.length > 0) {
      phoneHistory.forEach((histCall, i) => {
        const time = new Date(histCall.call_started_at).toLocaleString();
        console.log(`   ${i+1}. ${histCall.owner_email} at ${time}`);
      });
      
      // Check if multiple agents use this number
      const uniqueOwners = [...new Set(phoneHistory.map(h => h.owner_email))];
      if (uniqueOwners.length > 1) {
        console.log(`   🚨 MULTIPLE AGENTS USE THIS NUMBER: ${uniqueOwners.join(', ')}`);
        console.log('   This could explain misattribution!');
      }
    } else {
      console.log('   No phone number history found');
    }
    
    // If this call timing matches when Chris said he made the call, suggest reattribution
    console.log('\n💡 RECOMMENDATION:');
    console.log('   If Chris LaFond made a call around 7:48 PM, this call might be his!');
    console.log('   The timing, phone number, and attribution system could explain the confusion.');
    
    console.log('\n🔧 TO FIX ATTRIBUTION:');
    console.log('   We can update this call\'s owner_email from kingsleyibeh to chrislafond');
    console.log('   This would give Chris LaFond proper credit for the call');
    
  } catch (error) {
    console.error('❌ Metadata examination failed:', error);
  }
}

examineCallMetadata();