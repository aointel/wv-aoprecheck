import { supabaseAdmin } from './supabase.js';

async function addRecordingUrlColumn() {
  console.log('📊 Adding recording_supabase_url column to verification_sessions...\n');
  
  try {
    // Add the column
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE verification_sessions 
        ADD COLUMN IF NOT EXISTS recording_supabase_url TEXT;
      `
    });
    
    if (error) {
      console.error('❌ Error adding column:', error);
      
      // Try direct SQL approach
      console.log('🔄 Trying direct approach...');
      const { error: directError } = await supabaseAdmin
        .from('verification_sessions')
        .update({ recording_supabase_url: null })
        .eq('id', -1); // This will fail but might show us the schema
      
      console.log('Schema check result:', directError);
    } else {
      console.log('✅ Column added successfully!');
    }
    
  } catch (error) {
    console.error('❌ Exception:', error);
  }
  
  process.exit(0);
}

addRecordingUrlColumn();

