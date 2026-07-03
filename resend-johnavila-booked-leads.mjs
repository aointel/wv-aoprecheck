/**
 * Resend all masterlead booked leads for johnavila@aoglobelife.com to Zapier webhook
 * Associate ID: 226543
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const AGENT_EMAIL = 'johnavila@aoglobelife.com';
const ASSOCIATE_ID = '226543'; // User confirmed this is the correct associate_id
const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

async function resendBookedLeads() {
  console.log('\n🚀 RESENDING MASTERLEAD BOOKED LEADS TO ZAPIER WEBHOOK\n');
  console.log(`📧 Agent: ${AGENT_EMAIL}`);
  console.log(`👤 Associate ID: ${ASSOCIATE_ID}`);
  console.log('='.repeat(60));

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  try {
    // Get all booked masterlead records for johnavila@aoglobelife.com
    // Include both 'booked' and 'appointment_set' as these are both considered booked
    const { data: leads, error } = await supabase
      .from('masterlead')
      .select('id, taalk_lead_id, first_name, last_name, phone, cn_email, cnresolution, last_contacted, created_at')
      .eq('cn_email', AGENT_EMAIL.toLowerCase().trim())
      .in('cnresolution', ['booked', 'appointment_set'])
      .order('last_contacted', { ascending: false });

    if (error) {
      console.error('❌ Error fetching leads:', error);
      return;
    }

    if (!leads || leads.length === 0) {
      console.log('⚠️  No booked or appointment_set leads found for this agent');
      return;
    }

    const bookedCount = leads.filter(l => l.cnresolution === 'booked').length;
    const appointmentCount = leads.filter(l => l.cnresolution === 'appointment_set').length;
    console.log(`\n📋 Found ${leads.length} booked/appointment_set leads`);
    console.log(`   - Booked: ${bookedCount}`);
    console.log(`   - Appointment Set: ${appointmentCount}\n`);

    // Process each lead
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      
      // Must have taalk_lead_id
      if (!lead.taalk_lead_id) {
        console.log(`⚠️  [${i + 1}/${leads.length}] Skipping lead ${lead.id} (${lead.first_name} ${lead.last_name}) - no taalk_lead_id`);
        skipCount++;
        continue;
      }
      
      const webhookPayload = {
        lead_id: lead.taalk_lead_id.toString(),
        associate_id: ASSOCIATE_ID
      };

      try {
        const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';
        console.log(`[${i + 1}/${leads.length}] 📤 Sending: ${leadName} | lead_id=${lead.taalk_lead_id} | associate_id=${ASSOCIATE_ID}`);

        const webhookResponse = await fetch(ZAPIER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(webhookPayload)
        });

        const responseText = await webhookResponse.text();

        if (webhookResponse.ok) {
          console.log(`   ✅ Success (${webhookResponse.status})`);
          successCount++;
        } else {
          console.log(`   ❌ Failed (${webhookResponse.status}): ${responseText.substring(0, 100)}`);
          failCount++;
        }

        // Delay to avoid overwhelming Zapier webhook (2 seconds between requests)
        if (i < leads.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (webhookError) {
        console.error(`   ❌ Error sending webhook:`, webhookError.message);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Leads (booked/appointment_set): ${leads.length}`);
    console.log(`   ✅ Successfully Sent: ${successCount}`);
    console.log(`   ⚠️  Skipped (no taalk_lead_id): ${skipCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`\n📋 Breakdown by Resolution:`);
    console.log(`   - Booked: ${bookedCount}`);
    console.log(`   - Appointment Set: ${appointmentCount}`);
    console.log('\n✨ Done!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  }
}

resendBookedLeads()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
