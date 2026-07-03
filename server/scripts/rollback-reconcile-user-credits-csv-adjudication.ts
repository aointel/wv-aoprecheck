/**
 * Undoes server/scripts/reconcile-user-credits-csv-adjudication.ts (--apply).
 *
 * Stamp ledger_version 2 (current): subtract `credits` from credits_used only (refund + uphold).
 * Stamp without version / v1 (legacy): uphold → subtract credits_purchased, refund → subtract credits_used.
 *
 * Then removes user_credits_csv_ledger_reconcile_v1 from metadata.
 *
 * Dry run: npx tsx server/scripts/rollback-reconcile-user-credits-csv-adjudication.ts
 * Apply:   npx tsx server/scripts/rollback-reconcile-user-credits-csv-adjudication.ts --apply
 */
import { supabaseAdmin } from '../supabase';

const META_KEY = 'user_credits_csv_ledger_reconcile_v1';
const TXN_PREFIX = 'csv2-end-';

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

type ReconcileStamp = {
  credits: number;
  decision: 'refund' | 'uphold';
  ledgerVersion: number;
  applied_at: string;
};

function stampFromMeta(meta: Record<string, unknown>): ReconcileStamp | null {
  const v = meta[META_KEY];
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const credits = Number(o.credits);
  const decision = String(o.decision || '').toLowerCase();
  if (!Number.isFinite(credits) || credits <= 0) return null;
  if (decision !== 'refund' && decision !== 'uphold') return null;
  const ledgerVersion = Number(o.ledger_version);
  const lv = Number.isFinite(ledgerVersion) && ledgerVersion >= 1 ? ledgerVersion : 1;
  return {
    credits: Math.floor(credits),
    decision: decision as 'refund' | 'uphold',
    ledgerVersion: lv,
    applied_at: String(o.applied_at || ''),
  };
}

async function main() {
  const apply = process.argv.includes('--apply');

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  const pageSize = 1000;
  let offset = 0;
  const rows: { id: number; transaction_id: string; agent_email: string | null; metadata: unknown }[] = [];

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('billing_transactions')
      .select('id, transaction_id, agent_email, metadata')
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

  type Item = {
    id: number;
    transaction_id: string;
    email: string;
    credits: number;
    decision: 'refund' | 'uphold';
    ledgerVersion: number;
  };
  const items: Item[] = [];

  for (const r of rows) {
    const meta = parseMeta(r.metadata);
    const st = stampFromMeta(meta);
    if (!st) continue;
    const email = (r.agent_email || '').trim().toLowerCase();
    if (!email) continue;
    items.push({
      id: r.id,
      transaction_id: r.transaction_id,
      email,
      credits: st.credits,
      decision: st.decision,
      ledgerVersion: st.ledgerVersion,
    });
  }

  const byEmail = new Map<string, { subUsed: number; subPurchased: number; rows: Item[] }>();
  for (const p of items) {
    const cur = byEmail.get(p.email) ?? { subUsed: 0, subPurchased: 0, rows: [] };
    if (p.ledgerVersion >= 2) {
      cur.subUsed += p.credits;
    } else {
      if (p.decision === 'refund') cur.subUsed += p.credits;
      else cur.subPurchased += p.credits;
    }
    cur.rows.push(p);
    byEmail.set(p.email, cur);
  }

  console.log(`\n📋 csv2-end-* rows with ${META_KEY}: ${items.length} (${byEmail.size} emails)`);
  console.log(apply ? '⚠️  MODE: APPLY (rollback)\n' : '🔒 MODE: DRY RUN\n');

  for (const [email, agg] of byEmail) {
    console.log(
      `  ${email}: −${agg.subUsed} credits_used, −${agg.subPurchased} credits_purchased (legacy v1 uphold only), ${agg.rows.length} txns`,
    );
  }

  if (!apply) {
    console.log('\nPass --apply to reverse user_credits and clear reconcile markers.\n');
    return;
  }

  let okUsers = 0;
  let errUsers = 0;
  let cleared = 0;
  let clearErr = 0;

  for (const [email, agg] of byEmail) {
    if (agg.subUsed === 0 && agg.subPurchased === 0) continue;

    try {
      const { data: current, error: fetchErr } = await supabaseAdmin
        .from('user_credits')
        .select('credits_used, credits_purchased')
        .eq('email', email)
        .maybeSingle();

      if (fetchErr || !current) {
        console.warn(`  ⚠️ No user_credits for ${email}, skipping`);
        errUsers++;
        continue;
      }

      const newUsed = Math.max(0, (Number(current.credits_used) || 0) - agg.subUsed);
      const newPurchased = Math.max(0, (Number(current.credits_purchased) || 0) - agg.subPurchased);

      const { error: updateErr } = await supabaseAdmin
        .from('user_credits')
        .update({
          credits_used: newUsed,
          credits_purchased: newPurchased,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email);

      if (updateErr) {
        console.warn(`  ⚠️ user_credits update failed ${email}:`, updateErr.message);
        errUsers++;
        continue;
      }

      console.log(
        `  ✅ ${email}: credits_used ${current.credits_used ?? 0} → ${newUsed}, credits_purchased ${current.credits_purchased ?? 0} → ${newPurchased}`,
      );
      okUsers++;

      const stamp = new Date().toISOString();
      for (const p of agg.rows) {
        const { data: br } = await supabaseAdmin
          .from('billing_transactions')
          .select('metadata')
          .eq('id', p.id)
          .maybeSingle();
        const m = parseMeta(br?.metadata);
        const { [META_KEY]: _removed, ...rest } = m;
        const nextMeta = {
          ...rest,
          user_credits_csv_ledger_reconcile_v1_rolled_back_at: stamp,
        };
        const { error: me } = await supabaseAdmin
          .from('billing_transactions')
          .update({ metadata: nextMeta, updated_at: stamp })
          .eq('id', p.id);
        if (me) {
          console.warn(`  ⚠️ Could not clear marker on ${p.transaction_id}:`, me.message);
          clearErr++;
        } else {
          cleared++;
        }
      }
    } catch (e) {
      console.warn(`  ⚠️ ${email}:`, e);
      errUsers++;
    }
  }

  console.log(
    `\nDone. user_credits rolled back: ${okUsers} users, errors: ${errUsers}. Markers cleared: ${cleared}, errors: ${clearErr}\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
