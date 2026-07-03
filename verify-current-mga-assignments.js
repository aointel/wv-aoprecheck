import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function verifyCurrentMgaAssignments() {
  try {
    console.log('🔍 Verifying current MGA assignments vs verification sessions...');

    // Get some sample associate_ids from verification sessions
    const sampleAssociateIds = ['56995', '205517', '93983', '122582'];

    console.log(`📊 Checking current MGA assignments for: ${sampleAssociateIds.join(', ')}`);

    // Look up current MGA assignments from producerlist
    const producerResult = await pool.query(`
      SELECT associate_id, mga, rga, agent_name, company_email
      FROM producers 
      WHERE associate_id = ANY($1)
      ORDER BY associate_id
    `, [sampleAssociateIds]);

    console.log(`\n📋 Current MGA assignments from producerlist:`);
    producerResult.rows.forEach(agent => {
      const mga = agent.mga || agent.rga || 'Unassigned';
      console.log(`   ${agent.associate_id}: ${agent.agent_name} -> MGA: ${mga} (Email: ${agent.company_email})`);
    });

    // Get verification sessions for these agents
    const sessionsResult = await pool.query(`
      SELECT id, associate_id, agent_first_name, agent_last_name, agent_mga_team, agent_rga_team, created_at
      FROM verification_sessions 
      WHERE associate_id = ANY($1)
      ORDER BY created_at DESC
      LIMIT 10
    `, [sampleAssociateIds]);

    console.log(`\n📊 Verification sessions for these agents:`);
    sessionsResult.rows.forEach(session => {
      console.log(`   Session ${session.id}: ${session.agent_first_name} ${session.agent_last_name} (${session.associate_id}) -> MGA: ${session.agent_mga_team} (Created: ${session.created_at})`);
    });

    // Check if there are any mismatches
    console.log(`\n🔍 Checking for mismatches...`);
    const producerMap = new Map();
    producerResult.rows.forEach(agent => {
      const mga = agent.mga || agent.rga || 'Unassigned';
      producerMap.set(agent.associate_id.toString(), mga);
    });

    let mismatchCount = 0;
    sessionsResult.rows.forEach(session => {
      const currentMga = producerMap.get(session.associate_id.toString());
      if (currentMga && currentMga !== session.agent_mga_team) {
        console.log(`   ⚠️ MISMATCH: Agent ${session.associate_id} - Session shows "${session.agent_mga_team}" but current assignment is "${currentMga}"`);
        mismatchCount++;
      }
    });

    if (mismatchCount === 0) {
      console.log(`   ✅ No mismatches found - all sessions have current MGA assignments`);
    } else {
      console.log(`   ❌ Found ${mismatchCount} mismatches - sessions have outdated MGA assignments`);
    }

  } catch (error) {
    console.error('❌ Error verifying MGA assignments:', error);
  } finally {
    await pool.end();
  }
}

// Run the verification
verifyCurrentMgaAssignments();

