require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function sendOneByOne() {
  try {
    console.log('🚀 SENDING BOOKED LEADS ONE BY ONE TO PLANET ALTIG\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get ALL booked leads
    let allLeads = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data: batch } = await supabase
        .from('masterlead')
        .select('*')
        .eq('cnresolution', 'booked')
        .not('taalk_lead_id', 'is', null)
        .not('cn_email', 'is', null)
        .range(from, from + batchSize - 1);

      if (!batch || batch.length === 0) break;
      
      allLeads = allLeads.concat(batch);
      from += batchSize;
      
      if (batch.length < batchSize) break;
    }

    console.log(`📊 Total booked leads: ${allLeads.length}\n`);

    // Get producers
    const agentEmails = [...new Set(allLeads.map(l => l.cn_email))];
    const { data: producers } = await supabase
      .from('producerlist')
      .select('company_email, associate_id')
      .in('company_email', agentEmails);

    const assocMap = {};
    (producers || []).forEach(p => {
      assocMap[p.company_email] = p.associate_id?.toString();
    });

    console.log('📤 Sending to Planet ALTIG...\n');

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    const sent = new Set(); // Track sent lead_ids to avoid duplicates

    for (const lead of allLeads) {
      const associateId = assocMap[lead.cn_email];

      if (!associateId || associateId === '999') {
        skippedCount++;
        continue;
      }

      // Skip if already sent
      if (sent.has(lead.taalk_lead_id)) {
        console.log(`⚠️  Duplicate ${lead.first_name} ${lead.last_name} (${lead.taalk_lead_id}) - SKIPPED`);
        skippedCount++;
        continue;
      }

      const payload = [{
        lead_id: lead.taalk_lead_id,
        associate_id: associateId
      }];

      console.log(`📤 ${lead.first_name} ${lead.last_name} | Lead: ${lead.taalk_lead_id} | Agent: ${lead.cn_email} (${associateId})`);

      try {
        const response = await fetch('https://webhook.planetaltig.com/v1/lead/assign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          console.log(`   ✅ SUCCESS\n`);
          successCount++;
          sent.add(lead.taalk_lead_id);
        } else {
          const errorText = await response.text();
          console.log(`   ❌ FAILED: ${response.status} - ${errorText}\n`);
          failCount++;
        }
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}\n`);
        failCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 COMPLETE');
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

sendOneByOne();

