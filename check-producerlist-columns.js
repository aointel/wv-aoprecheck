import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducerlistColumns() {
  try {
    console.log('🔍 Checking producerlist table structure...');

    // Get a sample record to see the column names
    const { data: sample, error } = await supabase
      .from('producerlist')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error fetching producerlist sample:', error);
      return;
    }

    if (sample && sample.length > 0) {
      console.log('📋 Available columns in producerlist:');
      Object.keys(sample[0]).forEach(column => {
        console.log(`   - ${column}: ${typeof sample[0][column]}`);
      });
      
      console.log('\n📄 Sample record:');
      console.log(JSON.stringify(sample[0], null, 2));
    } else {
      console.log('⚠️ No records found in producerlist');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkProducerlistColumns();

