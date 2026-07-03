/**
 * Check for duplicate leads by phone or taalk_lead_id for an associate_id.
 * Run: npx tsx server/scripts/check-duplicate-leads.ts 409
 * Run for ALL associates: npx tsx server/scripts/check-duplicate-leads.ts all
 */

import { supabaseAdmin } from '../supabase';

const arg = process.argv[2];
const RUN_ALL = arg && String(arg).toLowerCase() === 'all';
const ASSOCIATE_ID = RUN_ALL ? null : parseInt(arg || '0', 10);
if (!RUN_ALL && (Number.isNaN(ASSOCIATE_ID) || ASSOCIATE_ID < 1)) {
  console.error('Usage: npx tsx server/scripts/check-duplicate-leads.ts <associate_id> | all');
  process.exit(1);
}

async function checkAssociate(associateId: number): Promise<void> {
  if (!supabaseAdmin) return;

  // Supabase caps at 1000 rows per query - paginate to fetch ALL
  let leads: any[] = [];
  const batch = 1000;
  let from = 0;
  while (true) {
    const to = from + batch - 1;
    const { data, error } = await supabaseAdmin
      .from('masterlead')
      .select('id, phone, taalk_lead_id, first_name, last_name, ao_lead_box, cnresolution')
      .eq('associate_id', associateId)
      .order('id', { ascending: true })
      .range(from, to);
    if (error) {
      console.error(`❌ Error for associate ${associateId}:`, error.message);
      throw new Error(error.message);
    }
    if (!data || data.length === 0) break;
    leads = leads.concat(data);
    if (data.length < batch) break;
    from = to + 1;
  }

  const byPhone = new Map<string, typeof leads>();
  const byTaalkId = new Map<string, typeof leads>();

  leads.forEach((l: any) => {
    const p = (l.phone || '').replace(/\D/g, '');
    if (p) {
      if (!byPhone.has(p)) byPhone.set(p, []);
      byPhone.get(p)!.push(l);
    }
    const t = (l.taalk_lead_id ?? '').toString().trim();
    const tid = t || '(empty)';
    if (!byTaalkId.has(tid)) byTaalkId.set(tid, []);
    byTaalkId.get(tid)!.push(l);
  });

  const dupPhone = [...byPhone.entries()].filter(([, v]) => v!.length > 1);
  const dupTaalk = [...byTaalkId.entries()].filter(([, v]) => v!.length > 1);

  if (leads.length === 0) {
    if (RUN_ALL) console.log(`Associate ${associateId}: 0 leads (skipped)`);
    return;
  }

  console.log(`\n=== Associate ${associateId} duplicate check ===\n`);
  console.log('Total leads:', leads?.length || 0);

  console.log('\n--- By PHONE ---');
  console.log('Unique phones:', byPhone.size);
  console.log('Duplicate phones (same number, multiple rows):', dupPhone.length);
  if (dupPhone.length > 0) {
    const totalDupRows = dupPhone.reduce((sum, [, v]) => sum + (v?.length || 0), 0);
    const extraRows = totalDupRows - dupPhone.length;
    console.log(`  Extra duplicate rows: ${extraRows} (${totalDupRows} rows across ${dupPhone.length} duplicate phones)`);
    console.log('\n  First 10:');
    dupPhone.slice(0, 10).forEach(([phone, rows]) => {
      const r = rows || [];
      console.log(`    Phone ${phone}: ${r.length} rows - ids: ${r.map((x: any) => x.id).join(', ')}`);
    });
  }

  console.log('\n--- By taalk_lead_id ---');
  console.log('Unique taalk_lead_ids:', byTaalkId.size);
  console.log('Duplicate taalk_lead_ids (same id, multiple rows):', dupTaalk.length);
  if (dupTaalk.length > 0) {
    const totalDupRows = dupTaalk.reduce((sum, [, v]) => sum + (v?.length || 0), 0);
    const extraRows = totalDupRows - dupTaalk.length;
    console.log(`  Extra duplicate rows: ${extraRows}`);
    console.log('\n  First 10:');
    dupTaalk.slice(0, 10).forEach(([tid, rows]) => {
      const r = rows || [];
      console.log(`    taalk_lead_id ${tid}: ${r.length} rows - ids: ${r.map((x: any) => x.id).join(', ')}`);
    });
  }
  console.log('');
}

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured');
    process.exit(1);
  }

  if (RUN_ALL) {
    const { data: ids, error } = await supabaseAdmin
      .from('customers')
      .select('associate_id')
      .not('associate_id', 'is', null);
    if (error) {
      console.error('❌ Error fetching associate_ids:', error.message);
      process.exit(1);
    }
    const unique = [...new Set((ids || []).map((r: any) => r.associate_id).filter((v: any) => v != null))].sort((a, b) => Number(a) - Number(b));
    console.log(`\n🔍 Running duplicate check for ${unique.length} associates: ${unique.join(', ')}\n`);
    for (const aid of unique) {
      const n = typeof aid === 'number' ? aid : parseInt(String(aid), 10);
      if (!Number.isNaN(n)) await checkAssociate(n);
    }
  } else {
    await checkAssociate(ASSOCIATE_ID!);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
