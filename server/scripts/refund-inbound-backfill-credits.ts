/**
 * Refund credits that were charged by backfill-inbound-credits.ts.
 * Finds all billing_transactions from that backfill and subtracts the credits from user_credits.
 * Does not modify or delete billing_transactions.
 *
 * Run: npx tsx server/scripts/refund-inbound-backfill-credits.ts
 * Dry run (no DB changes): npx tsx server/scripts/refund-inbound-backfill-credits.ts 1
 */
import { supabaseAdmin } from '../supabase';

const CREDITS_PER_INBOUND = 8;

async function main() {
  const dryRun = process.argv[2] === '1' || process.argv[2] === 'true';

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  // Rows inserted by backfill-inbound-credits have this description
  const { data: rows, error } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, agent_email, credits_charged')
    .eq('description', 'Inbound connect (609/TaskRouter) backfill');

  if (error) {
    console.error('❌ Fetch billing_transactions:', error.message);
    process.exit(1);
  }

  const list = (rows || []) as { transaction_id: string; agent_email: string; credits_charged: number }[];
  if (list.length === 0) {
    console.log('\nNo backfill billing_transactions found. Nothing to refund.\n');
    return;
  }

  // Group by email, sum credits to refund
  const refundByEmail = new Map<string, number>();
  for (const r of list) {
    const email = (r.agent_email || '').trim().toLowerCase();
    if (!email) continue;
    const credits = typeof r.credits_charged === 'number' ? r.credits_charged : CREDITS_PER_INBOUND;
    refundByEmail.set(email, (refundByEmail.get(email) ?? 0) + credits);
  }

  console.log(`\n📋 Found ${list.length} backfill transaction(s) for ${refundByEmail.size} user(s). Dry run: ${dryRun}\n`);

  if (dryRun) {
    for (const [email, credits] of refundByEmail) {
      console.log(`  Would refund ${email}: ${credits} credits`);
    }
    console.log(`\nDone (dry run). Would refund ${list.length} transactions, ${refundByEmail.size} users. Run without argument to apply.\n`);
    return;
  }

  let refunded = 0;
  let errors = 0;

  for (const [email, creditsToRefund] of refundByEmail) {
    try {
      const { data: current, error: fetchErr } = await supabaseAdmin!
        .from('user_credits')
        .select('aoi_connect_credits_used, credits_used')
        .eq('email', email)
        .single();

      if (fetchErr || !current) {
        console.warn(`  ⚠️ No user_credits for ${email}, skipping refund`);
        errors++;
        continue;
      }

      const currentAoi = current.aoi_connect_credits_used ?? 0;
      const currentUsed = current.credits_used ?? 0;
      const newAoi = Math.max(0, currentAoi - creditsToRefund);
      const newUsed = Math.max(0, currentUsed - creditsToRefund);

      const { error: updateErr } = await supabaseAdmin!
        .from('user_credits')
        .update({
          aoi_connect_credits_used: newAoi,
          credits_used: newUsed,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email);

      if (updateErr) {
        console.warn(`  ⚠️ user_credits update failed for ${email}:`, updateErr.message);
        errors++;
        continue;
      }

      refunded += creditsToRefund;
      console.log(`  ✅ ${email}: refunded ${creditsToRefund} credits (aoi_connect: ${currentAoi} → ${newAoi}, credits_used: ${currentUsed} → ${newUsed})`);
    } catch (e) {
      console.warn(`  ⚠️ Error refunding ${email}:`, e);
      errors++;
    }
  }

  console.log(`\nDone. Credits refunded: ${refunded} across ${refundByEmail.size} users. Errors: ${errors}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
