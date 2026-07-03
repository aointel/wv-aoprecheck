import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkProducerlistCompleteness() {
  try {
    console.log('🔍 Checking producerlist table completeness...');

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM producers');
    console.log(`📊 Total agents in producerlist: ${countResult.rows[0].total}`);

    // Get sample of associate_ids
    const sampleResult = await pool.query(`
      SELECT associate_id, agent_name, mga, rga, company_email
      FROM producers 
      ORDER BY associate_id
      LIMIT 20
    `);

    console.log(`\n📋 Sample agents from producerlist:`);
    sampleResult.rows.forEach(agent => {
      console.log(`   ${agent.associate_id}: ${agent.agent_name} -> MGA: ${agent.mga || 'NULL'}, RGA: ${agent.rga || 'NULL'}`);
    });

    // Check for specific associate_ids that we know exist in verification sessions
    const knownAssociateIds = [122582, 205517, 409, 65269, 204102, 21812, 111822, 112240, 93983, 56995, 172746, 1253];
    
    console.log(`\n🔍 Checking for known associate_ids from verification sessions:`);
    for (const id of knownAssociateIds) {
      const result = await pool.query(`
        SELECT associate_id, agent_name, mga, rga, company_email
        FROM producers 
        WHERE associate_id = $1
      `, [id]);
      
      if (result.rows.length > 0) {
        const agent = result.rows[0];
        console.log(`   ✅ Found ${id}: ${agent.agent_name} -> MGA: ${agent.mga || 'NULL'}, RGA: ${agent.rga || 'NULL'}`);
      } else {
        console.log(`   ❌ Not found: ${id}`);
      }
    }

    // Check if there are any agents with MGA assignments
    const mgaResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM producers 
      WHERE mga IS NOT NULL AND mga != ''
    `);
    console.log(`\n📊 Agents with MGA assignments: ${mgaResult.rows[0].count}`);

    // Check if there are any agents with RGA assignments
    const rgaResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM producers 
      WHERE rga IS NOT NULL AND rga != ''
    `);
    console.log(`📊 Agents with RGA assignments: ${rgaResult.rows[0].count}`);

    // Get unique MGA teams
    const mgaTeamsResult = await pool.query(`
      SELECT DISTINCT mga
      FROM producers 
      WHERE mga IS NOT NULL AND mga != ''
      ORDER BY mga
    `);
    console.log(`\n📋 Unique MGA teams in producerlist:`);
    mgaTeamsResult.rows.forEach(team => {
      console.log(`   - ${team.mga}`);
    });

  } catch (error) {
    console.error('❌ Error checking producerlist completeness:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkProducerlistCompleteness();

