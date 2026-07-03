require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  try {
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

    console.log(`📊 Total leads: ${allLeads.length}\n`);

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

    // Build payload with deduplication
    const payloadMap = new Map();
    const duplicates = [];

    for (const lead of allLeads) {
      const associateId = assocMap[lead.cn_email];
      if (!associateId || associateId === '999') continue;

      if (payloadMap.has(lead.taalk_lead_id)) {
        duplicates.push({
          lead_id: lead.taalk_lead_id,
          name: `${lead.first_name} ${lead.last_name}`,
          count: 2
        });
      } else {
        payloadMap.set(lead.taalk_lead_id, {
          lead_id: lead.taalk_lead_id,
          associate_id: associateId
        });
      }
    }

    console.log(`✅ Unique leads: ${payloadMap.size}`);
    console.log(`⚠️  Duplicates found: ${duplicates.length}\n`);

    if (duplicates.length > 0) {
      console.log('Duplicate lead_ids:');
      duplicates.forEach(d => {
        console.log(`   - ${d.lead_id} (${d.name})`);
      });
      console.log('');
    }

    // Print final payload
    const finalPayload = Array.from(payloadMap.values());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 FINAL PAYLOAD (${finalPayload.length} items):`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(JSON.stringify(finalPayload, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDuplicates();

