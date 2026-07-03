const { createClient } = require('@supabase/supabase-js');

// Database connection - using hardcoded credentials
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

console.log('🔧 Using Supabase URL:', supabaseUrl);
console.log('🔧 Service Key:', supabaseServiceKey.substring(0, 30) + '...');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabaseSchema() {
  console.log('🔍 Checking database schema...');
  
  try {
    // Try to get information about available tables
    console.log('📋 Checking available tables...');
    
    // Try to query information_schema
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tablesError) {
      console.log('⚠️  Could not query information_schema:', tablesError.message);
    } else {
      console.log('✅ Available tables:');
      tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    }

    // Try to check if verification_sessions exists by attempting a simple query
    console.log('\n🔍 Checking if verification_sessions table exists...');
    try {
      const { data: testData, error: testError } = await supabase
        .from('verification_sessions')
        .select('*')
        .limit(1);
      
      if (testError) {
        console.log('❌ verification_sessions table does not exist:', testError.message);
      } else {
        console.log('✅ verification_sessions table exists!');
        console.log('📊 Sample data structure:', Object.keys(testData[0] || {}));
      }
    } catch (err) {
      console.log('❌ Error checking verification_sessions:', err.message);
    }

    // Try to check other potential table names
    const potentialTables = [
      'verification_sessions',
      'verifications',
      'sessions',
      'zoom_verifications',
      'verification_workflow'
    ];

    console.log('\n🔍 Checking potential table names...');
    for (const tableName of potentialTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table ${tableName} does not exist:`, error.message);
        } else {
          console.log(`✅ Table ${tableName} exists!`);
          console.log(`📊 Columns:`, Object.keys(data[0] || {}));
        }
      } catch (err) {
        console.log(`❌ Error checking ${tableName}:`, err.message);
      }
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

// Run the check
checkDatabaseSchema()
  .then(() => {
    console.log('\n🎉 Database schema check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Schema check failed:', error);
    process.exit(1);
  });
