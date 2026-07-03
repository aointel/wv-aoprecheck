/**
 * Applies user_credits adjustments from CSV backfill billing rows (csv2-end-*).
 *
 * Only adjudication_decision = uphold → ADD to credits_used (per credits_charged, default 8).
 * Refund / other decisions are skipped (not touched).
 *
 * Stamps metadata.user_credits_csv_ledger_reconcile_v1 with ledger_version: 2.
 *
 * Dry run (default): npx tsx server/scripts/reconcile-user-credits-csv-adjudication.ts
 * Apply:            npx tsx server/scripts/reconcile-user-credits-csv-adjudication.ts --apply
 *
 * Idempotent: rows with metadata.user_credits_csv_ledger_reconcile_v1 are skipped.
 */
import { supabaseAdmin } from '../supabase';

const META_KEY = 'user_credits_csv_ledger_reconcile_v1';
const DEFAULT_CREDITS = 8;
const TXN_PREFIX = 'csv2-end-';

function num(v: unknown): number {
  if (v == null) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function parseMeta(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

async function main() {
  const apply = process.argv.includes('--apply');

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  const pageSize = 1000;
  let offset = 0;
  const rows: {
    id: number;
    transaction_id: string;
    agent_email: string | null;
    credits_charged: number | null;
    adjudication_decision: string | null;
    metadata: unknown;
  }[] = [];

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('billing_transactions')
      .select('id, transaction_id, agent_email, credits_charged, adjudication_decision, metadata')
      .eq('transaction_type', 'connect')
      .like('transaction_id', `${TXN_PREFIX}%`)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('❌ Query billing_transactions:', error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    rows.push(...(data as typeof rows));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  type Pending = {
    id: number;
    transaction_id: string;
    email: string;
    credits: number;
  };

  const pending: Pending[] = [];
  let skippedReconciled = 0;
  let skippedNoEmail = 0;
  let skippedNonUphold = 0;

  for (const r of rows) {
    const meta = parseMeta(r.metadata);
    if (meta[META_KEY]) {
      skippedReconciled++;
      continue;
    }
    const email = (r.agent_email || '').trim().toLowerCase();
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    const d = (r.adjudication_decision || '').trim().toLowerCase();
    if (d !== 'uphold') {
      skippedNonUphold++;
      continue;
    }
    const c = num(r.credits_charged);
    const credits = Number.isFinite(c) && c > 0 ? Math.floor(c) : DEFAULT_CREDITS;
    pending.push({
      id: r.id,
      transaction_id: r.transaction_id,
      email,
      credits,
    });
  }

  const byEmail = new Map<string, { addUsed: number; rows: Pending[] }>();
  for (const p of pending) {
    const cur = byEmail.get(p.email) ?? { addUsed: 0, rows: [] };
    cur.addUsed += p.credits;
    cur.rows.push(p);
    byEmail.set(p.email, cur);
  }

  console.log(`\n📋 csv2-end-* connect rows loaded: ${rows.length}`);
  console.log(`   Pending reconcile: ${pending.length} (${byEmail.size} emails)`);
  console.log(`   Skipped (already ${META_KEY}): ${skippedReconciled}`);
  console.log(`   Skipped (no email): ${skippedNoEmail}`);
  console.log(`   Skipped (not uphold — refund/other): ${skippedNonUphold}`);
  console.log(apply ? '⚠️  MODE: APPLY\n' : '🔒 MODE: DRY RUN (no writes)\n');

  for (const [email, agg] of byEmail) {
    console.log(`  ${email}: +${agg.addUsed} credits_used (${agg.rows.length} uphold txns)`);
  }

  if (!apply) {
    console.log('\nPass --apply to update user_credits and mark billing rows reconciled.\n');
    return;
  }

  let okUsers = 0;
  let errUsers = 0;
  let marked = 0;
  let markErr = 0;

  for (const [email, agg] of byEmail) {
    if (agg.addUsed === 0) continue;

    try {
      const { data: current, error: fetchErr } = await supabaseAdmin
        .from('user_credits')
        .select('credits_used')
        .eq('email', email)
        .maybeSingle();

      if (fetchErr || !current) {
        console.warn(`  ⚠️ No user_credits for ${email}, skipping ${agg.rows.length} txns`);
        errUsers++;
        continue;
      }

      const newUsed = (Number(current.credits_used) || 0) + agg.addUsed;

      const { error: updateErr } = await supabaseAdmin
        .from('user_credits')
        .update({
          credits_used: newUsed,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email);

      if (updateErr) {
        console.warn(`  ⚠️ user_credits update failed ${email}:`, updateErr.message);
        errUsers++;
        continue;
      }

      console.log(`  ✅ ${email}: credits_used ${current.credits_used ?? 0} → ${newUsed}`);
      okUsers++;

      const stamp = new Date().toISOString();
      for (const p of agg.rows) {
        const { data: br } = await supabaseAdmin
          .from('billing_transactions')
          .select('metadata')
          .eq('id', p.id)
          .maybeSingle();
        const m = parseMeta(br?.metadata);
        const nextMeta = {
          ...m,
          [META_KEY]: {
            applied_at: stamp,
            credits: p.credits,
            decision: 'uphold',
            ledger_version: 2,
          },
        };
        const { error: me } = await supabaseAdmin
          .from('billing_transactions')
          .update({ metadata: nextMeta, updated_at: stamp })
          .eq('id', p.id);
        if (me) {
          console.warn(`  ⚠️ Could not mark txn ${p.transaction_id}:`, me.message);
          markErr++;
        } else {
          marked++;
        }
      }
    } catch (e) {
      console.warn(`  ⚠️ ${email}:`, e);
      errUsers++;
    }
  }

  console.log(
    `\nDone. user_credits updated: ${okUsers} users, errors: ${errUsers}. Rows marked: ${marked}, mark errors: ${markErr}\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
