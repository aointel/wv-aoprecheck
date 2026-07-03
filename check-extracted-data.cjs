const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pscpjfkhvdozqzhglxyp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzY3BqZmtodmRvenF6aGdseHlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTU2NzU2OSwiZXhwIjoyMDQxMTQzNTY5fQ.u4VY3K2BoOnixHBPPLXZ-nD0CBlE5kpH0LIOhvDfwFo'
);

async function checkData() {
  const { data, error } = await supabase
    .from('presentation_sessions')
    .select('*')
    .eq('session_id', 'session_1760815246680_exa8ai6rs')
    .single();
  
  if (error) {
    console.log('❌ Error:', error);
    return;
  }
  
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && !['id', 'session_id', 'created_at', 'updated_at', 'ended_at', 'started_at'].includes(k)) {
      fields[k] = v;
    }
  }
  
  console.log('📊 EXTRACTED DATA FROM 53 HPPRO SCREENSHOTS:');
  console.log('==========================================\n');
  console.log(JSON.stringify(fields, null, 2));
  console.log('\n✅ Total fields extracted:', Object.keys(fields).length);
}

checkData();

