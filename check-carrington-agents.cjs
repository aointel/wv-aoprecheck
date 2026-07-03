const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('agent_hierarchy')
    .select('agent_name, agent_email, mga_name, mga_associate_id')
    .eq('mga_associate_id', 91167)
    .limit(20);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`\n✅ Found ${data?.length || 0} agents with Carrington (91167) as MGA:\n`);
  if (data && data.length > 0) {
    data.forEach(a => {
      console.log(`   - ${a.agent_name} (${a.agent_email})`);
    });
  } else {
    console.log('   ❌ NO AGENTS FOUND - sync needed!');
  }
  console.log();
}

check().catch(console.error);










