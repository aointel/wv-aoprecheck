// Create Supabase twilio_call_logs table
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTwilioCallLogsTable() {
  console.log('🔧 Creating twilio_call_logs table in Supabase...');
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      -- Create twilio_call_logs table
      CREATE TABLE IF NOT EXISTS twilio_call_logs (
        id SERIAL PRIMARY KEY,
        
        -- Twilio call data
        twilio_call_sid VARCHAR(34) UNIQUE NOT NULL,
        call_direction VARCHAR(20) NOT NULL,
        from_number VARCHAR(20) NOT NULL,
        to_number VARCHAR(20) NOT NULL,
        call_status VARCHAR(20) NOT NULL,
        call_duration INTEGER DEFAULT 0,
        
        -- Agent attribution (THE KEY PART)
        owner_email VARCHAR(255) NOT NULL,
        agent_identity VARCHAR(255),
        
        -- Call metadata
        call_started_at TIMESTAMPTZ,
        call_ended_at TIMESTAMPTZ,
        answered_by VARCHAR(255),
        
        -- Tracking data
        call_source VARCHAR(50) DEFAULT 'unknown',
        metadata JSONB DEFAULT '{}',
        
        -- System timestamps
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_owner_email ON twilio_call_logs(owner_email);
      CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_started_at ON twilio_call_logs(call_started_at);
      CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_twilio_sid ON twilio_call_logs(twilio_call_sid);
      CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_direction ON twilio_call_logs(call_direction);
    `
  });

  if (error) {
    console.error('❌ Error creating table:', error);
    
    // Try alternative approach - direct SQL
    console.log('🔄 Trying direct SQL approach...');
    
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS twilio_call_logs (
        id SERIAL PRIMARY KEY,
        twilio_call_sid VARCHAR(34) UNIQUE NOT NULL,
        call_direction VARCHAR(20) NOT NULL,
        from_number VARCHAR(20) NOT NULL,
        to_number VARCHAR(20) NOT NULL,
        call_status VARCHAR(20) NOT NULL,
        call_duration INTEGER DEFAULT 0,
        owner_email VARCHAR(255) NOT NULL,
        agent_identity VARCHAR(255),
        call_started_at TIMESTAMPTZ,
        call_ended_at TIMESTAMPTZ,
        answered_by VARCHAR(255),
        call_source VARCHAR(50) DEFAULT 'unknown',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    
    const { data: tableResult, error: tableError } = await supabase
      .from('twilio_call_logs')
      .select('id')
      .limit(1);
      
    if (tableError && tableError.code === '42P01') {
      console.log('❌ Table does not exist - manual creation needed');
      console.log('📋 Copy and paste this SQL into your Supabase SQL Editor:');
      console.log('\n' + '='.repeat(80));
      console.log(createTableSql);
      console.log('\n-- Create indexes');
      console.log('CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_owner_email ON twilio_call_logs(owner_email);');
      console.log('CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_started_at ON twilio_call_logs(call_started_at);');
      console.log('CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_twilio_sid ON twilio_call_logs(twilio_call_sid);');
      console.log('CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_direction ON twilio_call_logs(call_direction);');
      console.log('='.repeat(80));
    } else {
      console.log('✅ Table already exists or accessible');
    }
  } else {
    console.log('✅ twilio_call_logs table created successfully');
  }
}

createTwilioCallLogsTable().catch(console.error);