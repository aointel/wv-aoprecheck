import { createClient } from '@supabase/supabase-js';

// Hardcoded values from server/hardcoded-config.ts
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixConnectsFromBilling() {
  console.log('🔧 Fixing connects from billing_transactions...\n');

  // Get today's date range in EST
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  todayStart.setMinutes(todayStart.getMinutes() - todayStart.getTimezoneOffset());
  
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  console.log(`📅 Date range: ${todayStart.toISOString()} to ${todayEnd.toISOString()}\n`);

  // Get all connects from billing_transactions
  const { data: billingConnects, error: billingError } = await supabase
    .from('billing_transactions')
    .select('agent_email, transaction_id, transaction_date')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', todayStart.toISOString())
    .lt('transaction_date', todayEnd.toISOString())
    .not('agent_email', 'is', null);

  if (billingError) {
    console.error('❌ Error fetching billing_transactions:', billingError);
    return;
  }

  // Count by agent
  const connectsByAgent = new Map();
  (billingConnects || []).forEach(transaction => {
    const email = String(transaction.agent_email).toLowerCase().trim();
    connectsByAgent.set(email, (connectsByAgent.get(email) || 0) + 1);
  });

  console.log(`💰 Found ${connectsByAgent.size} agents with ${billingConnects?.length || 0} total connects\n`);

  // Update existing agents in live_call_boardt
  let updatedCount = 0;
  let insertedCount = 0;

  for (const [agentEmail, connectCount] of connectsByAgent.entries()) {
    // Check if agent exists in live_call_boardt
    const { data: existing, error: checkError } = await supabase
      .from('live_call_boardt')
      .select('agent_email')
      .eq('agent_email', agentEmail)
      .maybeSingle();

    if (checkError) {
      console.error(`❌ Error checking ${agentEmail}:`, checkError);
      continue;
    }

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from('live_call_boardt')
        .update({
          today_connects: connectCount,
          updated_at: new Date().toISOString()
        })
        .eq('agent_email', agentEmail);

      if (updateError) {
        console.error(`❌ Error updating ${agentEmail}:`, updateError);
      } else {
        updatedCount++;
        console.log(`✅ Updated ${agentEmail}: ${connectCount} connects`);
      }
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from('live_call_boardt')
        .insert({
          agent_email: agentEmail,
          status: 'offline',
          today_dialed: 0,
          today_reached: 0,
          today_booked: 0,
          today_instant_presentation: 0,
          today_connects: connectCount,
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`❌ Error inserting ${agentEmail}:`, insertError);
      } else {
        insertedCount++;
        console.log(`✅ Inserted ${agentEmail}: ${connectCount} connects`);
      }
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`   Updated: ${updatedCount} agents`);
  console.log(`   Inserted: ${insertedCount} agents`);
  console.log(`   Total processed: ${connectsByAgent.size} agents`);
  console.log(`\n✅ Done! All connects from billing_transactions have been synced to live_call_boardt`);
}

fixConnectsFromBilling().catch(console.error);
