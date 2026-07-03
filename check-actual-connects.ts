/**
 * Check actual connects from billing_transactions for specific agents
 */

import { supabaseAdmin } from './server/supabase';

async function checkActualConnects() {
  console.log(`🔍 Checking actual connects from billing_transactions\n`);
  console.log('='.repeat(70));

  try {
    const emails = [
      'danielbeasley@aoglobelife.com'
    ];

    // Get today's date range in EST
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStart = new Date(estDate);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    console.log(`📅 Date range (TODAY): ${todayStart.toISOString()} to ${todayEnd.toISOString()}\n`);

    for (const email of emails) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`\n📊 ${email}\n`);

      // Get TODAY's connects
      const { data: todayConnects, error: todayError } = await supabaseAdmin
        .from('billing_transactions')
        .select('*')
        .eq('agent_email', email)
        .eq('transaction_type', 'connect')
        .gte('transaction_date', todayStart.toISOString())
        .lt('transaction_date', todayEnd.toISOString())
        .order('transaction_date', { ascending: false });

      if (todayError) {
        console.error(`❌ Error: ${todayError.message}`);
        continue;
      }

      // Get ALL connects (all time)
      const { data: allConnects, error: allError } = await supabaseAdmin
        .from('billing_transactions')
        .select('transaction_date, credits_charged, amount_usd, lead_name, lead_phone, status')
        .eq('agent_email', email)
        .eq('transaction_type', 'connect')
        .order('transaction_date', { ascending: false });

      if (allError) {
        console.error(`❌ Error: ${allError.message}`);
        continue;
      }

      console.log(`   TODAY's connects: ${todayConnects?.length || 0}`);
      console.log(`   ALL TIME connects: ${allConnects?.length || 0}`);

      if (allConnects && allConnects.length > 0) {
        // Group by date
        const byDate = new Map<string, number>();
        allConnects.forEach(tx => {
          const date = new Date(tx.transaction_date).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
          byDate.set(date, (byDate.get(date) || 0) + 1);
        });

        console.log(`\n   📅 Connects by date (last 10 days):`);
        const sortedDates = Array.from(byDate.entries()).sort((a, b) => {
          return new Date(b[0]).getTime() - new Date(a[0]).getTime();
        }).slice(0, 10);

        sortedDates.forEach(([date, count]) => {
          const isToday = date === new Date(estDate).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
          console.log(`      ${date}${isToday ? ' (TODAY)' : ''}: ${count} connects`);
        });

        // Show recent transactions
        console.log(`\n   📋 Recent connects (last 5):`);
        allConnects.slice(0, 5).forEach((tx, idx) => {
          const date = new Date(tx.transaction_date);
          const isToday = date >= todayStart && date < todayEnd;
          console.log(`      ${idx + 1}. ${date.toLocaleString('en-US', { timeZone: 'America/New_York' })}${isToday ? ' (TODAY)' : ''} | Credits: ${tx.credits_charged} | Amount: $${tx.amount_usd} | Status: ${tx.status || 'N/A'}`);
        });
      } else {
        console.log(`   ⚠️ No connects found in billing_transactions`);
      }
    }

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

checkActualConnects()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
