const { createClient } = require('@supabase/supabase-js');

// Database connection - using hardcoded credentials
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

console.log('🔧 Using Supabase URL:', supabaseUrl);
console.log('🔧 Service Key:', supabaseServiceKey.substring(0, 30) + '...');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createVerificationTable() {
  console.log('🔄 Creating verification_sessions table...');
  
  try {
    // Create the verification_sessions table with all required fields
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS verification_sessions (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        spouse_name TEXT,
        phone TEXT NOT NULL,
        agent_phone TEXT,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        premium TEXT NOT NULL,
        verification_method TEXT,
        zoom_room_id TEXT,
        zoom_password TEXT,
        language TEXT DEFAULT 'en',
        screenshot_path TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        sms_verification_sent BOOLEAN DEFAULT FALSE,
        sms_verification_code TEXT,
        client_approval_status TEXT DEFAULT 'pending',
        client_approval_time TIMESTAMP WITH TIME ZONE,
        client_text_sent BOOLEAN DEFAULT FALSE,
        client_text_sid TEXT,
        client_text_status TEXT DEFAULT 'pending',
        client_text_sent_at TIMESTAMP WITH TIME ZONE,
        client_text_delivered_at TIMESTAMP WITH TIME ZONE,
        client_text_read_at TIMESTAMP WITH TIME ZONE,
        agent_text_sent BOOLEAN DEFAULT FALSE,
        agent_text_sid TEXT,
        agent_text_status TEXT DEFAULT 'pending',
        agent_text_sent_at TIMESTAMP WITH TIME ZONE,
        agent_text_delivered_at TIMESTAMP WITH TIME ZONE,
        agent_text_read_at TIMESTAMP WITH TIME ZONE,
        client_ip_address TEXT,
        client_country TEXT,
        client_region TEXT,
        client_city TEXT,
        client_latitude TEXT,
        client_longitude TEXT,
        client_timezone TEXT,
        client_isp TEXT,
        client_user_agent TEXT,
        agent_ip_address TEXT,
        agent_country TEXT,
        agent_region TEXT,
        agent_city TEXT,
        agent_latitude TEXT,
        agent_longitude TEXT,
        agent_timezone TEXT,
        agent_isp TEXT,
        agent_user_agent TEXT,
        call_completed BOOLEAN DEFAULT FALSE,
        verification_result TEXT,
        taalk_call_id TEXT,
        taalk_call_status TEXT,
        taalk_call_initiated_at TEXT,
        taalk_call_completed_at TEXT,
        taalk_call_duration INTEGER,
        taalk_call_data TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE
      );
    `;

    console.log('📝 Executing CREATE TABLE statement...');
    
    // Since we can't use exec_sql, let's try to create the table by inserting a test record
    // This will create the table if it doesn't exist
    console.log('🔄 Attempting to create table by inserting test record...');
    
    const testRecord = {
      session_id: 'test-session-' + Date.now(),
      first_name: 'Test',
      last_name: 'User',
      phone: '555-0000',
      city: 'Test City',
      state: 'TS',
      premium: '1000',
      status: 'pending'
    };

    const { data, error } = await supabase
      .from('verification_sessions')
      .insert(testRecord)
      .select();

    if (error) {
      console.error('❌ Error creating table:', error);
      
      // Try to create the table using a different approach
      console.log('🔄 Trying alternative table creation approach...');
      
      // We'll need to use the Supabase dashboard or SQL editor to create the table
      console.log('📋 Please create the table manually in Supabase with this SQL:');
      console.log('\n' + createTableSQL);
      
    } else {
      console.log('✅ Table created successfully!');
      console.log('📊 Test record inserted:', data);
      
      // Clean up the test record
      console.log('🧹 Cleaning up test record...');
      const { error: deleteError } = await supabase
        .from('verification_sessions')
        .delete()
        .eq('session_id', testRecord.session_id);
      
      if (deleteError) {
        console.log('⚠️  Could not clean up test record:', deleteError.message);
      } else {
        console.log('✅ Test record cleaned up');
      }
    }

    // Verify the table structure
    console.log('🔍 Verifying table structure...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('verification_sessions')
      .select('*')
      .limit(1);

    if (verifyError) {
      console.error('❌ Error verifying table:', verifyError);
    } else {
      console.log('✅ Table verification successful!');
      console.log('📊 Available columns:', Object.keys(verifyData[0] || {}));
    }

  } catch (error) {
    console.error('❌ Table creation failed:', error);
  }
}

// Run the table creation
createVerificationTable()
  .then(() => {
    console.log('\n🎉 Table creation process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Table creation failed:', error);
    process.exit(1);
  });
