const { createClient } = require('@supabase/supabase-js');

// Database connection - using hardcoded credentials
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

console.log('🔧 Using Supabase URL:', supabaseUrl);
console.log('🔧 Service Key:', supabaseServiceKey.substring(0, 30) + '...');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStructure() {
  console.log('🔍 Checking verification_sessions table structure...');
  
  try {
    // Try to insert a minimal test record to see what fields are missing
    const testData = {
      session_id: 'test-check-' + Date.now(),
      first_name: 'Test',
      last_name: 'User',
      phone: '5551234567',
      city: 'Test City',
      state: 'CA',
      premium: '100',
      verification_method: 'zoom',
      zoom_room_id: '123456789',
      zoom_password: 'test123',
      status: 'pending'
    };
    
    console.log('📝 Testing insert with minimal data...');
    
    const { data, error } = await supabase
      .from('verification_sessions')
      .insert(testData)
      .select();
    
    if (error) {
      console.error('❌ Insert failed:', error);
      
      if (error.code === '42703') {
        console.log('\n🚨 MISSING COLUMN ERROR DETECTED!');
        console.log('The table is missing required columns.');
        console.log('\n📋 You need to run this SQL in Supabase SQL Editor:');
        console.log(`
ALTER TABLE verification_sessions 
ADD COLUMN IF NOT EXISTS client_text_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS client_text_sid TEXT,
ADD COLUMN IF NOT EXISTS client_text_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS client_text_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS client_text_delivered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS client_text_read_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS agent_text_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agent_text_sid TEXT,
ADD COLUMN IF NOT EXISTS agent_text_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS agent_text_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS agent_text_delivered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS agent_text_read_at TIMESTAMP;
        `);
      }
    } else {
      console.log('✅ Test insert succeeded!');
      console.log('📋 Inserted data:', data);
      
      // Clean up
      const { error: deleteError } = await supabase
        .from('verification_sessions')
        .delete()
        .eq('session_id', testData.session_id);
      
      if (!deleteError) {
        console.log('🧹 Test record cleaned up');
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkTableStructure();
