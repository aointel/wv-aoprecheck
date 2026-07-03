/**
 * Test script to verify agent_activity_log table works
 * Run this to test if inserts are working
 */

const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function testAgentActivityLog() {
  try {
    console.log('🧪 Testing agent_activity_log table...\n');
    
    // Test 1: Check if table exists
    console.log('1️⃣ Checking if table exists...');
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'agent_activity_log'
      ) as table_exists
    `;
    
    if (!tableCheck[0]?.table_exists) {
      console.error('❌ Table agent_activity_log does NOT exist!');
      console.log('💡 Run create-weekly-usage-tracking.sql to create it');
      return;
    }
    console.log('✅ Table exists\n');
    
    // Test 2: Check table schema
    console.log('2️⃣ Checking table schema...');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'agent_activity_log'
      ORDER BY ordinal_position
    `;
    console.log('Columns:', columns);
    console.log('');
    
    // Test 3: Try to insert a test record
    console.log('3️⃣ Testing INSERT...');
    const testEmail = 'test@aoglobelife.com';
    const testResult = await sql`
      INSERT INTO agent_activity_log (agent_email, activity_type, session_id, timestamp)
      VALUES (${testEmail}, 'test', 'test-session-123', NOW())
      RETURNING id, agent_email, activity_type, timestamp
    `;
    console.log('✅ Insert successful:', testResult[0]);
    console.log('');
    
    // Test 4: Verify it was inserted
    console.log('4️⃣ Verifying record exists...');
    const verify = await sql`
      SELECT * FROM agent_activity_log
      WHERE agent_email = ${testEmail}
      AND activity_type = 'test'
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    console.log('✅ Record found:', verify[0]);
    console.log('');
    
    // Test 5: Count total records
    const count = await sql`
      SELECT COUNT(*)::INTEGER as total FROM agent_activity_log
    `;
    console.log(`5️⃣ Total records in table: ${count[0]?.total || 0}\n`);
    
    // Test 6: Try heartbeat insert (same as API does)
    console.log('6️⃣ Testing heartbeat insert (same as API)...');
    const heartbeatResult = await sql`
      INSERT INTO agent_activity_log (agent_email, activity_type, session_id, timestamp)
      VALUES (${testEmail}, 'heartbeat', 'test-session-456', NOW())
      RETURNING id
    `;
    console.log('✅ Heartbeat insert successful, ID:', heartbeatResult[0]?.id);
    console.log('');
    
    // Test 7: Check recent heartbeats
    const recentHeartbeats = await sql`
      SELECT COUNT(*)::INTEGER as count
      FROM agent_activity_log
      WHERE activity_type = 'heartbeat'
      AND timestamp >= CURRENT_DATE - INTERVAL '7 days'
    `;
    console.log(`7️⃣ Heartbeats in last 7 days: ${recentHeartbeats[0]?.count || 0}\n`);
    
    console.log('✅✅✅ ALL TESTS PASSED - Table is working! ✅✅✅\n');
    console.log('💡 If API still not working, check:');
    console.log('   1. Is the API endpoint being called? (check server logs)');
    console.log('   2. Is the database connection string correct?');
    console.log('   3. Are there any errors in the API endpoint?');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    console.error('Error message:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testAgentActivityLog();
