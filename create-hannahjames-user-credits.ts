/**
 * Create user_credits record for hannahjames@aoglobelife.com with negative balance
 * She has 496 missing credits (62 connect transactions × 8 credits each)
 */

import { supabaseAdmin } from './server/supabase';

async function createHannahjamesUserCredits() {
  console.log(`💳 Creating user_credits record for hannahjames@aoglobelife.com\n`);
  console.log('='.repeat(70));

  try {
    const email = 'hannahjames@aoglobelife.com';
    const missingCredits = 496; // 62 connect transactions × 8 credits

    // Check if record already exists
    const { data: existing } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      console.log(`⚠️ user_credits record already exists:`);
      console.log(`   Credits used: ${existing.credits_used}`);
      console.log(`   Credits remaining: ${existing.credits_remaining}`);
      console.log(`   Credits purchased: ${existing.credits_purchased}`);
      return;
    }

    // Get customer info
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('associate_id, company_email, personal_email, first_name, last_name')
      .or(`company_email.eq.${email},personal_email.eq.${email}`)
      .maybeSingle();

    const associateId = customer?.associate_id || null;
    const name = customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : null;

    console.log(`📊 Creating user_credits record:`);
    console.log(`   Email: ${email}`);
    console.log(`   Associate ID: ${associateId || 'N/A'}`);
    console.log(`   Name: ${name || 'N/A'}`);
    console.log(`   Credits purchased: 0`);
    console.log(`   Credits used: ${missingCredits}`);
    console.log(`   Credits remaining: -${missingCredits} (NEGATIVE)`);

    const { data: newCredit, error } = await supabaseAdmin
      .from('user_credits')
      .insert({
        email,
        associate_id: associateId,
        name: name || undefined,
        credits_purchased: 0,
        credits_used: missingCredits,
        aoi_connect_credits_used: missingCredits, // All 62 are connect transactions
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creating user_credits: ${error.message}`);
      return;
    }

    console.log(`\n✅ Successfully created user_credits record:`);
    console.log(`   Email: ${newCredit.email}`);
    console.log(`   Credits used: ${newCredit.credits_used}`);
    console.log(`   Credits remaining: ${newCredit.credits_remaining}`);
    console.log(`   Credits purchased: ${newCredit.credits_purchased}`);
    console.log(`   AOI Connect credits used: ${newCredit.aoi_connect_credits_used}`);

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

createHannahjamesUserCredits()
  .then(() => {
    console.log('\n✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
