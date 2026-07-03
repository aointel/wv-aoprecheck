/**
 * Set timestamps on csv2-end-* connect billing rows to 2026-03-23 12:00 PM US Pacific wall time.
 *
 * Default offset -07:00 (PDT) — March 23, 2026 is after US DST start. Use --pst for -08:00 (PST).
 * Updates: transaction_date, created_at, updated_at (same instant).
 *
 * Dry run: npx tsx server/scripts/backfill-csv2-end-transaction-dates.ts
 * Apply:   npx tsx server/scripts/backfill-csv2-end-transaction-dates.ts --apply
 * PST:    npx tsx server/scripts/backfill-csv2-end-transaction-dates.ts --apply --pst
 */
import { supabaseAdmin } from '../supabase';

const TXN_PREFIX = 'csv2-end-';
const DATE_LOCAL = '2026-03-23T12:00:00';

async function main() {
  const apply = process.argv.includes('--apply');
  const pst = process.argv.includes('--pst');
  const tzOffset = pst ? '-08:00' : '-07:00';
  const TARGET_INSTANT = `${DATE_LOCAL}${tzOffset}`;

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  const pageSize = 1000;
  let pageOffset = 0;
  const ids: number[] = [];

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('billing_transactions')
      .select('id, transaction_id, transaction_date, created_at')
      .eq('transaction_type', 'connect')
      .like('transaction_id', `${TXN_PREFIX}%`)
      .order('id', { ascending: true })
      .range(pageOffset, pageOffset + pageSize - 1);

    if (error) {
      console.error('❌ Query:', error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    for (const r of data) ids.push(r.id);
    if (data.length < pageSize) break;
    pageOffset += pageSize;
  }

  console.log(`\n📋 Rows to update: ${ids.length} (${TXN_PREFIX}*, connect)`);
  console.log(
    `   Target: ${TARGET_INSTANT} (12:00 PM Pacific, ${pst ? 'PST -08' : 'PDT -07 — default for late March'})`,
  );
  console.log(`   Fields: transaction_date, created_at, updated_at`);
  console.log(apply ? '⚠️  APPLY\n' : '🔒 DRY RUN\n');

  if (!apply || ids.length === 0) {
    if (!apply) console.log('Pass --apply to write. Add --pst for UTC-8 instead of -7.\n');
    return;
  }

  const payload: Record<string, string> = {
    transaction_date: TARGET_INSTANT,
    created_at: TARGET_INSTANT,
    updated_at: TARGET_INSTANT,
  };

  let ok = 0;
  let err = 0;
  const batch = 50;
  for (let i = 0; i < ids.length; i += batch) {
    const slice = ids.slice(i, i + batch);
    for (const id of slice) {
      const { error: uerr } = await supabaseAdmin
        .from('billing_transactions')
        .update(payload)
        .eq('id', id);
      if (uerr) {
        console.warn(`  ⚠️ id ${id}:`, uerr.message);
        err++;
      } else {
        ok++;
      }
    }
  }

  console.log(`\nDone. Updated: ${ok}, errors: ${err}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
