import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkAllVerificationTables() {
  try {
    console.log('🔍 Checking all verification-related tables and views...');

    // Check for all tables with 'verification' in the name
    const tablesResult = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_name LIKE '%verification%'
      ORDER BY table_name
    `);

    console.log(`\n📋 Verification-related tables/views:`);
    tablesResult.rows.forEach(table => {
      console.log(`   ${table.table_name} (${table.table_type})`);
    });

    // Check for all tables with 'session' in the name
    const sessionsResult = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_name LIKE '%session%'
      ORDER BY table_name
    `);

    console.log(`\n📋 Session-related tables/views:`);
    sessionsResult.rows.forEach(table => {
      console.log(`   ${table.table_name} (${table.table_type})`);
    });

    // Check if there are any views that might be adding associate_id
    const viewsResult = await pool.query(`
      SELECT table_name, view_definition
      FROM information_schema.views 
      WHERE table_name LIKE '%verification%' OR table_name LIKE '%session%'
    `);

    if (viewsResult.rows.length > 0) {
      console.log(`\n📋 Views that might be relevant:`);
      viewsResult.rows.forEach(view => {
        console.log(`   ${view.table_name}: ${view.view_definition.substring(0, 100)}...`);
      });
    }

    // Check if there are any functions that might be adding associate_id
    const functionsResult = await pool.query(`
      SELECT routine_name, routine_definition
      FROM information_schema.routines 
      WHERE routine_name LIKE '%verification%' OR routine_name LIKE '%session%'
    `);

    if (functionsResult.rows.length > 0) {
      console.log(`\n📋 Functions that might be relevant:`);
      functionsResult.rows.forEach(func => {
        console.log(`   ${func.routine_name}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking verification tables:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkAllVerificationTables();

