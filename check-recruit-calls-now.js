const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljeno_a2V0eHdwZmd0cnpleXl0dCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Mjc3NDA2NzYsImV4cCI6MjA0MzMxNjY3Nn0.hJvmCA9k5vqPW7L1y52TtxKOLLox8lZqT1TiVnBqf2A'
);

async function checkRecruitCalls() {
  console.log('🔍 Checking vdp_calls_BLASTPICK for aorecruit calls...');
  
  const { data, error } = await supabase
    .from('vdp_calls_BLASTPICK')
    .select('*')
    .ilike('market', '%aorecruit%')
    .order('time', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`\n📞 Found ${data?.length || 0} aorecruit calls:`);
  data?.forEach(call => {
    console.log(`\n  ID: ${call.id}`);
    console.log(`  Time: ${call.time}`);
    console.log(`  Agent: ${call.agent}`);
    console.log(`  Name: ${call.firstName} ${call.lastName}`);
    console.log(`  Phone: ${call.phone}`);
    console.log(`  Market: ${call.market}`);
  });
  
  console.log('\n🔍 Checking recruit_candidates for taylorermis@aoglobelife.com...');
  
  const { data: candidates, error: candError } = await supabase
    .from('recruit_candidates')
    .select('*')
    .eq('agent_email', 'taylorermis@aoglobelife.com');
  
  if (candError) {
    console.error('❌ Error:', candError);
    return;
  }
  
  console.log(`\n👥 Found ${candidates?.length || 0} candidates for Taylor:`);
  candidates?.forEach(cand => {
    console.log(`\n  ID: ${cand.id}`);
    console.log(`  Name: ${cand.first_name} ${cand.last_name}`);
    console.log(`  Phone: ${cand.phone}`);
    console.log(`  AI Summary: ${cand.ai_summary?.substring(0, 100)}...`);
  });
}

checkRecruitCalls();


