/**
 * Delete ALL records from taalk_call_analytics. Does not touch billing_transactions.
 */

import { supabaseAdmin } from './server/supabase';

async function run() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase not available');
    process.exit(1);
  }
  console.log('🗑️ Deleting ALL taalk_call_analytics...\n');
  let total = 0;
  const batchSize = 1000;
  let offset = 0;
  while (true) {
    const { data: batch, error: fe } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id')
      .range(offset, offset + batchSize - 1);
    if (fe || !batch?.length) break;
    const { error: de } = await supabaseAdmin
      .from('taalk_call_analytics')
      .delete()
      .in('id', batch.map((r: { id: number }) => r.id));
    if (de) {
      console.error('❌ Delete error:', de);
      process.exit(1);
    }
    total += batch.length;
    console.log(`   Deleted ${batch.length} (total: ${total})`);
    if (batch.length < batchSize) break;
    offset += batchSize;
  }
  console.log(`\n✅ Done. Removed ${total} call analytics records.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
