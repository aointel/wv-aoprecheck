require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function sendBookedWebhooks() {
  try {
    console.log('🚀 FETCHING ALL BOOKED LEADS & SENDING WEBHOOKS\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let allLeads = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    console.log('📥 Fetching all booked leads...\n');

    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('masterlead')
        .select('*')
        .eq('cnresolution', 'booked')
        .not('taalk_lead_id', 'is', null)
        .not('cn_email', 'is', null)
        .range(from, from + batchSize - 1);

      if (error) {
        console.error('❌ Error:', error);
        return;
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        allLeads = allLeads.concat(batch);
        console.log(`   Fetched ${batch.length} leads (total: ${allLeads.length})`);
        from += batchSize;
        
        if (batch.length < batchSize) {
          hasMore = false;
        }
      }
    }

    console.log(`\n📊 Total booked leads with taalk_lead_id and cn_email: ${allLeads.length}\n`);

    if (allLeads.length === 0) {
      console.log('No booked leads found');
      return;
    }

    // Get unique agent emails
    const agentEmails = [...new Set(allLeads.map(l => l.cn_email).filter(Boolean))];
    console.log(`👥 Unique agents: ${agentEmails.length}\n`);

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
    console.log('📤 SENDING WEBHOOKS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const lead of allLeads) {
      const associateId = assocMap[lead.cn_email];

      if (!associateId || associateId === '999') {
        console.log(`⚠️  ${lead.first_name} ${lead.last_name} - SKIPPED (${lead.cn_email} has no associate_id)`);
        skippedCount++;
        continue;
      }

      const webhookPayload = {
        lead_id: lead.taalk_lead_id,
        associate_id: associateId
      };

      console.log(`📤 ${lead.first_name} ${lead.last_name}`);
      console.log(`   Lead ID: ${lead.taalk_lead_id}`);
      console.log(`   Agent: ${lead.cn_email} (${associateId})`);

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
          console.log(`   ❌ FAILED: ${response.status}\n`);
          failCount++;
        }
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}\n`);
        failCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 WEBHOOK COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log(`📈 Total: ${allLeads.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendBookedWebhooks();

