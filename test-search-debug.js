import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSearchDebug() {
  try {
    console.log('🔍 Testing search functionality...');

    // Test 1: Basic query without search
    console.log('\n1. Testing basic query...');
    const { data: basicData, error: basicError } = await supabase
      .from('verification_sessions')
      .select('id, session_id, first_name, agent_first_name')
      .limit(2);

    if (basicError) {
      console.error('❌ Basic query error:', basicError);
    } else {
      console.log('✅ Basic query successful:', basicData.length, 'records');
    }

    // Test 2: Search with single field
    console.log('\n2. Testing search with single field...');
    const { data: searchData, error: searchError } = await supabase
      .from('verification_sessions')
      .select('id, session_id, first_name, agent_first_name')
      .ilike('first_name', '%Marc%')
      .limit(2);

    if (searchError) {
      console.error('❌ Search query error:', searchError);
    } else {
      console.log('✅ Search query successful:', searchData.length, 'records');
    }

    // Test 3: Search with OR condition
    console.log('\n3. Testing search with OR condition...');
    const { data: orData, error: orError } = await supabase
      .from('verification_sessions')
      .select('id, session_id, first_name, agent_first_name')
      .or('first_name.ilike.%Marc%,agent_first_name.ilike.%Marc%')
      .limit(2);

    if (orError) {
      console.error('❌ OR search query error:', orError);
    } else {
      console.log('✅ OR search query successful:', orData.length, 'records');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSearchDebug();

