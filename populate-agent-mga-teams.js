import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function populateAgentMgaTeams() {
  try {
    console.log('🚀 Populating agent_mga_team in verification_sessions...');

    // 1. Get all verification sessions that have associate_id but no agent_mga_team
    const sessionsResult = await pool.query(`
      SELECT id, associate_id, agent_first_name, agent_last_name
      FROM verification_sessions 
      WHERE associate_id IS NOT NULL 
        AND (agent_mga_team IS NULL OR agent_mga_team = '')
      LIMIT 100
    `);

    console.log(`📊 Found ${sessionsResult.rows.length} sessions to update`);

    if (sessionsResult.rows.length === 0) {
      console.log('✅ No sessions need updating');
      return;
    }

    // 2. Get unique associate_ids
    const associateIds = [...new Set(sessionsResult.rows.map(row => row.associate_id))];
    console.log(`🔍 Looking up ${associateIds.length} unique associate IDs`);

    // 3. Look up MGA teams from producerlist
    const producerResult = await pool.query(`
      SELECT associate_id, mga, rga, agent_name
      FROM producers 
      WHERE associate_id = ANY($1)
    `, [associateIds]);

    console.log(`📋 Found ${producerResult.rows.length} agents in producers table`);

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

    // 5. Update verification sessions with MGA teams
    let updatedCount = 0;
    for (const session of sessionsResult.rows) {
      const agentData = mgaLookup.get(session.associate_id.toString());
      if (agentData) {
        await pool.query(`
          UPDATE verification_sessions 
          SET agent_mga_team = $1, agent_rga_team = $2
          WHERE id = $3
        `, [agentData.mga, agentData.mga, session.id]);
        
        updatedCount++;
        console.log(`✅ Updated session ${session.id}: ${agentData.agentName} -> ${agentData.mga}`);
      } else {
        console.log(`⚠️ No MGA data found for associate_id ${session.associate_id}`);
      }
    }

    console.log(`🎉 Successfully updated ${updatedCount} verification sessions`);

    // 6. Show sample of updated data
    const sampleResult = await pool.query(`
      SELECT id, associate_id, agent_first_name, agent_last_name, agent_mga_team, agent_rga_team
      FROM verification_sessions 
      WHERE agent_mga_team IS NOT NULL 
        AND agent_mga_team != ''
      ORDER BY id DESC 
      LIMIT 5
    `);

    console.log('📊 Sample updated sessions:');
    sampleResult.rows.forEach(session => {
      console.log(`   ID ${session.id}: ${session.agent_first_name} ${session.agent_last_name} (${session.associate_id}) -> MGA: ${session.agent_mga_team}`);
    });

  } catch (error) {
    console.error('❌ Error populating agent MGA teams:', error);
  } finally {
    await pool.end();
  }
}

// Run the population
populateAgentMgaTeams();

