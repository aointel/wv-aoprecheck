// Create a test AOIntel lead for cnsysop that will display in /connect
// This lead will show up in the AOIntel queue NO MATTER WHAT

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestAOIntelLead() {
  console.log('🚨 Creating test AOIntel lead for cnsysop@aoglobelife.com...');

  const testLead = {
    id: 999999, // Use a high ID to avoid conflicts
    first_name: 'Test',
    last_name: 'AOIntel Lead',
    phone: '5551234567',
    state: 'TX',
    taalk_state: 'TX',
    cn_email: 'cnsysop@aoglobelife.com',
    cnresolution: 'aointel', // Lowercase as specified
    source_table: 'ao_intel_inbound',
    is_hot_lead: true,
    dnc: false, // Not DNC so it shows
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assigned_date: new Date().toISOString(),
  };

  try {
    // Upsert the lead
    const { data, error } = await supabase
      .from('masterlead')
      .upsert(testLead, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating test AOIntel lead:', error);
      return;
    }

    console.log('✅ Test AOIntel lead created successfully!');
    console.log('📋 Lead details:', {
      id: data.id,
      name: `${data.first_name} ${data.last_name}`,
      phone: data.phone,
      cn_email: data.cn_email,
      cnresolution: data.cnresolution,
      source_table: data.source_table,
      is_hot_lead: data.is_hot_lead,
      dnc: data.dnc,
    });

    console.log('\n🚨 This lead should now appear in the AOIntel queue on /connect');
    console.log('   Refresh the page to see it!');
  } catch (error) {
    console.error('❌ Failed to create test AOIntel lead:', error);
  }
}

createTestAOIntelLead();

