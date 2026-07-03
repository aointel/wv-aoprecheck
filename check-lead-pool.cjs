const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function checkLeadPool() {
  console.log('🔍 CHECKING LEAD POOL STATUS\n');
  console.log('='.repeat(80));
  
  try {
    // Total pending/null leads (not DNC)
    const { count: totalPending } = await supabase
      .from('masterlead')
      .select('*', { count: 'exact', head: true })
      .in('cnresolution', ['pending', null])
      .eq('dnc', false);
    
    // Unassigned pending leads
    const { count: unassigned } = await supabase
      .from('masterlead')
      .select('*', { count: 'exact', head: true })
      .is('cn_email', null)
      .in('cnresolution', ['pending', null])
      .eq('dnc', false);
    
    // Assigned pending leads
    const { count: assigned } = await supabase
      .from('masterlead')
      .select('*', { count: 'exact', head: true })
      .not('cn_email', 'is', null)
      .in('cnresolution', ['pending', null])
      .eq('dnc', false);
    
    console.log(`\n📊 LEAD POOL STATUS:`);
    console.log(`   Total pending/null leads: ${totalPending}`);
    console.log(`   ✅ Assigned to agents: ${assigned}`);
    console.log(`   📋 Unassigned (available): ${unassigned}`);
    console.log('\n' + '='.repeat(80) + '\n');
    
    if (unassigned === 0) {
      console.log('🚨 WARNING: No unassigned leads available!');
      console.log('   All pending leads are currently assigned to agents.');
      console.log('   Dianka only has 1 lead because there are no more leads to assign.');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

checkLeadPool()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

