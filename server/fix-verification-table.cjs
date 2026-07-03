const { createClient } = require('@supabase/supabase-js');

// Database connection - using hardcoded credentials
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

console.log('🔧 Using Supabase URL:', supabaseUrl);
console.log('🔧 Service Key:', supabaseServiceKey.substring(0, 30) + '...');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixVerificationTable() {
  console.log('🔍 Checking current verification_sessions table structure...');
  
  try {
    // First, let's see what columns currently exist
    console.log('📋 Checking existing columns...');
    
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'verification_sessions')
      .eq('table_schema', 'public');
    
    if (columnsError) {
      console.error('❌ Error checking columns:', columnsError);
      return;
    }
    
    console.log('📋 Current columns in verification_sessions:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check if we need to add the text tracking fields
    const hasClientTextSent = columns.some(col => col.column_name === 'client_text_sent');
    const hasAgentTextSent = columns.some(col => col.column_name === 'agent_text_sent');
    
    if (!hasClientTextSent || !hasAgentTextSent) {
      console.log('🔧 Adding missing text tracking fields...');
      
      // Add the missing fields one by one
      const alterQueries = [];
      
      if (!hasClientTextSent) {
        alterQueries.push(`
          ALTER TABLE verification_sessions 
          ADD COLUMN client_text_sent BOOLEAN DEFAULT FALSE,
          ADD COLUMN client_text_sid TEXT,
          ADD COLUMN client_text_status TEXT DEFAULT 'pending',
          ADD COLUMN client_text_sent_at TIMESTAMP,
          ADD COLUMN client_text_delivered_at TIMESTAMP,
          ADD COLUMN client_text_read_at TIMESTAMP
        `);
      }
      
      if (!hasAgentTextSent) {
        alterQueries.push(`
          ALTER TABLE verification_sessions 
          ADD COLUMN agent_text_sent BOOLEAN DEFAULT FALSE,
          ADD COLUMN agent_text_sid TEXT,
          ADD COLUMN agent_text_status TEXT DEFAULT 'pending',
          ADD COLUMN agent_text_sent_at TIMESTAMP,
          ADD COLUMN agent_text_delivered_at TIMESTAMP,
          ADD COLUMN agent_text_read_at TIMESTAMP
        `);
      }
      
      // Execute the alter queries
      for (const query of alterQueries) {
        console.log('🔧 Executing:', query.trim());
        
        const { error: alterError } = await supabase.rpc('exec_sql', { sql: query });
        
        if (alterError) {
          console.error('❌ Error executing alter query:', alterError);
          console.log('⚠️  You may need to run this SQL manually in Supabase SQL Editor:');
          console.log(query);
        } else {
          console.log('✅ Successfully executed alter query');
        }
      }
    } else {
      console.log('✅ All text tracking fields already exist');
    }
    
    // Verify the final structure
    console.log('\n🔍 Final table structure:');
    const { data: finalColumns, error: finalError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'verification_sessions')
      .eq('table_schema', 'public')
      .order('ordinal_position');
    
    if (finalError) {
      console.error('❌ Error checking final structure:', finalError);
      return;
    }
    
    finalColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\n✅ Table structure check complete!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixVerificationTable();
