/**
 * Delete duplicate masterlead rows by taalk_lead_id for an associate_id.
 * Keeps the row with lowest id (oldest), deletes the rest.
 * Run: npx tsx server/scripts/delete-duplicate-taalk-leads.ts 409
 * Run for ALL associates with duplicates: npx tsx server/scripts/delete-duplicate-taalk-leads.ts all
 */

import { supabaseAdmin } from '../supabase';

const arg = process.argv[2];
const RUN_ALL = arg && String(arg).toLowerCase() === 'all';
const ASSOCIATE_ID = RUN_ALL ? null : parseInt(arg || '0', 10);
if (!RUN_ALL && (Number.isNaN(ASSOCIATE_ID) || ASSOCIATE_ID < 1)) {
  console.error('Usage: npx tsx server/scripts/delete-duplicate-taalk-leads.ts <associate_id> | all');
  process.exit(1);
}

async function deleteForAssociate(associateId: number): Promise<number> {
  if (!supabaseAdmin) throw new Error('Supabase admin not configured');

  // Fetch ALL rows - paginate past 1000 cap
  let leads: any[] = [];
  const batch = 1000;
  let from = 0;
  while (true) {
    const to = from + batch - 1;
    const { data, error } = await supabaseAdmin
      .from('masterlead')
      .select('id, taalk_lead_id')
      .eq('associate_id', associateId)
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    leads = leads.concat(data);
    if (data.length < batch) break;
    from = to + 1;
  }

  const byTaalkId = new Map<string, any[]>();
  leads.forEach((l: any) => {
    const t = (l.taalk_lead_id ?? '').toString().trim();
    if (!t) return; // skip empty taalk_lead_id
    if (!byTaalkId.has(t)) byTaalkId.set(t, []);
    byTaalkId.get(t)!.push(l);
  });

  const dupTaalk = [...byTaalkId.entries()].filter(([, v]) => v!.length > 1);
  const idsToDelete: number[] = [];
  dupTaalk.forEach(([, rows]) => {
    const sorted = (rows || []).sort((a, b) => a.id - b.id);
    // keep lowest id, delete rest
    for (let i = 1; i < sorted.length; i++) {
      idsToDelete.push(sorted[i].id);
    }
  });

  if (idsToDelete.length === 0) return 0;

  console.log(`\n🗑️ Deleting ${idsToDelete.length} duplicate rows (associate ${associateId})...`);

  // Delete in batches (Supabase/PostgREST may limit in() size)
  const chunk = 500;
  let deleted = 0;
  for (let i = 0; i < idsToDelete.length; i += chunk) {
    const batchIds = idsToDelete.slice(i, i + chunk);
    const { error } = await supabaseAdmin
      .from('masterlead')
      .delete()
      .in('id', batchIds)
      .eq('associate_id', associateId);

    if (error) throw new Error(error.message);
    deleted += batchIds.length;
    console.log(`  Deleted ${deleted}/${idsToDelete.length}...`);
  }

  console.log(`✅ Associate ${associateId}: deleted ${deleted} rows\n`);
  return deleted;
}

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured');
    process.exit(1);
  }

  if (RUN_ALL) {
    const { data: ids } = await supabaseAdmin
      .from('customers')
      .select('associate_id')
      .not('associate_id', 'is', null);
    const unique = [...new Set((ids || []).map((r: any) => r.associate_id).filter((v: any) => v != null))].sort((a, b) => Number(a) - Number(b)) as number[];
    console.log(`\n🗑️ Deleting duplicate taalk_lead_id rows for ${unique.length} associates...\n`);
    let totalDeleted = 0;
    for (const aid of unique) {
      const n = typeof aid === 'number' ? aid : parseInt(String(aid), 10);
      if (!Number.isNaN(n)) totalDeleted += await deleteForAssociate(n);
    }
    console.log(`\n✅ TOTAL: Deleted ${totalDeleted} duplicate rows across all associates\n`);
  } else {
    await deleteForAssociate(ASSOCIATE_ID!);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
