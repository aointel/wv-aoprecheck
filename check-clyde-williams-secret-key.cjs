/**
 * Check if Clyde Williams has a secret key
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkClydeWilliams() {
  console.log('\n🔍 CHECKING CLYDE WILLIAMS SECRET KEY\n');
  console.log('='.repeat(60));

  try {
    // Find by taalk_lead_id
    const { data: leads, error } = await supabase
      .from('masterlead')
      .select('*')
      .eq('taalk_lead_id', '18577398');

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (!leads || leads.length === 0) {
      console.log('❌ Lead not found!');
      return;
    }

    const lead = leads[0];
    
    console.log(`\n✅ FOUND: ${lead.first_name} ${lead.last_name}`);
    console.log(`   Phone: ${lead.phone}`);
    console.log(`   Taalk Lead ID: ${lead.taalk_lead_id}`);
    console.log(`   Database ID: ${lead.id}`);
    console.log(`\n🔑 SECRET KEY DATA:`);
    console.log(`   taalk_secretkey: "${lead.taalk_secretkey}"`);
    console.log(`   Type: ${typeof lead.taalk_secretkey}`);
    console.log(`   Is Null: ${lead.taalk_secretkey === null}`);
    console.log(`   Is Undefined: ${lead.taalk_secretkey === undefined}`);
    console.log(`   Is Empty: ${lead.taalk_secretkey === ''}`);
    
    console.log(`\n📋 ALL TAALK FIELDS:`);
    Object.keys(lead).filter(k => k.startsWith('taalk_')).forEach(key => {
      console.log(`   ${key}: ${lead[key]}`);
    });

    console.log(`\n💡 TESTING API ENDPOINT:\n`);
    console.log('   Making API call to /api/outbound-dialer/leads...\n');
    
    const apiResponse = await fetch('https://aoirail-production.up.railway.app/api/outbound-dialer/leads?market=hotleads&userEmail=jennifergallego@aoglobelife.com&limit=100&offset=0', {
      headers: {
        'x-user-email': 'jennifergallego@aoglobelife.com'
      }
    });
    
    const apiData = await apiResponse.json();
    const clydeFromAPI = apiData.leads?.find(l => l.taalk_lead_id === '18577398' || l.phone === '7252038024');
    
    if (clydeFromAPI) {
      console.log('   ✅ Found Clyde in API response!');
      console.log(`   taalk_secretkey from API: "${clydeFromAPI.taalk_secretkey}"`);
      console.log(`   secretKey from API: "${clydeFromAPI.secretKey}"`);
    } else {
      console.log('   ❌ Clyde not found in API response!');
      console.log(`   Total leads in response: ${apiData.leads?.length || 0}`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkClydeWilliams()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

