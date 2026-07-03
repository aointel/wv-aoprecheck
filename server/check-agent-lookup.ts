/**
 * Check if specific associate IDs exist in the database
 */

import { supabaseAdmin } from './supabase';

async function checkAgentLookup(associateIds: string[]) {
  console.log('🔍 Checking agent lookup for associate IDs:', associateIds.join(', '));
  
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not available');
    return;
  }

  for (const idStr of associateIds) {
    const associateId = parseInt(idStr, 10);
    if (isNaN(associateId)) {
      console.log(`\n❌ Invalid associate ID: ${idStr}`);
      continue;
    }

    console.log(`\n📋 Checking associate ID: ${associateId}`);

    // Check user_credits
    const { data: userCredit, error: userError } = await supabaseAdmin
      .from('user_credits')
      .select('email, associate_id, name')
      .eq('associate_id', associateId)
      .maybeSingle();

    if (userError) {
      console.log(`   ❌ Error querying user_credits: ${userError.message}`);
    } else if (userCredit) {
      console.log(`   ✅ Found in user_credits: ${userCredit.email} (${userCredit.name})`);
    } else {
      console.log(`   ⚠️ Not found in user_credits`);
    }

    // Check customers table
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('customer_email, associate_id, first_name, last_name')
      .eq('associate_id', associateId)
      .maybeSingle();

    if (customerError) {
      console.log(`   ❌ Error querying customers: ${customerError.message}`);
    } else if (customer) {
      console.log(`   ✅ Found in customers: ${customer.customer_email} (${customer.first_name} ${customer.last_name})`);
    } else {
      console.log(`   ⚠️ Not found in customers`);
    }

    // Check producerlist (if table exists)
    try {
      const { data: producer, error: producerError } = await supabaseAdmin
        .from('producerlist')
        .select('email, associate_id, name')
        .eq('associate_id', associateId)
        .maybeSingle();

      if (producerError) {
        if (producerError.code !== 'PGRST116') {
          console.log(`   ⚠️ Error querying producerlist: ${producerError.message}`);
        }
      } else if (producer) {
        console.log(`   ✅ Found in producerlist: ${producer.email}`);
      } else {
        console.log(`   ⚠️ Not found in producerlist`);
      }
    } catch (e) {
      console.log(`   ⚠️ Could not query producerlist (table may not exist)`);
    }
  }
}

// Check the associate IDs from the test
checkAgentLookup(['205289', '128036', '205226'])
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

