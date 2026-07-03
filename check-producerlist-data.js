import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkProducerlistData() {
  try {
    console.log('🔍 Checking producerlist table structure and data...');

    // Check table structure
    const structureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'producers'
      ORDER BY ordinal_position
    `);

    console.log(`\n📋 producerlist table structure:`);
    structureResult.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check sample data
    const sampleResult = await pool.query(`
      SELECT associate_id, mga, rga, agent_name, company_email
      FROM producers 
      WHERE associate_id IS NOT NULL
      ORDER BY associate_id
      LIMIT 10
    `);

    console.log(`\n📊 Sample data from producerlist:`);
    sampleResult.rows.forEach(agent => {
      console.log(`   ${agent.associate_id}: ${agent.agent_name} -> MGA: ${agent.mga || 'NULL'}, RGA: ${agent.rga || 'NULL'} (Email: ${agent.company_email})`);
    });

    // Check if our specific associate_ids exist
    const specificIds = ['56995', '205517', '93983', '122582'];
    console.log(`\n🔍 Checking for specific associate_ids: ${specificIds.join(', ')}`);
    
    for (const id of specificIds) {
      const result = await pool.query(`
        SELECT associate_id, mga, rga, agent_name, company_email
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

    // Check data types
    console.log(`\n🔍 Checking associate_id data types...`);
    const typeResult = await pool.query(`
      SELECT associate_id, pg_typeof(associate_id) as type
      FROM producers 
      WHERE associate_id IS NOT NULL
      LIMIT 5
    `);
    
    console.log(`   Sample associate_id types:`);
    typeResult.rows.forEach(row => {
      console.log(`   ${row.associate_id} (type: ${row.type})`);
    });

  } catch (error) {
    console.error('❌ Error checking producerlist data:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkProducerlistData();

