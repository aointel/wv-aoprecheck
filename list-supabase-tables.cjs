require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  try {
    console.log('✅ Connected to Supabase\n');
    console.log('🔍 Listing all tables with call or twilio in name...\n');

    // Try to query for tables
    const { data, error } = await supabase.rpc('list_tables');
    
    if (error) {
      console.log('RPC not available, trying direct query...\n');
      
      // Try masterlead first
      const { data: ml, error: mlError } = await supabase
        .from('masterlead')
        .select('*')
        .limit(1);
      
      if (!mlError) {
        console.log('✅ masterlead table EXISTS');
      } else {
        console.log('❌ masterlead:', mlError.message);
      }

      // Try producerlist
      const { data: pl, error: plError } = await supabase
        .from('producerlist')
        .select('*')
        .limit(1);
      
      if (!plError) {
        console.log('✅ producerlist table EXISTS');
      } else {
        console.log('❌ producerlist:', plError.message);
      }

      // Try likely call-related tables
      const tables = [
        'call_logs',
        'twilio_call_logs',
        'outbound_calls',
        'outbound_call_history',
        'call_history',
        'twilio_logs',
        'agent_live_call_status'
      ];

      console.log('\n🔍 Checking for call-related tables:\n');
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (!error) {
          console.log(`✅ ${table} EXISTS`);
        } else {
          console.log(`❌ ${table}: ${error.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

listTables();

