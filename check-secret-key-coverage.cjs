/**
 * Check how many leads have secret keys
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkSecretKeyCoverage() {
  console.log('\n🔍 CHECKING SECRET KEY COVERAGE IN MASTERLEAD\n');
  console.log('='.repeat(60));

  try {
    // Total leads
    const { count: totalLeads } = await supabase
      .from('masterlead')
      .select('*', { count: 'exact', head: true });

    // Leads WITH secret key
    const { count: withSecretKey } = await supabase
      .from('masterlead')
      .select('*', { count: 'exact', head: true })
      .not('taalk_secretkey', 'is', null);

    // Leads WITHOUT secret key
    const { count: withoutSecretKey } = await supabase
      .from('masterlead')
      .select('*', { count: 'exact', head: true })
      .is('taalk_secretkey', null);

    console.log(`\n📊 SECRET KEY COVERAGE:\n`);
    console.log(`   Total Leads: ${totalLeads || 0}`);
    console.log(`   With Secret Key: ${withSecretKey || 0}`);
    console.log(`   Without Secret Key: ${withoutSecretKey || 0}`);
    console.log(`   Coverage: ${totalLeads ? ((withSecretKey / totalLeads) * 100).toFixed(1) : 0}%`);

    // Get some examples of leads WITH secret keys
    const { data: withKeys } = await supabase
      .from('masterlead')
      .select('first_name, last_name, taalk_secretkey, taalk_market, taalk_group_code')
      .not('taalk_secretkey', 'is', null)
      .limit(5);

    console.log(`\n✅ Examples WITH secret key:\n`);
    withKeys?.forEach(lead => {
      console.log(`   ${lead.first_name} ${lead.last_name}: "${lead.taalk_secretkey}" (${lead.taalk_market}, ${lead.taalk_group_code})`);
    });

    // Check if there's a pattern - maybe certain markets have keys?
    const { data: groupCodeStats } = await supabase
      .from('masterlead')
      .select('taalk_group_code, taalk_secretkey')
      .not('taalk_secretkey', 'is', null)
      .limit(20);

    const keysByGroup = {};
    groupCodeStats?.forEach(lead => {
      const group = lead.taalk_group_code || 'NO_GROUP';
      if (!keysByGroup[group]) keysByGroup[group] = new Set();
      keysByGroup[group].add(lead.taalk_secretkey);
    });

    console.log(`\n🔑 SECRET KEYS BY GROUP CODE:\n`);
    Object.entries(keysByGroup).forEach(([group, keys]) => {
      console.log(`   ${group}: ${Array.from(keys).join(', ')}`);
    });

    console.log(`\n💡 SOLUTION:`);
    console.log(`   If ALL leads should have the same secret key (e.g., "Rumplestiltskin")`);
    console.log(`   we can UPDATE all NULL secret keys with a default value.`);
    console.log(`   \n   Or, if secret keys are specific to groups/markets,`);
    console.log(`   we need to map them properly from the source data.`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkSecretKeyCoverage()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

