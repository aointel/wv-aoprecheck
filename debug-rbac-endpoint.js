// Test the RBAC endpoint directly
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

// Simulate the getUserPermissions function from rbac-helper.ts
async function getUserPermissions(userEmail) {
  try {
    console.log(`🔐 Getting permissions for user: ${userEmail}`);
    
    // Check if user is a Quality Manager FIRST (before agent profile check)
    const qmCheckResult = await pool.query('SELECT 1 FROM quality_manager_roles WHERE email = $1 AND is_active = true', [userEmail]);
    
    if (qmCheckResult.rows.length > 0) {
      // Create Supabase client for QM assignments
      const { data: qmTeamsResult, error: qmTeamsError } = await supabase
        .from('qm_mga_assignments')
        .select('mga')
        .eq('quality_manager', userEmail);
      
      if (qmTeamsError) {
        console.error('❌ Error fetching QM teams:', qmTeamsError);
        return {
          role: 'agent',
          canViewAll: false,
          allowedMgaTeams: [],
          allowedRgaTeams: [],
          precheck: {
            readScope: 'assigned_mga',
            canUpdateStatus: false,
            viewPII: false,
            evidenceAccess: 'none'
          }
        };
      }
      
      const assignedTeams = qmTeamsResult?.map((row) => row.mga) || [];
      
      console.log(`🎯 Quality Manager found: ${userEmail} with teams:`, assignedTeams);
      
      return {
        role: 'quality_manager',
        canViewAll: false,
        allowedMgaTeams: assignedTeams,
        allowedRgaTeams: [],
        precheck: {
          readScope: 'assigned_mga',
          canUpdateStatus: true,
          viewPII: true,
          evidenceAccess: 'full'
        }
      };
    }
    
    // Default fallback
    return {
      role: 'agent',
      canViewAll: false,
      allowedMgaTeams: [],
      allowedRgaTeams: [],
      precheck: {
        readScope: 'assigned_mga',
        canUpdateStatus: false,
        viewPII: false,
        evidenceAccess: 'none'
      }
    };
  } catch (error) {
    console.error('❌ Error in getUserPermissions:', error);
    return {
      role: 'agent',
      canViewAll: false,
      allowedMgaTeams: [],
      allowedRgaTeams: [],
      precheck: {
        readScope: 'assigned_mga',
        canUpdateStatus: false,
        viewPII: false,
        evidenceAccess: 'none'
      }
    };
  }
}

// Simulate the API endpoint logic
async function testApiEndpoint() {
  try {
    console.log('🔍 Testing API endpoint logic...');
    
    const userEmail = 'tomanovichqm@aoglobelife.com';
    
    // 1. Get user permissions
    console.log('\n1. Getting user permissions...');
    const permissions = await getUserPermissions(userEmail);
    console.log('✅ Permissions:', JSON.stringify(permissions, null, 2));
    
    // 2. Apply RBAC filtering
    console.log('\n2. Applying RBAC filtering...');
    let query = supabase
      .from('verification_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    // Apply RBAC filtering based on user permissions
    if (permissions.precheck.readScope === 'assigned_mga') {
      // Quality Manager and similar roles - filter by assigned teams
      if (permissions.allowedMgaTeams && permissions.allowedMgaTeams.length > 0) {
        // Filter by assigned MGA teams AND exclude null values
        query = query
          .in('agent_mga_team', permissions.allowedMgaTeams)
          .not('agent_mga_team', 'is', null);
        console.log(`🔐 RBAC ENABLED - Filtering by assigned MGA teams:`, permissions.allowedMgaTeams.slice(0, 5), `... (${permissions.allowedMgaTeams.length} total teams)`);
      } else {
        console.log(`⚠️ Quality Manager has no assigned teams - showing no sessions`);
        query = query.eq('agent_mga_team', 'NO_TEAMS_ASSIGNED'); // This will return no results
      }
    } else if (permissions.precheck.readScope === 'all') {
      // AO Quality Manager - see all sessions (no filtering)
      console.log(`🌍 AO Quality Manager - showing all sessions`);
    }
    
    // 3. Execute query
    console.log('\n3. Executing query...');
    const { data: result, error } = await query;
    
    if (error) {
      console.error('❌ Supabase query error:', error);
      return;
    }
    
    console.log(`✅ Found ${result?.length || 0} verification sessions`);
    
    if (result && result.length > 0) {
      console.log('Sample sessions:');
      result.slice(0, 3).forEach((session, index) => {
        console.log(`   ${index + 1}. ${session.first_name} ${session.last_name} (${session.agent_mga_team}) - ${session.status}`);
      });
    }
    
    console.log('\n🎯 API Endpoint Test Results:');
    console.log(`✅ User permissions: ${permissions.role}`);
    console.log(`✅ Assigned teams: ${permissions.allowedMgaTeams.length}`);
    console.log(`✅ Sessions returned: ${result?.length || 0}`);
    
    if ((result?.length || 0) > 0) {
      console.log('\n🎉 API endpoint logic is working correctly!');
    } else {
      console.log('\n⚠️ No sessions returned - check permissions or data');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testApiEndpoint();
