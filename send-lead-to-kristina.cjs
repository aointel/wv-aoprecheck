require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function sendLeadToKristina() {
  try {
    console.log('🔍 Looking up Kristina\'s associate_id...\n');
    
    // Look up Kristina's associate_id
    const { data: producer } = await supabase
      .from('producerlist')
      .select('associate_id, agent_name, company_email')
      .ilike('company_email', '%kristina%')
      .single();
    
    if (!producer) {
      console.error('❌ Could not find Kristina in producerlist');
      return;
    }
    
    console.log('✅ Found Kristina:', producer);
    console.log('');
    
    const payload = {
      lead_id: "17699999",
      associate_id: producer.associate_id.toString()
    };
    
    console.log('📤 Sending to Planet ALTIG webhook...');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('');
    
    const response = await fetch('https://webhook.planetaltig.com/v1/lead/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`Status: ${response.status}`);
    const responseText = await response.text();
    console.log('Response:', responseText);
    
    if (response.ok) {
      console.log('\n✅ SUCCESS: Lead 17699999 assigned to Kristina!');
    } else {
      console.log('\n❌ FAILED');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendLeadToKristina();

