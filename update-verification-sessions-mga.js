import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function updateVerificationSessionsMga() {
  try {
    console.log('🚀 Updating verification sessions with current MGA assignments from producerlist...');

    // 1. Get all verification sessions that have associate_id
    const sessionsResult = await pool.query(`
      SELECT id, associate_id, agent_first_name, agent_last_name, agent_mga_team, agent_rga_team
      FROM verification_sessions 
      WHERE associate_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 50
    `);

    console.log(`📊 Found ${sessionsResult.rows.length} verification sessions with associate_id`);

    if (sessionsResult.rows.length === 0) {
      console.log('✅ No sessions to update');
      return;
    }

    // 2. Get unique associate_ids
    const associateIds = [...new Set(sessionsResult.rows.map(row => row.associate_id))];
    console.log(`🔍 Looking up ${associateIds.length} unique associate IDs`);

    // 3. Look up current MGA teams from producerlist
    const producerResult = await pool.query(`
      SELECT associate_id, mga, rga, agent_name
      FROM producers 
      WHERE associate_id = ANY($1)
    `, [associateIds]);

    console.log(`📋 Found ${producerResult.rows.length} agents in producerlist table`);

    // 4. Create lookup map
    const mgaLookup = new Map();
    producerResult.rows.forEach(agent => {
      const mga = agent.mga || agent.rga || 'Unassigned';
      mgaLookup.set(agent.associate_id.toString(), {
        mga,
        agentName: agent.agent_name
      });
    });

    console.log(`🗺️ Created lookup map for ${mgaLookup.size} agents`);

    // 5. Show what we found vs what's in sessions
    console.log(`\n📊 Current MGA assignments from producerlist:`);
    mgaLookup.forEach((data, id) => {
      console.log(`   ${id}: ${data.agentName} -> ${data.mga}`);
    });

    // 6. Update verification sessions with current MGA teams
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const session of sessionsResult.rows) {
      const agentData = mgaLookup.get(session.associate_id.toString());
      if (agentData) {
        // Update with current MGA assignment
        await pool.query(`
          UPDATE verification_sessions 
          SET agent_mga_team = $1, agent_rga_team = $2
          WHERE id = $3
        `, [agentData.mga, agentData.mga, session.id]);
        
        updatedCount++;
        console.log(`✅ Updated session ${session.id}: ${session.agent_first_name} ${session.agent_last_name} (${session.associate_id}) -> ${agentData.mga}`);
      } else {
        notFoundCount++;
        console.log(`⚠️ No MGA data found for associate_id ${session.associate_id} (${session.agent_first_name} ${session.agent_last_name})`);
      }
    }

    console.log(`\n🎉 Update Summary:`);
    console.log(`   ✅ Updated: ${updatedCount} sessions`);
    console.log(`   ⚠️ Not found in producerlist: ${notFoundCount} sessions`);

    // 7. Show sample of updated data
    const sampleResult = await pool.query(`
      SELECT id, associate_id, agent_first_name, agent_last_name, agent_mga_team, agent_rga_team
      FROM verification_sessions 
      WHERE agent_mga_team IS NOT NULL 
        AND agent_mga_team != ''
      ORDER BY id DESC 
      LIMIT 5
    `);

    console.log(`\n📊 Sample updated sessions:`);
    sampleResult.rows.forEach(session => {
      console.log(`   ID ${session.id}: ${session.agent_first_name} ${session.agent_last_name} (${session.associate_id}) -> MGA: ${session.agent_mga_team}`);
    });

  } catch (error) {
    console.error('❌ Error updating verification sessions MGA:', error);
  } finally {
    await pool.end();
  }
}

// Run the update
updateVerificationSessionsMga();

