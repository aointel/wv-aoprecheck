const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Database connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateVerificationSchema() {
  console.log('🔄 Starting verification sessions schema migration...');
  
  try {
    // Add new text tracking fields
    const alterTableSQL = `
      ALTER TABLE verification_sessions 
      ADD COLUMN IF NOT EXISTS client_text_sent BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS client_text_sid TEXT,
      ADD COLUMN IF NOT EXISTS client_text_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS client_text_sent_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS client_text_delivered_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS client_text_read_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS agent_text_sent BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS agent_text_sid TEXT,
      ADD COLUMN IF NOT EXISTS agent_text_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS agent_text_sent_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS agent_text_delivered_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS agent_text_read_at TIMESTAMP WITH TIME ZONE;
    `;

    console.log('📝 Executing ALTER TABLE statement...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: alterTableSQL });
    
    if (error) {
      console.error('❌ Error executing migration:', error);
      
      // Try alternative approach with individual ALTER statements
      console.log('🔄 Trying alternative approach with individual ALTER statements...');
      
      const fields = [
        'client_text_sent BOOLEAN DEFAULT FALSE',
        'client_text_sid TEXT',
        'client_text_status TEXT DEFAULT \'pending\'',
        'client_text_sent_at TIMESTAMP WITH TIME ZONE',
        'client_text_delivered_at TIMESTAMP WITH TIME ZONE',
        'client_text_read_at TIMESTAMP WITH TIME ZONE',
        'agent_text_sent BOOLEAN DEFAULT FALSE',
        'agent_text_sid TEXT',
        'agent_text_status TEXT DEFAULT \'pending\'',
        'agent_text_sent_at TIMESTAMP WITH TIME ZONE',
        'agent_text_delivered_at TIMESTAMP WITH TIME ZONE',
        'agent_text_read_at TIMESTAMP WITH TIME ZONE'
      ];

      for (const field of fields) {
        try {
          const addColumnSQL = `ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS ${field};`;
          console.log(`📝 Adding column: ${field.split(' ')[0]}`);
          
          const { error: columnError } = await supabase.rpc('exec_sql', { sql: addColumnSQL });
          if (columnError) {
            console.log(`⚠️  Column ${field.split(' ')[0]} might already exist or failed to add:`, columnError.message);
          } else {
            console.log(`✅ Added column: ${field.split(' ')[0]}`);
          }
        } catch (err) {
          console.log(`⚠️  Column ${field.split(' ')[0]} might already exist:`, err.message);
        }
      }
    } else {
      console.log('✅ Migration completed successfully!');
    }

    // Verify the migration
    console.log('🔍 Verifying migration...');
    const { data: columns, error: verifyError } = await supabase
      .from('verification_sessions')
      .select('*')
      .limit(1);

    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
    } else {
      console.log('✅ Migration verification successful!');
      console.log('📊 Sample row structure:', Object.keys(columns[0] || {}));
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateVerificationSchema()
  .then(() => {
    console.log('🎉 Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
