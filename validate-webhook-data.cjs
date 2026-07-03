require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function validateData() {
  try {
    console.log('🔍 Validating webhook data from last webhook send...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get a few booked leads
    const { data: leads } = await supabase
      .from('masterlead')
      .select('*')
      .eq('cnresolution', 'booked')
      .not('taalk_lead_id', 'is', null)
      .not('cn_email', 'is', null)
      .limit(5);

    console.log('📋 Sample booked leads:\n');

    for (const lead of leads || []) {
      console.log(`Lead: ${lead.first_name} ${lead.last_name}`);
      console.log(`  taalk_lead_id: "${lead.taalk_lead_id}" (type: ${typeof lead.taalk_lead_id})`);
      console.log(`  cn_email: "${lead.cn_email}" (type: ${typeof lead.cn_email})`);
      console.log(`  phone: "${lead.phone}"`);
      
      // Get associate_id
      const { data: producer } = await supabase
        .from('producerlist')
        .select('associate_id')
        .eq('company_email', lead.cn_email)
        .single();

      if (producer) {
        console.log(`  associate_id: "${producer.associate_id}" (type: ${typeof producer.associate_id})`);
        
        // Validate
        const isValid = lead.taalk_lead_id && 
                       lead.taalk_lead_id !== '' && 
                       producer.associate_id && 
                       producer.associate_id !== '' &&
                       producer.associate_id !== '999';
        
        if (isValid) {
          console.log(`  ✅ VALID - would send webhook`);
          console.log(`  Payload: { lead_id: "${lead.taalk_lead_id}", associate_id: "${producer.associate_id}" }`);
        } else {
          console.log(`  ❌ INVALID`);
          if (!lead.taalk_lead_id || lead.taalk_lead_id === '') console.log(`     - taalk_lead_id is empty`);
          if (!producer.associate_id || producer.associate_id === '' || producer.associate_id === '999') {
            console.log(`     - associate_id is "${producer.associate_id}"`);
          }
        }
      } else {
        console.log(`  ❌ NO PRODUCER FOUND for ${lead.cn_email}`);
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

validateData();

