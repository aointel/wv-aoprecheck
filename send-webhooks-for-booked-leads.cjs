require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function sendBookedWebhooks() {
  try {
    console.log('🚀 FINDING BOOKED LEADS & SENDING WEBHOOKS\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get all booked leads from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log('🔍 Querying masterlead for booked leads...\n');

    const { data: bookedLeads, error } = await supabase
      .from('masterlead')
      .select('*')
      .eq('cnresolution', 'booked')
      .not('taalk_lead_id', 'is', null)
      .gte('updated_at', sevenDaysAgo.toISOString())
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching booked leads:', error);
      return;
    }

    console.log(`📊 Found ${bookedLeads?.length || 0} booked leads from last 7 days\n`);

    if (!bookedLeads || bookedLeads.length === 0) {
      console.log('No booked leads found');
      return;
    }

    // Get unique agent emails
    const agentEmails = [...new Set(bookedLeads.map(l => l.assigned_agent_email).filter(Boolean))];
    console.log(`👥 Unique agents with booked leads: ${agentEmails.length}\n`);

    // Get associate_ids
    const { data: producers } = await supabase
      .from('producerlist')
      .select('company_email, associate_id')
      .in('company_email', agentEmails);

    const assocMap = {};
    (producers || []).forEach(p => {
      assocMap[p.company_email] = p.associate_id;
    });

    console.log(`👔 Producers found: ${producers?.length || 0}\n`);

    // Send webhooks
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 SENDING WEBHOOKS FOR BOOKED LEADS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const lead of bookedLeads) {
      const associateId = assocMap[lead.assigned_agent_email];

      if (!associateId || associateId === '999') {
        console.log(`⚠️  ${lead.first_name} ${lead.last_name} - SKIPPED (${lead.assigned_agent_email} has no associate_id)\n`);
        skippedCount++;
        continue;
      }

      const webhookPayload = {
        lead_id: lead.taalk_lead_id,
        associate_id: associateId
      };

      console.log(`📤 ${lead.first_name} ${lead.last_name}`);
      console.log(`   Lead ID: ${lead.taalk_lead_id}`);
      console.log(`   Agent: ${lead.assigned_agent_email} (${associateId})`);
      console.log(`   Booked: ${lead.updated_at}`);

      try {
        const response = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
          },
          body: JSON.stringify(webhookPayload)
        });

        if (response.ok) {
          console.log(`   ✅ SUCCESS\n`);
          successCount++;
        } else {
          const errorText = await response.text();
          console.log(`   ❌ FAILED: ${response.status} - ${errorText}\n`);
          failCount++;
        }
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}\n`);
        failCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 BOOKED LEADS WEBHOOK COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log(`📈 Total: ${bookedLeads.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendBookedWebhooks();

