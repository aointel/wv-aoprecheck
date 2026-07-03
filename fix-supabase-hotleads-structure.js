import { createClient } from '@supabase/supabase-js';

// Use the hardcoded Supabase credentials from the config
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addMissingFieldsToHotleads() {
  console.log('🔥 Checking hotleads structure and updating existing records for dialer compatibility...');
  
  try {
    // First, let's see what hotleads we have
    const { data: existingHotleads, error: selectError } = await supabaseAdmin
      .from('hotleads')
      .select('*')
      .limit(5);

    if (selectError) {
      console.error('❌ Error reading hotleads:', selectError);
      return;
    }

    console.log('📋 Current hotleads structure:', existingHotleads);

    if (!existingHotleads || existingHotleads.length === 0) {
      console.log('⚠️ No hotleads found in database');
      return;
    }

    // Try to update the existing hotleads with mapped values for dialer compatibility
    // We'll update each hotlead individually to map basic fields to taalk_ fields
    for (const hotlead of existingHotleads) {
      const mappedData = {
        taalk_market: 'Hot Lead',
        taalk_state: hotlead.state || 'Unknown',
        taalk_city: hotlead.city || 'Unknown', 
        taalk_email: hotlead.email,
        taalk_address: hotlead.address || '',
        taalk_beneficiary: `${hotlead.first_name} ${hotlead.last_name}`,
        taalk_relationship: 'Self',
        taalk_reffered: 'Taalk AI',
        taalk_sponsor_org: 'AO Intelligence',
        taalk_group_code: 'HOTLEAD',
        taalk_groupname: 'Hot Lead',
        taalk_lead_id: hotlead.id?.toString() || '',
        taalk_lead_source: 'Taalk AI Hot Lead',
        cn_email: 'cnsysop@aoglobelife.com',
        cnresolution: 'pending',
        status: 'NEW',
        last_contacted: null
      };

      const { error: updateError } = await supabaseAdmin
        .from('hotleads')
        .update(mappedData)
        .eq('id', hotlead.id);

      if (updateError) {
        console.error(`❌ Error updating hotlead ${hotlead.id}:`, updateError);
      } else {
        console.log(`✅ Updated hotlead: ${hotlead.first_name} ${hotlead.last_name}`);
      }
    }

    // Verify the final structure
    const { data: updatedHotleads, error: verifyError } = await supabaseAdmin
      .from('hotleads')
      .select('first_name, last_name, phone, taalk_market, taalk_groupname, cn_email, status, cnresolution')
      .limit(3);

    if (verifyError) {
      console.error('❌ Error verifying updated hotleads:', verifyError);
      return;
    }

    console.log('✅ Updated hotleads verification:', updatedHotleads);

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
addMissingFieldsToHotleads();