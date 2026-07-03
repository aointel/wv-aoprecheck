// Check Neon database connection and weekly_usage_stats table
const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function checkNeonDB() {
  console.log('🔍 Checking Neon database connection and tables...\n');
  
  try {
    const sql = neon(DATABASE_URL);
    const db = drizzle(sql);
    
    // Check if weekly_usage_stats table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'weekly_usage_stats'
      ) as table_exists;
    `;
    
    console.log('📊 Table check:', tableCheck[0]);
    
    if (!tableCheck[0].table_exists) {
      console.log('\n❌ weekly_usage_stats table DOES NOT EXIST in Neon!');
      console.log('💡 You need to run create-weekly-usage-tracking.sql in Neon SQL console\n');
      return;
    }
    
    console.log('✅ weekly_usage_stats table EXISTS\n');
    
    // Check for current week data
    const currentWeekData = await sql`
      SELECT COUNT(*) as count
      FROM weekly_usage_stats
      WHERE week_start_date = (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::INTEGER))::DATE;
    `;
    
    console.log(`📊 Current week records: ${currentWeekData[0].count}\n`);
    
    if (currentWeekData[0].count == 0) {
      console.log('⚠️  NO DATA for current week!');
      console.log('💡 Possible causes:');
      console.log('   1. No logins this week');
      console.log('   2. UsageTracker.trackLogin() is not being called');
      console.log('   3. Database writes are failing\n');
    }
    
    // Check agent_activity_log
    const activityCheck = await sql`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'agent_activity_log'
      ) as table_exists;
    `;
    
    if (activityCheck[0].table_exists) {
      const recentActivity = await sql`
        SELECT COUNT(*) as count, MAX(timestamp) as last_activity
        FROM agent_activity_log
        WHERE timestamp >= NOW() - INTERVAL '24 hours';
      `;
      
      console.log('📊 Activity log (last 24h):', recentActivity[0]);
    } else {
      console.log('❌ agent_activity_log table DOES NOT EXIST\n');
    }
    
    // Show sample data if exists
    const sampleData = await sql`
      SELECT 
        agent_email,
        week_start_date,
        total_logins,
        total_online_minutes,
        vdp_connects_count
      FROM weekly_usage_stats
      ORDER BY week_start_date DESC
      LIMIT 5;
    `;
    
    if (sampleData.length > 0) {
      console.log('\n📊 Sample usage data (most recent):');
      console.table(sampleData);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkNeonDB();






