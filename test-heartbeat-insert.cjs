/**
 * Test script to verify heartbeat insert works
 * Uses the SAME database connection method as the server
 */

require('dotenv').config();
const { Pool, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { sql } = require('drizzle-orm');
const ws = require('ws');

// Configure WebSocket for serverless environments (same as server)
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

// Try to get DATABASE_URL from env, or use hardcoded fallback
let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  // Fallback to hardcoded URL (same as server uses)
  DATABASE_URL = 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
  console.log('⚠️ Using hardcoded DATABASE_URL (from hardcoded-config.ts)');
} else {
  console.log('✅ Using DATABASE_URL from environment');
}

// Create pool (same as server)
const pool = new Pool({ 
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,
  allowExitOnIdle: false,
});

// Create db (same as server)
const db = drizzle({ client: pool });

async function testHeartbeatInsert() {
  try {
    console.log('🧪 Testing heartbeat insert (using same method as server)...\n');
    
    const testEmail = 'test@aoglobelife.com';
    const testSessionId = `test-session-${Date.now()}`;
    
    // Test 1: Check table exists
    console.log('1️⃣ Checking if table exists...');
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'agent_activity_log'
      ) as table_exists
    `);
    
    if (!tableCheck.rows[0]?.table_exists) {
      console.error('❌ Table agent_activity_log does NOT exist!');
      return;
    }
    console.log('✅ Table exists\n');
    
    // Test 2: Insert heartbeat (EXACT same query as server)
    console.log('2️⃣ Inserting heartbeat (same query as server)...');
    const insertResult = await db.execute(sql`
      INSERT INTO agent_activity_log (agent_email, activity_type, session_id, timestamp)
      VALUES (${testEmail}, 'heartbeat', ${testSessionId}, NOW())
      RETURNING id, agent_email, activity_type, timestamp
    `);
    
    console.log('✅ Insert result:', insertResult.rows[0]);
    console.log('');
    
    // Test 3: Verify it exists
    console.log('3️⃣ Verifying record...');
    const verify = await db.execute(sql`
      SELECT * FROM agent_activity_log
      WHERE agent_email = ${testEmail}
      AND activity_type = 'heartbeat'
      AND session_id = ${testSessionId}
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    
    if (verify.rows && verify.rows.length > 0) {
      console.log('✅ Record verified:', verify.rows[0]);
    } else {
      console.error('❌ Record NOT found after insert!');
    }
    console.log('');
    
    // Test 4: Count all heartbeats
    const count = await db.execute(sql`
      SELECT COUNT(*)::INTEGER as total 
      FROM agent_activity_log 
      WHERE activity_type = 'heartbeat'
    `);
    console.log(`4️⃣ Total heartbeats in table: ${count.rows[0]?.total || 0}\n`);
    
    console.log('✅✅✅ TEST PASSED - Heartbeat insert works! ✅✅✅\n');
    console.log('💡 If API still fails, the issue is:');
    console.log('   - API endpoint not being called');
    console.log('   - Different database connection');
    console.log('   - Error being swallowed somewhere');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    console.error('Error message:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    await pool.end();
  }
}

testHeartbeatInsert();
