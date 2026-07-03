require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function sendToPlanetAltig() {
  try {
    console.log('🚀 SENDING ALL BOOKED LEADS TO PLANET ALTIG\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get ALL booked leads
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

    console.log(`\n📊 Total booked leads: ${allLeads.length}\n`);

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
      assocMap[p.company_email] = p.associate_id?.toString();
    });

    console.log(`👔 Producers found: ${producers?.length || 0}\n`);

    // Build payload array (deduplicate by lead_id)
    const payloadMap = new Map();

    for (const lead of allLeads) {
      const associateId = assocMap[lead.cn_email];

      if (!associateId || associateId === '999') {
        console.log(`⚠️  Skipping ${lead.first_name} ${lead.last_name} (${lead.cn_email} - no associate_id)`);
        continue;
      }

      // Only add if not already in map (prevents duplicates)
      if (!payloadMap.has(lead.taalk_lead_id)) {
        payloadMap.set(lead.taalk_lead_id, {
          lead_id: lead.taalk_lead_id,
          associate_id: associateId
        });
      }
    }

    const payloadArray = Array.from(payloadMap.values());

    console.log(`\n✅ Valid leads to send: ${payloadArray.length}\n`);

    if (payloadArray.length === 0) {
      console.log('No valid leads to send');
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 SENDING TO PLANET ALTIG');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('URL: https://webhook.planetaltig.com/v1/lead/assign');
    console.log('Method: POST');
    console.log('Unflatten: false');
    console.log(`Payload count: ${payloadArray.length}\n`);

    console.log('Sample payload (first 5):');
    console.log(JSON.stringify(payloadArray.slice(0, 5), null, 2));
    console.log('');

    const response = await fetch('https://webhook.planetaltig.com/v1/lead/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
      },
      body: JSON.stringify(payloadArray)
    });

    const responseText = await response.text();

    console.log(`\n📥 Response Status: ${response.status}`);
    console.log(`📥 Response Body: ${responseText}\n`);

    if (response.ok) {
      console.log('✅ SUCCESS - All booked leads sent to Planet ALTIG!');
    } else {
      console.log('❌ FAILED - Check response above');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📈 Total booked leads: ${allLeads.length}`);
    console.log(`✅ Sent to Planet ALTIG: ${payloadArray.length}`);
    console.log(`⚠️  Skipped (no associate_id): ${allLeads.length - payloadArray.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendToPlanetAltig();

