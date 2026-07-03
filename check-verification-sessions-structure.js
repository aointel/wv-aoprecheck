import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkVerificationSessionsStructure() {
  try {
    console.log('🔍 Checking verification_sessions table structure and data...');

    // Check table structure
    const structureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'verification_sessions'
      ORDER BY ordinal_position
    `);

    console.log(`\n📋 verification_sessions table structure:`);
    structureResult.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check sample data
    const sampleResult = await pool.query(`
      SELECT id, associate_id, agent_first_name, agent_last_name, agent_mga_team, agent_rga_team, created_at
      FROM verification_sessions 
      ORDER BY id DESC
      LIMIT 10
    `);

    console.log(`\n📊 Sample data from verification_sessions:`);
    sampleResult.rows.forEach(session => {
      console.log(`   ID ${session.id}: ${session.agent_first_name} ${session.agent_last_name} (associate_id: ${session.associate_id}) -> MGA: ${session.agent_mga_team || 'NULL'}`);
    });

    // Check data types
    console.log(`\n🔍 Checking associate_id data types...`);
    const typeResult = await pool.query(`
      SELECT associate_id, pg_typeof(associate_id) as type
      FROM verification_sessions 
      WHERE associate_id IS NOT NULL
      LIMIT 5
    `);
    
    if (typeResult.rows.length > 0) {
      console.log(`   Sample associate_id types:`);
      typeResult.rows.forEach(row => {
        console.log(`   ${row.associate_id} (type: ${row.type})`);
      });
    } else {
      console.log(`   No associate_id values found`);
    }

    // Check if associate_id column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'verification_sessions' 
        AND column_name = 'associate_id'
    `);

    if (columnCheck.rows.length > 0) {
      console.log(`\n✅ associate_id column exists`);
    } else {
      console.log(`\n❌ associate_id column does not exist`);
    }

  } catch (error) {
    console.error('❌ Error checking verification sessions structure:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkVerificationSessionsStructure();

