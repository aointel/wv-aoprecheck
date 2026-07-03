/**
 * Check carlos's connects from billing_transactions directly
 */

import { supabaseAdmin } from './server/supabase';

async function checkCarlosConnects() {
  console.log(`🔍 Checking carlos's connects from billing_transactions\n`);
  console.log('='.repeat(70));

  try {
    const email = 'carlosarmandoalfagofarge@aoglobelife.com';

    // Get today's date range in EST
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStart = new Date(estDate);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    console.log(`📅 Date range: ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);

    // Get connects from billing_transactions for TODAY
    const { data: todayConnects, error: todayError } = await supabaseAdmin
      .from('billing_transactions')
      .select('*')
      .eq('agent_email', email)
      .eq('transaction_type', 'connect')
      .gte('transaction_date', todayStart.toISOString())
      .lt('transaction_date', todayEnd.toISOString());

    if (todayError) {
      console.error('❌ Error:', todayError);
      return;
    }

    console.log(`\n📊 TODAY's connects: ${todayConnects?.length || 0}`);

    // Get ALL connects (all time)
    const { data: allConnects, error: allError } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_date, credits_charged, amount_usd, lead_name, lead_phone')
      .eq('agent_email', email)
      .eq('transaction_type', 'connect')
      .order('transaction_date', { ascending: false })
      .limit(50);

    if (allError) {
      console.error('❌ Error:', allError);
      return;
    }

    console.log(`\n📊 ALL TIME connects: ${allConnects?.length || 0}`);
    
    if (allConnects && allConnects.length > 0) {
      console.log(`\n📋 Recent connects (last 10):`);
      allConnects.slice(0, 10).forEach((tx, idx) => {
        const date = new Date(tx.transaction_date);
        console.log(`${idx + 1}. ${date.toLocaleString()} | Credits: ${tx.credits_charged} | Amount: $${tx.amount_usd} | ${tx.lead_name || tx.lead_phone || 'N/A'}`);
      });

      const oldest = allConnects[allConnects.length - 1];
      const newest = allConnects[0];
      console.log(`\n📅 First connect: ${new Date(oldest.transaction_date).toLocaleString()}`);
      console.log(`📅 Last connect: ${new Date(newest.transaction_date).toLocaleString()}`);
    }

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

checkCarlosConnects()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
