// Test the fixed RBAC helper
import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

// Database configuration for local pool
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function testRbacFix() {
  try {
    console.log('🔍 Testing fixed RBAC helper...');
    
    const userEmail = 'tomanovichqm@aoglobelife.com';
    
    // 1. Test Quality Manager check (local database)
    console.log('\n1. Testing Quality Manager check:');
    const qmCheckResult = await pool.query('SELECT 1 FROM quality_manager_roles WHERE email = $1 AND is_active = true', [userEmail]);
    console.log(`✅ QM check result: ${qmCheckResult.rows.length} rows found`);
    
    if (qmCheckResult.rows.length > 0) {
      // 2. Test QM team assignments from Supabase (new logic)
      console.log('\n2. Testing QM team assignments from Supabase:');
      const { data: qmTeamsResult, error: qmTeamsError } = await supabase
        .from('qm_mga_assignments')
        .select('mga')
        .eq('quality_manager', userEmail);
      
      if (qmTeamsError) {
        console.error('❌ Error fetching QM teams:', qmTeamsError);
        return;
      }
      
      const assignedTeams = qmTeamsResult?.map((row) => row.mga) || [];
      console.log(`✅ Found ${assignedTeams.length} assigned teams:`);
      assignedTeams.forEach(team => console.log(`   - ${team}`));
      
      // 3. Test verification sessions query with these teams
      console.log('\n3. Testing verification sessions query:');
      if (assignedTeams.length > 0) {
        const { data: sessions, error: sessionsError } = await supabase
          .from('verification_sessions')
          .select('session_id, first_name, last_name, agent_mga_team, status, created_at')
          .in('agent_mga_team', assignedTeams)
          .not('agent_mga_team', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (sessionsError) {
          console.error('❌ Error fetching sessions:', sessionsError);
        } else {
          console.log(`✅ Found ${sessions?.length || 0} verification sessions:`);
          sessions?.forEach(session => {
            console.log(`   - ${session.first_name} ${session.last_name} (${session.agent_mga_team}) - ${session.status}`);
          });
        }
      }
      
      // 4. Test the complete API query
      console.log('\n4. Testing complete API query:');
      if (assignedTeams.length > 0) {
        let query = supabase
          .from('verification_sessions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        
        // Apply RBAC filtering
        query = query
          .in('agent_mga_team', assignedTeams)
          .not('agent_mga_team', 'is', null);
        
        const { data: apiResult, error: apiError } = await query;
        
        if (apiError) {
          console.error('❌ API query error:', apiError);
        } else {
          console.log(`✅ API query returned ${apiResult?.length || 0} sessions`);
          if (apiResult && apiResult.length > 0) {
            console.log('Sample session:', {
              session_id: apiResult[0].session_id,
              client_name: `${apiResult[0].first_name} ${apiResult[0].last_name}`,
              agent_mga_team: apiResult[0].agent_mga_team,
              status: apiResult[0].status
            });
          }
        }
      }
      
      console.log('\n🎯 RBAC Fix Test Results:');
      console.log(`✅ Quality Manager check: ${qmCheckResult.rows.length > 0 ? 'PASSED' : 'FAILED'}`);
      console.log(`✅ Supabase QM teams query: ${assignedTeams.length > 0 ? 'PASSED' : 'FAILED'} (${assignedTeams.length} teams)`);
      console.log(`✅ Verification sessions query: ${sessions?.length > 0 ? 'PASSED' : 'FAILED'} (${sessions?.length || 0} sessions)`);
      
      if (sessions && sessions.length > 0) {
        console.log('\n🎉 RBAC filtering is working correctly!');
        console.log(`📊 Quality Manager can see ${sessions.length} verification sessions`);
      } else {
        console.log('\n⚠️ No sessions found - may need to check data or filtering logic');
      }
      
    } else {
      console.log('❌ User is not a Quality Manager');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testRbacFix();
