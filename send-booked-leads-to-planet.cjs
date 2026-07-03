/**
 * Send all booked leads from masterlead to Planet ALTIG webhook
 * This assigns booked appointments back to their respective agents
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

// Agent email to associate_id mapping (from routes.ts)
const AGENT_ASSOCIATE_MAP = {
  'martintoma@aoglobelife.com': '1253',
  'cnsysop@aoglobelife.com': '1253',
  'davidfulfer@aoglobelife.com': '124235'
};

async function sendBookedLeadsToPlanet() {
  console.log('\n🚀 SENDING BOOKED LEADS TO PLANET ALTIG\n');
  console.log('='.repeat(60));

  try {
    // Get all booked leads from masterlead
    const { data: bookedLeads, error } = await supabase
      .from('masterlead')
      .select('*')
      .eq('cnresolution', 'booked')
      .order('last_contacted', { ascending: false });

    if (error) {
      console.error('❌ Error fetching booked leads:', error);
      return;
    }

    console.log(`\n📋 Found ${bookedLeads?.length || 0} booked leads\n`);

    if (!bookedLeads || bookedLeads.length === 0) {
      console.log('✅ No booked leads to send!');
      return;
    }

    const webhookUrl = 'https://webhook.planetaltig.com/v1/lead/assign';
    let successCount = 0;
    let failCount = 0;

    for (const lead of bookedLeads) {
      // Determine associate ID based on agent email
      const agentEmail = lead.cn_email || 'unknown@aoglobelife.com';
      const associateId = AGENT_ASSOCIATE_MAP[agentEmail] || '999';

      const webhookPayload = {
        lead_id: lead.id, // Use database primary key
        associate_id: associateId
      };

      try {
        console.log(`📤 Sending: ${lead.first_name} ${lead.last_name} (${lead.phone}) → Agent: ${agentEmail} (ID: ${associateId})`);

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(webhookPayload)
        });

        if (webhookResponse.ok) {
          console.log(`   ✅ Success (${webhookResponse.status})`);
          successCount++;
        } else {
          const errorText = await webhookResponse.text();
          console.log(`   ❌ Failed (${webhookResponse.status}): ${errorText}`);
          failCount++;
        }

        // Small delay to avoid overwhelming the webhook
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (webhookError) {
        console.error(`   ❌ Error sending webhook:`, webhookError.message);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Booked Leads: ${bookedLeads.length}`);
    console.log(`   ✅ Successfully Sent: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('\n✨ Done!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

sendBookedLeadsToPlanet()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

