import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testApiFiltering() {
  try {
    console.log('🔍 Testing API filtering issue...');
    
    const qmEmail = 'tomanovichqm@aoglobelife.com';
    
    // 1. Check QM assigned teams
    console.log('\n1. QM assigned teams:');
    const { data: qmAssignments, error: qmError } = await supabase
      .from('qm_mga_assignments')
      .select('mga')
      .eq('quality_manager', qmEmail);
    
    if (qmError) {
      console.error('❌ Error fetching QM assignments:', qmError);
      return;
    }
    
    const assignedTeams = qmAssignments?.map(a => a.mga) || [];
    console.log(`✅ ${qmEmail} assigned to ${assignedTeams.length} teams:`);
    assignedTeams.forEach(team => console.log(`   - ${team}`));
    
    // 2. Check what verification sessions exist with these team names
    console.log('\n2. Verification sessions for assigned teams:');
    const { data: sessions, error: sessionsError } = await supabase
      .from('verification_sessions')
      .select('session_id, first_name, last_name, agent_mga_team, status, created_at')
      .in('agent_mga_team', assignedTeams)
      .not('agent_mga_team', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError);
      return;
    }
    
    console.log(`✅ Found ${sessions?.length || 0} verification sessions for assigned teams:`);
    if (sessions && sessions.length > 0) {
      sessions.forEach(session => {
        console.log(`   - ${session.first_name} ${session.last_name} (${session.agent_mga_team}) - ${session.status}`);
      });
    } else {
      console.log('❌ No sessions found for assigned teams');
    }
    
    // 3. Check what agent_mga_team values actually exist in verification_sessions
    console.log('\n3. All agent_mga_team values in verification_sessions:');
    const { data: allTeams, error: allTeamsError } = await supabase
      .from('verification_sessions')
      .select('agent_mga_team')
      .not('agent_mga_team', 'is', null);
    
    if (!allTeamsError && allTeams) {
      const uniqueTeams = [...new Set(allTeams.map(s => s.agent_mga_team))];
      console.log(`✅ Found ${uniqueTeams.length} unique MGA teams in verification_sessions:`);
      uniqueTeams.slice(0, 10).forEach(team => console.log(`   - ${team}`));
      if (uniqueTeams.length > 10) {
        console.log(`   ... and ${uniqueTeams.length - 10} more`);
      }
      
      // Check if any assigned teams match
      console.log('\n4. Team matching analysis:');
      const matchingTeams = assignedTeams.filter(assigned => 
        uniqueTeams.some(existing => existing === assigned)
      );
      const nonMatchingTeams = assignedTeams.filter(assigned => 
        !uniqueTeams.some(existing => existing === assigned)
      );
      
      console.log(`✅ ${matchingTeams.length} assigned teams have sessions:`);
      matchingTeams.forEach(team => console.log(`   - ${team}`));
      
      if (nonMatchingTeams.length > 0) {
        console.log(`❌ ${nonMatchingTeams.length} assigned teams have no sessions:`);
        nonMatchingTeams.forEach(team => console.log(`   - ${team}`));
      }
    }
    
    // 4. Test the exact API query that should be used
    console.log('\n5. Testing exact API query:');
    if (assignedTeams.length > 0) {
      const { data: apiTest, error: apiError } = await supabase
        .from('verification_sessions')
        .select('*')
        .in('agent_mga_team', assignedTeams)
        .not('agent_mga_team', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (apiError) {
        console.error('❌ API test query error:', apiError);
      } else {
        console.log(`✅ API test query returned ${apiTest?.length || 0} sessions`);
        if (apiTest && apiTest.length > 0) {
          console.log('Sample session:', {
            session_id: apiTest[0].session_id,
            client_name: `${apiTest[0].first_name} ${apiTest[0].last_name}`,
            agent_mga_team: apiTest[0].agent_mga_team,
            status: apiTest[0].status
          });
        }
      }
    }
    
    console.log('\n🎯 Summary:');
    console.log(`- QM assigned to ${assignedTeams.length} teams`);
    console.log(`- Found ${sessions?.length || 0} sessions for these teams`);
    console.log(`- API should return ${sessions?.length || 0} sessions`);
    
    if ((sessions?.length || 0) === 0) {
      console.log('\n⚠️ ISSUE: No sessions found for assigned teams');
      console.log('Possible causes:');
      console.log('1. Team names don\'t match between qm_mga_assignments and verification_sessions');
      console.log('2. No verification sessions exist for these teams');
      console.log('3. RBAC filtering logic has an issue');
    } else {
      console.log('\n✅ Sessions found - API should be working');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testApiFiltering();
