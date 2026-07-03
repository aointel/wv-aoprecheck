// Improve agent attribution using Twilio metadata identifiers
import { supabase } from './server/supabase.js';

// Enhanced agent attribution using metadata identifiers
const PHONE_SID_TO_AGENT = {
  // David's phone SIDs
  'PNa1d67508986206fa137ef97f239314d7': 'davidfulfer@aoglobelife.com', // +16052500834
  'PN3f5469bf2e52f86120660570d848bd16': 'davidfulfer@aoglobelife.com', // +19142289324
  
  // Kingsley's phone SIDs (need to identify)
  'PN785d2cdf242d32fc3301a00061846297': 'kingsleyibeh@aoglobelife.com',
  'PNaf97840b058966f5eed2cf848b566b21': 'kingsleyibeh@aoglobelife.com'
};

const OUTBOUND_PHONE_TO_AGENT = {
  // David's direct numbers
  '+16052500834': 'davidfulfer@aoglobelife.com',
  '+19142289324': 'davidfulfer@aoglobelife.com',
  
  // Kingsley's numbers
  '+14133750858': 'kingsleyibeh@aoglobelife.com',
  '+14133751173': 'kingsleyibeh@aoglobelife.com',
  
  // Additional Twilio pool numbers that might be used
  '+19806552155': 'kingsleyibeh@aoglobelife.com' // From metadata example
};

function determineAgentFromMetadata(call) {
  const metadata = call.metadata;
  
  // Priority 1: Check if it's an outbound API call (agent-initiated)
  if (metadata?.originalData?.direction === 'outbound-api') {
    
    // Priority 1a: Check phone number SID mapping
    const phoneSid = metadata.originalData.phoneNumberSid;
    if (phoneSid && PHONE_SID_TO_AGENT[phoneSid]) {
      return {
        agent: PHONE_SID_TO_AGENT[phoneSid],
        reason: `phoneNumberSid: ${phoneSid}`
      };
    }
    
    // Priority 1b: Check from number mapping
    const fromNumber = metadata.originalData.from;
    if (fromNumber && OUTBOUND_PHONE_TO_AGENT[fromNumber]) {
      return {
        agent: OUTBOUND_PHONE_TO_AGENT[fromNumber],
        reason: `outbound from: ${fromNumber}`
      };
    }
    
    // Priority 1c: Default outbound-api calls to most active agent
    return {
      agent: 'davidfulfer@aoglobelife.com',
      reason: 'outbound-api default attribution'
    };
  }
  
  // Priority 2: Check direct from number mapping (for any call type)
  if (call.from_number && OUTBOUND_PHONE_TO_AGENT[call.from_number]) {
    return {
      agent: OUTBOUND_PHONE_TO_AGENT[call.from_number],
      reason: `direct from: ${call.from_number}`
    };
  }
  
  // Priority 3: If it has a price (was charged), it's likely outbound
  if (metadata?.price && parseFloat(metadata.price) < 0) {
    return {
      agent: 'davidfulfer@aoglobelife.com',
      reason: 'charged outbound call'
    };
  }
  
  return null;
}

async function improveAgentAttribution() {
  console.log('🎯 IMPROVING AGENT ATTRIBUTION USING METADATA IDENTIFIERS');
  
  try {
    // Get all calls with unknown or incorrect attribution
    const { data: calls, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .or('owner_email.eq.unknown@aoglobelife.com,call_direction.eq.outbound');
    
    if (error) {
      console.error('❌ Error fetching calls:', error);
      return;
    }
    
    console.log(`\n📞 Analyzing ${calls?.length || 0} calls for better attribution`);
    
    let updated = 0;
    let analyzed = 0;
    
    if (calls && calls.length > 0) {
      for (const call of calls) {
        analyzed++;
        
        const attribution = determineAgentFromMetadata(call);
        
        if (attribution && attribution.agent !== call.owner_email) {
          
          console.log(`\n✅ ATTRIBUTION UPDATE:`);
          console.log(`   Call: ${call.twilio_call_sid}`);
          console.log(`   From: ${call.owner_email} → ${attribution.agent}`);
          console.log(`   Reason: ${attribution.reason}`);
          console.log(`   Direction: ${call.call_direction}`);
          console.log(`   Numbers: ${call.from_number} → ${call.to_number}`);
          
          // Update the call in Supabase
          const { error: updateError } = await supabase
            .from('twilio_call_logs')
            .update({ 
              owner_email: attribution.agent,
              agent_identity: attribution.agent
            })
            .eq('twilio_call_sid', call.twilio_call_sid);
          
          if (updateError) {
            console.log(`   ⚠️ Update failed: ${updateError.message}`);
          } else {
            console.log(`   ✅ Updated successfully`);
            updated++;
          }
        }
      }
    }
    
    console.log(`\n🎉 ATTRIBUTION IMPROVEMENT COMPLETE!`);
    console.log(`📊 Analyzed: ${analyzed} calls`);
    console.log(`✅ Updated: ${updated} calls`);
    
    // Show final attribution summary
    const { data: finalCounts, error: countError } = await supabase
      .from('twilio_call_logs')
      .select('owner_email, call_direction')
      .eq('call_direction', 'outbound');
    
    if (!countError && finalCounts) {
      console.log(`\n📊 FINAL OUTBOUND CALL ATTRIBUTION:`);
      const agentCounts = {};
      finalCounts.forEach(call => {
        agentCounts[call.owner_email] = (agentCounts[call.owner_email] || 0) + 1;
      });
      
      Object.entries(agentCounts).forEach(([agent, count]) => {
        console.log(`   ${agent}: ${count} outbound calls`);
      });
    }
    
  } catch (error) {
    console.error('❌ Attribution improvement failed:', error);
  }
}

improveAgentAttribution();