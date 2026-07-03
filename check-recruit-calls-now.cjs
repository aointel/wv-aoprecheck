const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
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
  
  console.log('\n🔍 Checking ALL recruit_candidates (any agent)...');
  
  const { data: allCandidates, error: allError } = await supabase
    .from('recruit_candidates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
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
  
  if (allError) {
    console.error('❌ Error:', allError);
    return;
  }
  
  console.log(`\n👥 ALL Candidates (any agent): ${allCandidates?.length || 0}`);
  allCandidates?.forEach(cand => {
    console.log(`\n  ID: ${cand.id}`);
    console.log(`  Name: ${cand.first_name} ${cand.last_name}`);
    console.log(`  Phone: ${cand.phone}`);
    console.log(`  Agent: ${cand.agent_email}`);
    console.log(`  AI Summary: ${cand.ai_summary ? (cand.ai_summary.substring(0, 80) + '...') : 'None'}`);
  });
  
  // Check specifically for Randall by phone
  console.log('\n🔍 Searching for Randall by phone...');
  const { data: randall } = await supabase
    .from('recruit_candidates')
    .select('*')
    .or('phone.eq.5032018470,phone.eq.+15032018470,phone.eq.(503) 201-8470');
  
  console.log(`\n🎯 Randall search results: ${randall?.length || 0}`);
  if (randall && randall.length > 0) {
    randall.forEach(r => {
      console.log(`  Found: ${r.first_name} ${r.last_name} - ${r.phone} - Agent: ${r.agent_email}`);
    });
  }
  
  // Search for candidate ID 72 specifically
  console.log('\n🔍 Looking for candidate ID 72 (Randall)...');
  const { data: id72 } = await supabase
    .from('recruit_candidates')
    .select('*')
    .eq('id', 72)
    .single();
  
  if (id72) {
    console.log(`\n✅ FOUND ID 72:`);
    console.log(`  Name: ${id72.first_name} ${id72.last_name}`);
    console.log(`  Phone: ${id72.phone}`);
    console.log(`  Email: ${id72.email}`);
    console.log(`  Agent: ${id72.agent_email}`);
    console.log(`  Stage: ${id72.current_stage_id}`);
    console.log(`  AI Summary: ${id72.ai_summary?.substring(0, 100)}...`);
  } else {
    console.log('  ❌ Candidate ID 72 not found!');
  }
}

checkRecruitCalls();

