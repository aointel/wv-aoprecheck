// Update call owners with better attribution logic
import { supabase } from './server/supabase.js';

// Enhanced agent phone number mapping
const AGENT_PHONE_MAPPING = {
  // David's numbers
  '+16052500834': 'davidfulfer@aoglobelife.com',
  '+19142289324': 'davidfulfer@aoglobelife.com',
  
  // Kingsley's numbers  
  '+14133750858': 'kingsleyibeh@aoglobelife.com',
  '+14133751173': 'kingsleyibeh@aoglobelife.com'
};

async function updateCallOwners() {
  console.log('🔧 UPDATING CALL OWNER ATTRIBUTION');
  
  try {
    // Get all calls with unknown owners
    const { data: unknownCalls, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .eq('owner_email', 'unknown@aoglobelife.com');
      
    if (error) {
      console.error('❌ Error fetching unknown calls:', error);
      return;
    }
    
    console.log(`📞 Found ${unknownCalls.length} calls with unknown owners`);
    
    let updated = 0;
    
    for (const call of unknownCalls) {
      let newOwner = null;
      
      // Try to match by from_number (outbound calls)
      if (AGENT_PHONE_MAPPING[call.from_number]) {
        newOwner = AGENT_PHONE_MAPPING[call.from_number];
      }
      
      // If still unknown, use heuristics based on call patterns
      if (!newOwner && call.call_direction === 'outbound') {
        // Default outbound calls to David for now
        newOwner = 'davidfulfer@aoglobelife.com';
      }
      
      if (newOwner && newOwner !== call.owner_email) {
        const { error: updateError } = await supabase
          .from('twilio_call_logs')
          .update({ owner_email: newOwner })
          .eq('twilio_call_sid', call.twilio_call_sid);
          
        if (updateError) {
          console.log(`⚠️ Error updating ${call.twilio_call_sid}:`, updateError.message);
        } else {
          console.log(`✅ Updated ${call.twilio_call_sid} → ${newOwner}`);
          updated++;
        }
      }
    }
    
    console.log(`\n🎉 ATTRIBUTION UPDATE COMPLETE!`);
    console.log(`✅ Updated ${updated} call owners`);
    
    // Verify the results
    const { data: verifyData } = await supabase
      .from('twilio_call_logs')
      .select('owner_email')
      .neq('owner_email', 'unknown@aoglobelife.com');
      
    if (verifyData) {
      const ownerCounts = {};
      verifyData.forEach(record => {
        ownerCounts[record.owner_email] = (ownerCounts[record.owner_email] || 0) + 1;
      });
      
      console.log('\n📊 UPDATED OWNER DISTRIBUTION:');
      Object.entries(ownerCounts).forEach(([owner, count]) => {
        console.log(`📞 ${owner}: ${count} calls`);
      });
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error);
  }
}

updateCallOwners();