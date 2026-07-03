/**
 * Set cn_email = null for ALL masterlead rows that are pending (cnresolution in 'pending','new')
 * and currently have cn_email set. Uses cursor-based pagination (id > lastId) so every row is processed.
 * Usage: npx tsx server/scripts/reset-pending-leads-cn-email.ts [--dry-run]
 */

import { supabaseAdmin } from '../supabase.js';

const BATCH_SIZE = 1000;

async function main() {
  if (!supabaseAdmin) {
    console.error('Supabase admin not available');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('🔍 DRY RUN – no updates will be performed\n');

  // Dry-run: get total count only then exit
  if (dryRun) {
    const { count, error } = await supabaseAdmin
      .from('masterlead')
      .select('id', { count: 'exact', head: true })
      .or('cnresolution.eq.pending,cnresolution.eq.new')
      .not('cn_email', 'is', null);
    if (error) {
      console.error('Count error:', error);
      process.exit(1);
    }
    console.log(`Would clear cn_email for ${count ?? 0} pending leads. Run without --dry-run to apply.`);
    return;
  }

  let totalUpdated = 0;
  let round = 0;
  let lastId = 0;

  while (true) {
    round++;
    let query = supabaseAdmin
      .from('masterlead')
      .select('id')
      .or('cnresolution.eq.pending,cnresolution.eq.new')
      .not('cn_email', 'is', null)
      .order('id', { ascending: true })
      .range(0, BATCH_SIZE - 1);
    if (lastId > 0) {
      query = query.gt('id', lastId);
    }
    const { data: batch, error: selectErr } = await query;

    if (selectErr) {
      console.error('Select error:', selectErr);
      process.exit(1);
    }
    if (!batch?.length) break;

    const ids = batch.map((r) => r.id);
    lastId = Math.max(...ids);

    const { error: updateErr } = await supabaseAdmin
      .from('masterlead')
      .update({ cn_email: null })
      .in('id', ids);

    if (updateErr) {
      console.error('Update error:', updateErr);
      process.exit(1);
    }

    totalUpdated += ids.length;
    console.log(`  Cleared cn_email for ${ids.length} leads (batch ${round}, total ${totalUpdated})`);
    if (batch.length < BATCH_SIZE) break;
  }

  console.log(`\n✅ Done. Total leads reset (cn_email set to null): ${totalUpdated}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
