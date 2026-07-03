import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n📱 CHECKING APP VERSIONS...\n');

const { data: versions, error } = await supabase
  .from('app_versions')
  .select('*')
  .order('last_seen', { ascending: false });

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

if (!versions || versions.length === 0) {
  console.log('⚠️  No version data yet.');
  console.log('   Wait for agents to open HPPRO with v1.0.3');
  process.exit(0);
}

console.log(`✅ Found ${versions.length} agents with version data:\n`);

// Group by version
const byVersion = {};
versions.forEach(v => {
  if (!byVersion[v.app_version]) {
    byVersion[v.app_version] = [];
  }
  byVersion[v.app_version].push(v);
});

Object.keys(byVersion).sort().reverse().forEach(version => {
  const agents = byVersion[version];
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📦 VERSION ${version} (${agents.length} agents):`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  agents.forEach(a => {
    console.log(`\n✅ ${a.agent_email}`);
    console.log(`   Platform: ${a.platform}`);
    console.log(`   Last seen: ${a.last_seen}`);
    console.log(`   First seen: ${a.first_seen}`);
  });
});

// Show who has v1.0.3
const v103Users = versions.filter(v => v.app_version === '1.0.3');
console.log('\n\n🎯 AGENTS WITH v1.0.3:', v103Users.length);
if (v103Users.length === 0) {
  console.log('   ⚠️  No one has reported v1.0.3 yet');
  console.log('   They need to open HPPRO for the first time');
}

// Show who needs to update
const oldVersionUsers = versions.filter(v => v.app_version !== '1.0.3');
if (oldVersionUsers.length > 0) {
  console.log('\n\n⚠️  AGENTS STILL ON OLD VERSIONS:', oldVersionUsers.length);
  oldVersionUsers.forEach(u => {
    console.log(`   ${u.agent_email}: v${u.app_version}`);
  });
}

console.log('\n✅ Done');

