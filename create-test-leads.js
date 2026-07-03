// Create test leads for cnsysop@aoglobelife.com with phone 5032018470
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aagmkblxplhnjbzfchac.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestLeads() {
  try {
    console.log('🔍 Getting sample leads from Martin for reference...');
    
    // Get 3 sample leads from Martin to copy structure
    const { data: martinLeads, error: martinError } = await supabase
      .from('masterlead')
      .select('*')
      .eq('cn_email', 'martintoma@aoglobelife.com')
      .limit(3);

    if (martinError) {
      console.error('❌ Error getting Martin leads:', martinError);
      return;
    }

    if (!martinLeads || martinLeads.length === 0) {
      console.error('❌ No Martin leads found to copy structure from');
      return;
    }

    console.log(`✅ Found ${martinLeads.length} Martin leads to use as templates`);

    // Create test leads for cnsysop with Globe market
    const testLeads = martinLeads.map((lead, index) => ({
      ...lead,
      id: undefined, // Let Supabase generate new IDs
      cn_email: 'cnsysop@aoglobelife.com',
      phone: '5032018470',
      first_name: `Test${index + 1}`,
      last_name: `Lead${index + 1}`,
      taalk_market: 'Globe', // Use Globe market for testing
      taalk_lead_id: `TEST-GLOBE-${Date.now()}-${index + 1}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    console.log('📝 Creating test leads:', testLeads.map(l => `${l.first_name} ${l.last_name}`));

    // Insert the test leads
    const { data: insertedLeads, error: insertError } = await supabase
      .from('masterlead')
      .insert(testLeads)
      .select();

    if (insertError) {
      console.error('❌ Error inserting test leads:', insertError);
      return;
    }

    console.log(`✅ Successfully created ${insertedLeads.length} test leads for cnsysop@aoglobelife.com`);
    console.log('📞 All leads have phone number: 5032018470');
    console.log('📋 Test leads created:');
    insertedLeads.forEach(lead => {
      console.log(`  - ${lead.first_name} ${lead.last_name} (${lead.taalk_market}) - Phone: ${lead.phone}`);
    });

    // Verify the leads are accessible
    const { data: verifyLeads, error: verifyError } = await supabase
      .from('masterlead')
      .select('first_name, last_name, phone, taalk_market')
      .eq('cn_email', 'cnsysop@aoglobelife.com');

    if (verifyError) {
      console.error('❌ Error verifying leads:', verifyError);
      return;
    }

    console.log(`🔍 Verification: Found ${verifyLeads.length} total leads for cnsysop@aoglobelife.com`);

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

createTestLeads();