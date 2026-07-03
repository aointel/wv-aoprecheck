import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseHotleads() {
  console.log('🔍 Testing Supabase hotleads table connection...');
  console.log('🔧 URL:', supabaseUrl.substring(0, 30) + '...');
  console.log('🔧 Key:', supabaseKey.substring(0, 30) + '...');

  try {
    // 1. Test table access
    console.log('\n1. Testing table access...');
    const { data: testData, error: testError } = await supabase
      .from('hotleads')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('❌ Table access error:', testError);
      return;
    }

    console.log('✅ Table accessible');

    // 2. Count existing records
    console.log('\n2. Counting existing hotleads...');
    const { count, error: countError } = await supabase
      .from('hotleads')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count error:', countError);
    } else {
      console.log(`📊 Current hotleads count: ${count}`);
    }

    // 3. Get recent records
    console.log('\n3. Getting recent hotleads...');
    const { data: recentHotleads, error: recentError } = await supabase
      .from('hotleads')
      .select('id, first_name, last_name, phone, taalk_call_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      console.error('❌ Recent records error:', recentError);
    } else {
      console.log(`📋 Recent hotleads (${recentHotleads?.length || 0}):`);
      recentHotleads?.forEach((lead, i) => {
        console.log(`  ${i + 1}. ${lead.first_name} ${lead.last_name} (${lead.phone}) - ID: ${lead.taalk_call_id}`);
      });
    }

    // 4. Test insert
    console.log('\n4. Testing hotlead insert...');
    const testHotlead = {
      first_name: 'Test',
      last_name: 'Lead',
      phone: '+1234567890',
      email: 'test@example.com',
      duration_seconds: 120,
      hot_lead_reason: 'Test Insert',
      priority_score: 5,
      transferred: false,
      taalk_call_id: 'test_' + Date.now(),
      taalk_market: 'Test Market',
      status: 'NEW',
      follow_up_status: 'pending',
      call_date: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabase
      .from('hotleads')
      .insert([testHotlead])
      .select();

    if (insertError) {
      console.error('❌ Insert error:', insertError);
    } else {
      console.log('✅ Test insert successful:', insertData);
      
      // Clean up test record
      const { error: deleteError } = await supabase
        .from('hotleads')
        .delete()
        .eq('taalk_call_id', testHotlead.taalk_call_id);
        
      if (deleteError) {
        console.warn('⚠️ Could not delete test record:', deleteError);
      } else {
        console.log('🗑️ Test record cleaned up');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testSupabaseHotleads();