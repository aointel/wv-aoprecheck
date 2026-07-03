const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const USER_EMAIL = 'cnsysop@aoglobelife.com';

async function testMasterleadQuery() {
  console.log(`\n🔍 Testing masterlead query for ${USER_EMAIL}...\n`);

  try {
    // Normalize email (same as server does)
    const normalizedEmail = (USER_EMAIL || '').toLowerCase().trim();
    console.log(`📧 Normalized email: "${normalizedEmail}"\n`);

    // Query exactly as the server does
    const { data: masterleadCalls, error: masterleadError } = await supabase
      .from('masterlead')
      .select('*')
      .eq('cn_email', normalizedEmail)
      .in('cnresolution', ['booked', 'appointment_set', 'callback_requested'])
      .order('created_at', { ascending: false })
      .limit(1000);

    if (masterleadError) {
      console.error('❌ Supabase error:', masterleadError);
      return;
    }

    console.log(`✅ Found ${masterleadCalls?.length || 0} masterlead calls\n`);

    if (masterleadCalls && masterleadCalls.length > 0) {
      console.log('📋 First 5 records:');
      masterleadCalls.slice(0, 5).forEach((call, index) => {
        console.log(`\n  ${index + 1}. ID: ${call.id}`);
        console.log(`     cn_email: "${call.cn_email}"`);
        console.log(`     cnresolution: "${call.cnresolution}"`);
        console.log(`     first_name: "${call.first_name}"`);
        console.log(`     phone: "${call.phone}"`);
        console.log(`     created_at: ${call.created_at}`);
        console.log(`     called_at: ${call.called_at || 'null'}`);
      });

      // Check for any email mismatches
      const mismatches = masterleadCalls.filter(c => c.cn_email !== normalizedEmail);
      if (mismatches.length > 0) {
        console.log(`\n⚠️  Found ${mismatches.length} records with email mismatch:`);
        mismatches.slice(0, 3).forEach(c => {
          console.log(`     ID ${c.id}: "${c.cn_email}" !== "${normalizedEmail}"`);
        });
      } else {
        console.log(`\n✅ All ${masterleadCalls.length} records match normalized email`);
      }
    } else {
      console.log('⚠️  No records found!');
      
      // Let's check if records exist with different email casing
      console.log('\n🔍 Checking for records with different email casing...');
      const { data: allRecords, error: allError } = await supabase
        .from('masterlead')
        .select('id, cn_email, cnresolution')
        .in('cnresolution', ['booked', 'appointment_set', 'callback_requested'])
        .limit(10);
      
      if (!allError && allRecords && allRecords.length > 0) {
        console.log(`\n📋 Found ${allRecords.length} records with matching resolutions (any email):`);
        allRecords.forEach((r, i) => {
          console.log(`  ${i + 1}. ID: ${r.id}, cn_email: "${r.cn_email}", cnresolution: "${r.cnresolution}"`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testMasterleadQuery();

































