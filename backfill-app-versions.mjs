import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔄 BACKFILLING APP VERSIONS FROM RECENT ACTIVITY...\n');

// Get all agents with presentations since Oct 25 (when v1.0.3 likely deployed)
const { data: sessions, error } = await supabase
  .from('presentation_sessions')
  .select('agent_email, agent_name, started_at')
  .gte('started_at', '2025-10-25T00:00:00Z')
  .order('started_at', { ascending: false });

if (error) {
  console.error('❌ Error fetching sessions:', error);
  process.exit(1);
}

console.log(`📊 Found ${sessions?.length || 0} presentation sessions since Oct 25\n`);

// Get unique agents
const agentMap = {};
sessions?.forEach(s => {
  if (!agentMap[s.agent_email]) {
    agentMap[s.agent_email] = {
      agent_email: s.agent_email,
      agent_name: s.agent_name || s.agent_email.split('@')[0],
      first_seen: s.started_at,
      last_seen: s.started_at
    };
  } else {
    // Update last_seen if this session is more recent
    if (new Date(s.started_at) > new Date(agentMap[s.agent_email].last_seen)) {
      agentMap[s.agent_email].last_seen = s.started_at;
    }
    // Update first_seen if this session is older
    if (new Date(s.started_at) < new Date(agentMap[s.agent_email].first_seen)) {
      agentMap[s.agent_email].first_seen = s.started_at;
    }
  }
});

const uniqueAgents = Object.values(agentMap);
console.log(`👥 Unique agents: ${uniqueAgents.length}\n`);

// Insert v1.0.3 for each agent
let inserted = 0;
let failed = 0;

for (const agent of uniqueAgents) {
  console.log(`📱 ${agent.agent_email}...`);
  
  try {
    const { error: upsertError } = await supabase
      .from('app_versions')
      .upsert({
        agent_email: agent.agent_email,
        agent_name: agent.agent_name,
        app_version: '1.0.3',
        platform: 'win32',
        os_version: 'win32 x64',
        first_seen: agent.first_seen,
        last_seen: agent.last_seen,
        created_at: agent.first_seen,
        updated_at: agent.last_seen
      }, {
        onConflict: 'agent_email'
      });
    
    if (upsertError) {
      console.log(`   ❌ Failed: ${upsertError.message}`);
      failed++;
    } else {
      console.log(`   ✅ Backfilled v1.0.3`);
      inserted++;
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    failed++;
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 BACKFILL COMPLETE:`);
console.log(`   ✅ Inserted: ${inserted}`);
console.log(`   ❌ Failed: ${failed}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Show results
const { data: versions } = await supabase
  .from('app_versions')
  .select('agent_email, app_version, last_seen')
  .order('last_seen', { ascending: false });

console.log(`\n✅ Current app_versions table (${versions?.length || 0} records):\n`);
versions?.forEach(v => {
  console.log(`   ${v.agent_email}: v${v.app_version} (last seen: ${v.last_seen})`);
});

console.log('\n✅ Done');

