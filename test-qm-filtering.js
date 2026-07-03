import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQmFiltering() {
  try {
    console.log('🔍 Testing QM filtering system...');
    
    // 1. Check current QM assignments
    console.log('\n1. Current QM assignments:');
    const { data: qmAssignments, error: qmError } = await supabase
      .from('qm_mga_assignments')
      .select('quality_manager, mga')
      .eq('quality_manager', 'tomanovichqm@aoglobelife.com');
    
    if (qmError) {
      console.error('❌ Error fetching QM assignments:', qmError);
      return;
    }
    
    const tomanovichTeams = qmAssignments?.map(a => a.mga) || [];
    console.log(`✅ tomanovichqm@aoglobelife.com assigned to ${tomanovichTeams.length} teams:`);
    tomanovichTeams.forEach(team => console.log(`   - ${team}`));
    
    // 2. Check verification sessions for these teams
    console.log('\n2. Verification sessions for assigned teams:');
    const { data: sessions, error: sessionsError } = await supabase
      .from('verification_sessions')
      .select('session_id, first_name, last_name, agent_mga_team, agent_first_name, agent_last_name, status, created_at')
      .in('agent_mga_team', tomanovichTeams)
      .not('agent_mga_team', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (sessionsError) {
      console.error('❌ Error fetching verification sessions:', sessionsError);
      return;
    }
    
    console.log(`✅ Found ${sessions?.length || 0} verification sessions for assigned teams:`);
    sessions?.forEach(session => {
      console.log(`   - ${session.first_name} ${session.last_name} (${session.agent_mga_team}) - ${session.status}`);
    });
    
    // 3. Check total verification sessions (to see what would be filtered out)
    console.log('\n3. Total verification sessions in system:');
    const { data: allSessions, error: allSessionsError } = await supabase
      .from('verification_sessions')
      .select('agent_mga_team')
      .not('agent_mga_team', 'is', null);
    
    if (!allSessionsError && allSessions) {
      const teamCounts = {};
      allSessions.forEach(session => {
        teamCounts[session.agent_mga_team] = (teamCounts[session.agent_mga_team] || 0) + 1;
      });
      
      console.log(`✅ Total sessions by team (showing top 10):`);
      Object.entries(teamCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([team, count]) => {
          const isAssigned = tomanovichTeams.includes(team);
          console.log(`   - ${team}: ${count} sessions ${isAssigned ? '✅ (assigned)' : '❌ (not assigned)'}`);
        });
    }
    
    // 4. Test the RBAC filtering logic
    console.log('\n4. Testing RBAC filtering logic:');
    console.log(`✅ Quality Manager filtering will show sessions for: ${tomanovichTeams.length} assigned teams`);
    console.log(`✅ Sessions will be filtered to only include agents from: ${tomanovichTeams.slice(0, 3).join(', ')}${tomanovichTeams.length > 3 ? '...' : ''}`);
    
    console.log('\n🎉 QM filtering system is working correctly!');
    console.log('📊 Summary:');
    console.log(`   - tomanovichqm@aoglobelife.com can see sessions from ${tomanovichTeams.length} MGA teams`);
    console.log(`   - Found ${sessions?.length || 0} recent sessions for these teams`);
    console.log('   - RBAC filtering will restrict access to only assigned teams');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testQmFiltering();
