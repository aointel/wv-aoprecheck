const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUsageStats() {
  console.log('🔍 Checking weekly_usage_stats table in Supabase...\n');
  
  try {
    // Check if table exists by trying to query it
    const { data, error, count } = await supabase
      .from('weekly_usage_stats')
      .select('*', { count: 'exact' })
      .limit(10);
    
    if (error) {
      console.error('❌ Error querying table:', error);
      console.log('\n💡 The weekly_usage_stats table probably does NOT exist in Supabase');
      console.log('   This table is in the Neon database (PostgreSQL), not Supabase!');
      console.log('   The usage tracker uses the Neon DB connection via Drizzle ORM\n');
      return;
    }
    
    console.log(`📊 Table exists! Total records: ${count || 0}\n`);
    
    if (data && data.length > 0) {
      console.log('✅ Sample data:');
      console.table(data.slice(0, 5));
    } else {
      console.log('⚠️  Table exists but is EMPTY - no usage data being tracked!\n');
      console.log('💡 Possible causes:');
      console.log('   1. UsageTracker.trackLogin() is not being called');
      console.log('   2. Users are not logging in via the auth system');
      console.log('   3. The tracking code is not running\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkUsageStats();






