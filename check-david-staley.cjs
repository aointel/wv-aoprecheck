/**
 * Check David Staley lead
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkDavidStaley() {
  console.log('\n🔍 CHECKING DAVID STALEY\n');
  console.log('='.repeat(60));

  try {
    // Find by taalk_lead_id
    const { data: leads, error } = await supabase
      .from('masterlead')
      .select('*')
      .eq('taalk_lead_id', '18578927');

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
    console.log(`   State: ${lead.taalk_state}`);
    console.log(`   Market: ${lead.taalk_market}`);
    console.log(`   Group Code: ${lead.taalk_group_code}`);
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

    // Check all PAVET leads to see pattern
    console.log(`\n\n🔍 CHECKING ALL PAVET LEADS FOR SECRET KEY PATTERN:\n`);
    
    const { data: pavetLeads } = await supabase
      .from('masterlead')
      .select('first_name, last_name, taalk_secretkey, taalk_lead_id, taalk_state')
      .eq('taalk_group_code', 'PAVET')
      .limit(20);

    console.log(`Found ${pavetLeads?.length || 0} PAVET leads (sample):\n`);
    
    let withKey = 0;
    let withoutKey = 0;
    
    pavetLeads?.forEach(lead => {
      const hasKey = lead.taalk_secretkey !== null && lead.taalk_secretkey !== undefined && lead.taalk_secretkey !== '';
      if (hasKey) {
        withKey++;
        console.log(`   ✅ ${lead.first_name} ${lead.last_name} (${lead.taalk_state}): "${lead.taalk_secretkey}"`);
      } else {
        withoutKey++;
        console.log(`   ❌ ${lead.first_name} ${lead.last_name} (${lead.taalk_state}): NULL`);
      }
    });
    
    console.log(`\n📊 PAVET SECRET KEY STATS (sample):`);
    console.log(`   With Key: ${withKey}`);
    console.log(`   Without Key: ${withoutKey}`);
    console.log(`   Coverage: ${((withKey / (withKey + withoutKey)) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkDavidStaley()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

