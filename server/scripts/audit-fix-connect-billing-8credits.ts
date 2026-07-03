/**
 * Pull every billing_transactions row with transaction_type = 'connect' in the last N months.
 * Report / fix rows where credits_charged !== 8 or amount_usd !== 8.
 *
 * Dry run (default): npx tsx server/scripts/audit-fix-connect-billing-8credits.ts
 * Apply updates:     npx tsx server/scripts/audit-fix-connect-billing-8credits.ts --apply
 *
 * Months window:     npx tsx server/scripts/audit-fix-connect-billing-8credits.ts --months=3
 */

import { supabaseAdmin } from '../supabase.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APPLY = process.argv.includes('--apply');
const monthsArg = process.argv.find((a) => a.startsWith('--months='));
const MONTHS = monthsArg ? Math.max(1, parseInt(monthsArg.split('=')[1] || '3', 10) || 3) : 3;

const EXPECT_CREDITS = 8;
const EXPECT_USD = 8;

function num(v: unknown): number {
  if (v == null) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function isOkCredits(c: unknown): boolean {
  return num(c) === EXPECT_CREDITS;
}

function isOkUsd(a: unknown): boolean {
  return num(a) === EXPECT_USD;
}

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }

  const since = new Date();
  since.setMonth(since.getMonth() - MONTHS);
  const sinceIso = since.toISOString();

  console.log(`\n📅 Window: created_at >= ${sinceIso} (${MONTHS} months)`);
  console.log(`🔎 transaction_type = 'connect'`);
  console.log(`✅ Expected: credits_charged=${EXPECT_CREDITS}, amount_usd=${EXPECT_USD}`);
  console.log(APPLY ? '⚠️  MODE: APPLY (will UPDATE rows)\n' : '🔒 MODE: DRY RUN (no writes)\n');

  const pageSize = 1000;
  let offset = 0;
  const all: any[] = [];

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('billing_transactions')
      .select(
        'id, transaction_id, transaction_type, agent_email, credits_charged, amount_usd, created_at, adjudication_decision, status, description',
      )
      .eq('transaction_type', 'connect')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('❌ Query error:', error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`📊 Total connect rows in window: ${all.length}\n`);

  const bad = all.filter((r) => !isOkCredits(r.credits_charged) || !isOkUsd(r.amount_usd));
  const ok = all.length - bad.length;

  console.log(`   OK (8 / $8):     ${ok}`);
  console.log(`   NEEDS FIX:       ${bad.length}\n`);

  const outDir = path.join(process.cwd(), 'server', 'scripts', 'output');
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch {
    /* ignore */
  }
  const csvPath = path.join(outDir, `connect-billing-audit-${new Date().toISOString().slice(0, 10)}.csv`);
  const csvHeader =
    'id,transaction_id,agent_email,credits_charged,amount_usd,created_at,adjudication_decision,status\n';
  const csvBody = all
    .map((r) =>
      [
        r.id,
        `"${String(r.transaction_id || '').replace(/"/g, '""')}"`,
        `"${String(r.agent_email || '').replace(/"/g, '""')}"`,
        r.credits_charged,
        r.amount_usd,
        r.created_at,
        r.adjudication_decision ?? '',
        r.status ?? '',
      ].join(','),
    )
    .join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvBody, 'utf8');
  console.log(`📄 Full export: ${csvPath}\n`);

  if (bad.length > 0) {
    console.log('Sample rows needing fix (up to 15):');
    for (const r of bad.slice(0, 15)) {
      console.log(
        `  id=${r.id} credits=${r.credits_charged} usd=${r.amount_usd} agent=${r.agent_email} tx=${r.transaction_id}`,
      );
    }
    if (bad.length > 15) console.log(`  ... +${bad.length - 15} more`);
    console.log('');
  }

  if (!APPLY) {
    console.log('Run with --apply to set credits_charged=8 and amount_usd=8 on those rows.');
    console.log('⚠️  This does NOT adjust user_credits — reconcile separately if needed.\n');
    return;
  }

  const chunkSize = 100;
  let updated = 0;
  let errors = 0;
  for (let i = 0; i < bad.length; i += chunkSize) {
    const chunk = bad.slice(i, i + chunkSize);
    const ids = chunk.map((r) => r.id);
    const { error } = await supabaseAdmin
      .from('billing_transactions')
      .update({
        credits_charged: EXPECT_CREDITS,
        amount_usd: EXPECT_USD,
      })
      .in('id', ids);
    if (error) {
      console.warn(`⚠️  batch ${i}-${i + chunk.length} failed:`, error.message);
      errors += chunk.length;
    } else {
      updated += chunk.length;
    }
  }
  console.log(`\n✅ Updated: ${updated}  Errors: ${errors}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
