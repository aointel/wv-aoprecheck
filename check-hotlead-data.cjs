/**
 * Check if we're getting correct associate_id and lead_id for hotleads
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkHotleadData() {
  console.log('\n🔍 CHECKING HOTLEAD DATA QUALITY\n');
  console.log('='.repeat(60));

  try {
    // 1. Check recent calls over 60 seconds
    const { data: recentCalls, error: callError } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_duration', 60)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (callError) {
      console.error('❌ Error fetching calls:', callError);
      return;
    }

    console.log(`\n📞 Found ${recentCalls?.length || 0} calls over 60 seconds in last 24 hours\n`);

    if (recentCalls && recentCalls.length > 0) {
      for (const call of recentCalls) {
        console.log('─'.repeat(60));
        console.log(`\n📋 Call: ${call.twilio_call_sid}`);
        console.log(`   Duration: ${call.call_duration}s`);
        console.log(`   From: ${call.from_number}`);
        console.log(`   To: ${call.to_number}`);
        console.log(`   Agent: ${call.owner_email || call.agent_identity || 'NONE'}`);
        
        // Check if this phone matches a masterlead
        const { data: hotleads } = await supabase
          .from('masterlead')
          .select('*')
          .eq('phone', call.to_number)
          .limit(1);

        if (hotleads && hotleads.length > 0) {
          const hotlead = hotleads[0];
          console.log(`\n   ✅ MATCHED HOTLEAD:`);
          console.log(`      Lead ID: ${hotlead.id}`);
          console.log(`      Name: ${hotlead.first_name} ${hotlead.last_name}`);
          console.log(`      Phone: ${hotlead.phone}`);
          console.log(`      CN Email: ${hotlead.cn_email}`);
          
          // Determine associate ID (same logic as scheduler)
          const agentEmail = call.owner_email || call.agent_identity || 'system@aoglobelife.com';
          const associateId = agentEmail === 'martintoma@aoglobelife.com' ? "1253" :
                             agentEmail === 'cnsysop@aoglobelife.com' ? "1253" :
                             agentEmail === 'davidfulfer@aoglobelife.com' ? "124235" : "999";
          
          console.log(`\n   📤 WEBHOOK PAYLOAD WOULD BE:`);
          console.log(`      lead_id: ${hotlead.id}`);
          console.log(`      associate_id: "${associateId}"`);
          
          if (associateId === "999") {
            console.log(`      ⚠️  DEFAULT ASSOCIATE ID - Agent not mapped!`);
          }
          
          // Check if agent has associate_id in customers table
          const { data: customer } = await supabase
            .from('customers')
            .select('associate_id, company_email')
            .eq('company_email', agentEmail.toLowerCase().trim())
            .limit(1);
          
          if (customer && customer.length > 0 && customer[0].associate_id) {
            console.log(`\n   💡 ACTUAL ASSOCIATE ID IN DATABASE: "${customer[0].associate_id}"`);
            if (customer[0].associate_id !== associateId) {
              console.log(`      🚨 MISMATCH! We're sending "${associateId}" but should send "${customer[0].associate_id}"`);
            }
          } else {
            console.log(`\n   ⚠️  No associate_id found in customers table for ${agentEmail}`);
          }
        } else {
          console.log(`\n   ❌ NO HOTLEAD MATCH for phone: ${call.to_number}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Analysis Complete!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkHotleadData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

