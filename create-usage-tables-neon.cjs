// Create usage tracking tables in Neon database
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

const DATABASE_URL = 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function createTables() {
  console.log('🔧 Creating usage tracking tables in Neon...\n');
  
  try {
    const sql = neon(DATABASE_URL);
    
    // Execute SQL statements one by one
    console.log('1️⃣ Creating weekly_usage_stats table...');
    await sql`
      CREATE TABLE IF NOT EXISTS weekly_usage_stats (
        id SERIAL PRIMARY KEY,
        agent_email TEXT NOT NULL,
        agent_name TEXT,
        week_start_date DATE NOT NULL,
        week_end_date DATE NOT NULL,
        total_logins INTEGER DEFAULT 0,
        unique_login_days INTEGER DEFAULT 0,
        total_online_minutes INTEGER DEFAULT 0,
        last_activity_at TIMESTAMPTZ,
        vdp_connects_received INTEGER DEFAULT 0,
        vdp_total_minutes INTEGER DEFAULT 0,
        total_dials_made INTEGER DEFAULT 0,
        total_call_minutes INTEGER DEFAULT 0,
        appointments_scheduled INTEGER DEFAULT 0,
        sales_made INTEGER DEFAULT 0,
        total_alp DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(agent_email, week_start_date)
      );
    `;
    console.log('   ✅ weekly_usage_stats created');
    
    console.log('2️⃣ Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_weekly_usage_agent_week ON weekly_usage_stats(agent_email, week_start_date);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_weekly_usage_week ON weekly_usage_stats(week_start_date);`;
    console.log('   ✅ Indexes created');
    
    console.log('3️⃣ Creating agent_activity_log table...');
    await sql`
      CREATE TABLE IF NOT EXISTS agent_activity_log (
        id SERIAL PRIMARY KEY,
        agent_email TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        activity_data JSONB,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        session_id TEXT,
        ip_address TEXT
      );
    `;
    console.log('   ✅ agent_activity_log created');
    
    console.log('4️⃣ Creating activity log indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_agent_time ON agent_activity_log(agent_email, timestamp);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_type ON agent_activity_log(activity_type);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_session ON agent_activity_log(session_id);`;
    console.log('   ✅ Activity indexes created');
    
    console.log('✅ Tables created successfully!\n');
    
    // Verify tables exist
    const tableCheck = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('weekly_usage_stats', 'agent_activity_log')
      ORDER BY tablename;
    `;
    
    console.log('📊 Tables created:');
    tableCheck.forEach(t => console.log(`   ✅ ${t.tablename}`));
    
    console.log('\n✅ Usage tracking tables ready!');
    console.log('   Users can now log in and their activity will be tracked\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTables();

