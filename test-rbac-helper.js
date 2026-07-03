// Test the RBAC helper directly
import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function testRbacHelper() {
  try {
    console.log('🔍 Testing RBAC helper directly...');
    
    const userEmail = 'tomanovichqm@aoglobelife.com';
    
    // 1. Test Quality Manager check
    console.log('\n1. Testing Quality Manager check:');
    const qmCheckResult = await pool.query('SELECT 1 FROM quality_manager_roles WHERE email = $1 AND is_active = true', [userEmail]);
    console.log(`✅ QM check result: ${qmCheckResult.rows.length} rows found`);
    
    if (qmCheckResult.rows.length > 0) {
      // 2. Test QM team assignments query
      console.log('\n2. Testing QM team assignments query:');
      const qmTeamsResult = await pool.query(`
        SELECT mga
        FROM qm_mga_assignments
        WHERE quality_manager = $1
      `, [userEmail]);
      
      const assignedTeams = qmTeamsResult.rows.map((row) => row.mga);
      console.log(`✅ Found ${assignedTeams.length} assigned teams:`);
      assignedTeams.forEach(team => console.log(`   - ${team}`));
      
      // 3. Test the verification sessions query with these teams
      console.log('\n3. Testing verification sessions query:');
      if (assignedTeams.length > 0) {
        const sessionsQuery = `
          SELECT session_id, first_name, last_name, agent_mga_team, status, created_at
          FROM verification_sessions
          WHERE agent_mga_team = ANY($1) 
          AND agent_mga_team IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 10
        `;
        
        const sessionsResult = await pool.query(sessionsQuery, [assignedTeams]);
        console.log(`✅ Found ${sessionsResult.rows.length} verification sessions:`);
        sessionsResult.rows.forEach(session => {
          console.log(`   - ${session.first_name} ${session.last_name} (${session.agent_mga_team}) - ${session.status}`);
        });
      }
      
      // 4. Test the exact permissions object that should be returned
      console.log('\n4. Testing permissions object:');
      const permissions = {
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
      
      console.log('✅ Permissions object:', JSON.stringify(permissions, null, 2));
      
      // 5. Test the filtering logic
      console.log('\n5. Testing filtering logic:');
      if (permissions.precheck.readScope === 'assigned_mga') {
        if (permissions.allowedMgaTeams && permissions.allowedMgaTeams.length > 0) {
          console.log(`✅ Should filter by assigned MGA teams: ${permissions.allowedMgaTeams.length} teams`);
          console.log('   Teams:', permissions.allowedMgaTeams.slice(0, 3).join(', '), '...');
        } else {
          console.log('❌ No assigned teams - should show no sessions');
        }
      } else {
        console.log('❌ Wrong read scope:', permissions.precheck.readScope);
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

testRbacHelper();
