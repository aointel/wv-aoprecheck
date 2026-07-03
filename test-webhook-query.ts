/**
 * Test the exact webhook query to see why it's failing
 */

import { supabaseAdmin } from './server/supabase';

async function testWebhookQuery() {
  const associateId = "207058"; // This is what Zapier sends (string)
  console.log(`🧪 Testing webhook query for associate_id: "${associateId}" (type: ${typeof associateId})\n`);

  try {
    // Convert to integer like the webhook does
    const associateIdInt = typeof associateId === 'string' ? parseInt(associateId, 10) : Number(associateId);
    console.log(`📊 Parsed associate_id: ${associateIdInt} (type: ${typeof associateIdInt})`);

    if (isNaN(associateIdInt) || associateIdInt <= 0) {
      console.error('❌ Invalid associate_id');
      return;
    }

    // Test 1: Query with integer (what webhook does)
    console.log('\n🔍 Test 1: Querying with integer...');
    const { data: customerData1, error: customerError1 } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email, associate_id, first_name, last_name')
      .eq('associate_id', associateIdInt)
      .maybeSingle();

    console.log(`   Result:`, {
      found: !!customerData1,
      error: customerError1?.message,
      data: customerData1
    });

    // Test 2: Query with string
    console.log('\n🔍 Test 2: Querying with string...');
    const { data: customerData2, error: customerError2 } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email, associate_id, first_name, last_name')
      .eq('associate_id', associateId)
      .maybeSingle();

    console.log(`   Result:`, {
      found: !!customerData2,
      error: customerError2?.message,
      data: customerData2
    });

    // Test 3: Query by email to verify customer exists
    console.log('\n🔍 Test 3: Querying by email (jesserusso@aoglobelife.com)...');
    const { data: customerData3, error: customerError3 } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email, associate_id, first_name, last_name')
      .eq('company_email', 'jesserusso@aoglobelife.com')
      .maybeSingle();

    console.log(`   Result:`, {
      found: !!customerData3,
      error: customerError3?.message,
      data: customerData3
    });

    // Test 4: Check what type associate_id column actually is
    console.log('\n🔍 Test 4: Checking associate_id values in customers table...');
    const { data: sampleCustomers } = await supabaseAdmin
      .from('customers')
      .select('associate_id, company_email')
      .gte('associate_id', 207050)
      .lte('associate_id', 207065)
      .limit(20);

    console.log(`   Found ${sampleCustomers?.length || 0} customers with associate_ids between 207050-207065:`);
    sampleCustomers?.forEach(c => {
      console.log(`      associate_id: ${c.associate_id} (type: ${typeof c.associate_id}) | ${c.company_email}`);
    });

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY:');
    console.log(`   Query with integer ${associateIdInt}: ${customerData1 ? '✅ FOUND' : '❌ NOT FOUND'}`);
    console.log(`   Query with string "${associateId}": ${customerData2 ? '✅ FOUND' : '❌ NOT FOUND'}`);
    console.log(`   Query by email: ${customerData3 ? '✅ FOUND' : '❌ NOT FOUND'}`);
    
    if (customerData3) {
      console.log(`   Customer's actual associate_id: ${customerData3.associate_id} (type: ${typeof customerData3.associate_id})`);
    }

    console.log('='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

testWebhookQuery()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
