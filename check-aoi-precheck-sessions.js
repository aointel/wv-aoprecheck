import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkAoiPrecheckSessions() {
  try {
    console.log('🔍 Checking aoi_precheck_sessions table...');

    // Check table structure
    const structureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'aoi_precheck_sessions'
      ORDER BY ordinal_position
    `);

    console.log(`\n📋 aoi_precheck_sessions table structure:`);
    structureResult.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check sample data
    const sampleResult = await pool.query(`
      SELECT id, associate_id, agent_first_name, agent_last_name, agent_mga_team, agent_rga_team, created_at
      FROM aoi_precheck_sessions 
      ORDER BY id DESC
      LIMIT 10
    `);

    console.log(`\n📊 Sample data from aoi_precheck_sessions:`);
    sampleResult.rows.forEach(session => {
      console.log(`   ID ${session.id}: ${session.agent_first_name} ${session.agent_last_name} (associate_id: ${session.associate_id}) -> MGA: ${session.agent_mga_team || 'NULL'}`);
    });

    // Check if there are any sessions with associate_id
    const countResult = await pool.query(`
      SELECT COUNT(*) as total, COUNT(associate_id) as with_associate_id
      FROM aoi_precheck_sessions
    `);

    console.log(`\n📊 Data counts:`);
    console.log(`   Total sessions: ${countResult.rows[0].total}`);
    console.log(`   Sessions with associate_id: ${countResult.rows[0].with_associate_id}`);

  } catch (error) {
    console.error('❌ Error checking aoi_precheck_sessions:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkAoiPrecheckSessions();

