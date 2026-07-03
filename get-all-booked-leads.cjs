require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllBookedLeads() {
  try {
    console.log('🔍 Fetching ALL booked leads (no pagination)...\n');

    let allLeads = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('masterlead')
        .select('*')
        .eq('cnresolution', 'booked')
        .range(from, from + batchSize - 1)
        .order('updated_at', { ascending: false });

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

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 ALL BOOKED LEADS:\n');

    allLeads.forEach((lead, i) => {
      console.log(`${(i + 1).toString().padStart(3)}. ${(lead.first_name + ' ' + lead.last_name).padEnd(35)} | Lead ID: ${(lead.taalk_lead_id || 'NULL').toString().padEnd(10)} | ${lead.updated_at}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Total: ${allLeads.length} booked leads`);
    
    // Check how many have taalk_lead_id
    const withTaalkId = allLeads.filter(l => l.taalk_lead_id);
    console.log(`✅ With taalk_lead_id: ${withTaalkId.length}`);
    console.log(`⚠️  Without taalk_lead_id: ${allLeads.length - withTaalkId.length}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getAllBookedLeads();

