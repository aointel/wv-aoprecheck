require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  try {
    console.log('🔍 Checking vdp_calls table columns...\n');
    
    const { data, error } = await supabase
      .from('vdp_calls')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No data in vdp_calls table');
      return;
    }
    
    console.log('📋 Columns in vdp_calls:\n');
    Object.keys(data[0]).forEach(col => {
      console.log(`   ${col}: ${data[0][col]}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkColumns();

