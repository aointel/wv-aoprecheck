const { createClient } = require('@supabase/supabase-js');

async function testSupabaseDirect() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://mlqhzshfpzjqijgimqvh.supabase.co';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scWh6c2hmcHpqcWlqZ2ltcXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI5MDA1NjIsImV4cCI6MjAzODQ3NjU2Mn0.t_88QyrBKaG1DI8LMNcfnBB4GcQPi1QZgQNZPVuMG7Q';

  console.log('Testing Supabase connection...');
  console.log('URL:', supabaseUrl);
  console.log('Key:', supabaseKey.substring(0, 20) + '...');

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Test basic connection
    console.log('\n1. Testing table structure...');
    const { data: columns, error: structError } = await supabase
      .from('hotleads')
      .select('*')
      .limit(1);

    if (structError) {
      console.error('❌ Structure error:', structError);
      return;
    }

    console.log('✅ Table accessible');

    // Test count
    console.log('\n2. Testing count...');
    const { count, error: countError } = await supabase
      .from('hotleads')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count error:', countError);
    } else {
      console.log('✅ Current count:', count);
    }

    // Test insert
    console.log('\n3. Testing insert...');
    const testData = {
      first_name: 'TEST',
      last_name: 'INSERT',
      phone: '+15555551234',
      email: 'test@example.com',
      call_date: '2025-08-06',
      call_time: '20:30:00',
      duration_seconds: 60,
      hot_lead_reason: 'Transfer Lost Quickly',
      priority_score: 8,
      transferred: true,
      transfer_duration_ms: 2000
    };

    const { data: insertData, error: insertError } = await supabase
      .from('hotleads')
      .insert([testData])
      .select();

    if (insertError) {
      console.error('❌ Insert error:', insertError);
    } else {
      console.log('✅ Insert successful:', insertData);
    }

    // Final count
    console.log('\n4. Final count check...');
    const { count: finalCount } = await supabase
      .from('hotleads')
      .select('*', { count: 'exact', head: true });

    console.log('✅ Final count:', finalCount);

  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

testSupabaseDirect();