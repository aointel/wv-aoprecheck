import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

// Check app_versions table
console.log('🔍 CHECKING WHO HAS v1.0.3...\n');

const { data: versions, error } = await supabase
  .from('app_versions')
  .select('*')
  .order('last_seen', { ascending: false });

if (error) {
  console.error('❌ Error:', error);
} else if (!versions || versions.length === 0) {
  console.log('⚠️  NO ONE has reported an app version yet!');
  console.log('    This means the app_versions tracking is not working OR no one has v1.0.3');
} else {
  console.log(`✅ Found ${versions.length} app version records:\n`);
  
  const v103Users = versions.filter(v => v.app_version === '1.0.3');
  const otherUsers = versions.filter(v => v.app_version !== '1.0.3');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👥 USERS WITH v1.0.3:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (v103Users.length === 0) {
    console.log('   ❌ NO ONE HAS v1.0.3');
  } else {
    v103Users.forEach(u => {
      console.log(`\n✅ ${u.agent_email || u.user_email}`);
      console.log(`   Version: ${u.app_version}`);
      console.log(`   Last seen: ${u.last_seen}`);
      console.log(`   Platform: ${u.platform || 'unknown'}`);
    });
  }
  
  if (otherUsers.length > 0) {
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 USERS WITH OTHER VERSIONS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    otherUsers.forEach(u => {
      console.log(`\n⚠️  ${u.agent_email || u.user_email}`);
      console.log(`   Version: ${u.app_version || 'unknown'}`);
      console.log(`   Last seen: ${u.last_seen}`);
    });
  }
}

// Also check presentation_sessions for clues
console.log('\n\n🔍 CHECKING RECENT PRESENTATION SESSIONS...\n');
const { data: sessions } = await supabase
  .from('presentation_sessions')
  .select('agent_email, started_at, electron_session_id')
  .gte('started_at', '2025-10-25T00:00:00Z')
  .order('started_at', { ascending: false })
  .limit(20);

if (sessions && sessions.length > 0) {
  const uniqueAgents = [...new Set(sessions.map(s => s.agent_email))];
  console.log('📊 Agents with presentations since Oct 25:');
  uniqueAgents.forEach(email => {
    const count = sessions.filter(s => s.agent_email === email).length;
    console.log(`   ${email}: ${count} sessions`);
  });
}

console.log('\n✅ Done');

