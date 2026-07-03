/**
 * Backfill Call Analytics
 * 1. Backfill associate_id for existing rows (from customers/producerlist by agent_email)
 * 2. Process ALL pending calls - loops until none left
 *
 * Run: npm run backfill-call-analytics
 * NOTE: Run database/add-associate-id-taalk-call-analytics.sql in Supabase first if associate_id column doesn't exist.
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsScheduler } from './server/call-analytics-scheduler';

async function backfillAssociateIds() {
  console.log('🔄 Backfilling associate_id for taalk_call_analytics...\n');
  let rows: { id: number; agent_email: string }[];
  const { data: allRows, error } = await supabaseAdmin!
    .from('taalk_call_analytics')
    .select('id, agent_email, associate_id');
  if (error) {
    if (error.message?.includes('associate_id') || error.message?.includes('column')) {
      console.log('⚠️ associate_id column may not exist. Run database/add-associate-id-taalk-call-analytics.sql in Supabase first. Skipping associate_id backfill.\n');
      return;
    }
    throw error;
  }
  rows = (allRows || []).filter((r: any) => r.agent_email && (r.associate_id == null || r.associate_id === 0));
  if (!rows?.length) {
    console.log('✅ No rows need associate_id backfill');
    return;
  }
  console.log(`Found ${rows.length} rows to backfill associate_id`);
  const emailToAssociateId = new Map<string, number>();
  for (const row of rows) {
    const email = String(row.agent_email || '').toLowerCase().trim();
    if (!email || !email.includes('@') || emailToAssociateId.has(email)) continue;
    const { data: cust } = await supabaseAdmin!
      .from('customers')
      .select('associate_id')
      .or(`company_email.ilike.${email},personal_email.ilike.${email}`)
      .not('associate_id', 'is', null)
      .maybeSingle();
    if (cust?.associate_id != null) {
      emailToAssociateId.set(email, Number(cust.associate_id));
      continue;
    }
    const { data: pl } = await supabaseAdmin!
      .from('producerlist')
      .select('associate_id')
      .ilike('company_email', email)
      .not('associate_id', 'is', null)
      .maybeSingle();
    if (pl?.associate_id != null) emailToAssociateId.set(email, Number(pl.associate_id));
  }
  let updated = 0;
  for (const row of rows) {
    const email = String(row.agent_email || '').toLowerCase().trim();
    const aid = emailToAssociateId.get(email);
    if (aid == null) continue;
    const { error } = await supabaseAdmin!.from('taalk_call_analytics').update({ associate_id: aid }).eq('id', row.id);
    if (!error) updated++;
  }
  console.log(`✅ Backfilled associate_id for ${updated} rows\n`);
}

async function backfillAllCalls() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  console.log('🔄 Backfilling call analytics (associate_id + pending analysis)...\n');

  try {
    await backfillAssociateIds();

    console.log('🔄 Backfilling pending analysis...\n');
    let run = 0;
    const maxRuns = 100; // safety cap
    while (run < maxRuns) {
      run++;
      console.log(`\n--- Analysis batch ${run} ---`);
      await callAnalyticsScheduler.processPendingCalls(null);
      const { count } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('analysis_status', 'pending')
        .like('billing_transaction_id', 'twilio-%');
      const remaining = count ?? 0;
      console.log(`Remaining pending: ${remaining}`);
      if (remaining === 0) break;
      await new Promise(r => setTimeout(r, 3000));
    }
    console.log('\n✅ Backfill complete!');
  } catch (error: any) {
    console.error('❌ Error:', error?.message || error);
    process.exit(1);
  }
  process.exit(0);
}

backfillAllCalls();
