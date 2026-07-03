/**
 * Check what the API actually returns for danielbeasley
 */

import { supabaseAdmin } from './server/supabase';

async function checkDanielbeasleyAPI() {
  console.log(`🔍 Checking what API returns for danielbeasley\n`);
  console.log('='.repeat(70));

  try {
    const email = 'danielbeasley@aoglobelife.com';

    // Get date range (same as API uses)
    const { getTodayEST } = await import('./server/scripts/calculate-dial-reach-booked-realtime');
    const { start: dateStart, end: dateEnd } = getTodayEST();

    console.log(`📅 Date range: ${dateStart.toISOString()} to ${dateEnd.toISOString()}\n`);

    // Check billing_transactions
    const { data: billingConnects } = await supabaseAdmin
      .from('billing_transactions')
      .select('*')
      .eq('agent_email', email)
      .eq('transaction_type', 'connect')
      .gte('transaction_date', dateStart.toISOString())
      .lt('transaction_date', dateEnd.toISOString());

    console.log(`📊 billing_transactions connects: ${billingConnects?.length || 0}`);

    // Check vdp_calls
    const { data: vdpCalls } = await supabaseAdmin
      .from('vdp_calls')
      .select('*')
      .eq('company_email', email)
      .gte('updated_at', dateStart.toISOString())
      .lt('updated_at', dateEnd.toISOString());

    console.log(`📊 vdp_calls count: ${vdpCalls?.length || 0}`);

    // Check live_call_boardt (if it exists)
    const { data: liveBoard } = await supabaseAdmin
      .from('live_call_boardt')
      .select('*')
      .eq('agent_email', email)
      .maybeSingle();

    if (liveBoard) {
      console.log(`\n📊 live_call_boardt:`);
      console.log(`   today_connects: ${liveBoard.today_connects}`);
      console.log(`   connects: ${liveBoard.connects || 'N/A'}`);
      console.log(`   updated_at: ${liveBoard.updated_at}`);
    } else {
      console.log(`\n📊 live_call_boardt: NO RECORD`);
    }

    // Check what the resultData would have
    const { data: connectTransactions } = await supabaseAdmin
      .from('billing_transactions')
      .select('agent_email')
      .eq('transaction_type', 'connect')
      .gte('transaction_date', dateStart.toISOString())
      .lt('transaction_date', dateEnd.toISOString())
      .eq('agent_email', email);

    console.log(`\n📊 resultData would have: ${connectTransactions?.length || 0} connects`);

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

checkDanielbeasleyAPI()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
