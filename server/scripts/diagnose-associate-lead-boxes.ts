/**
 * Diagnose which lead boxes associate_id's leads show up in (raw DB vs canonical UI).
 * Matches frontend: normalizeLeadBox + canonicalLeadBox, callable = null/pending/new.
 *
 * Run: npx tsx server/scripts/diagnose-associate-lead-boxes.ts [associate_id]
 * Default associate_id: 409
 */

import { supabaseAdmin } from '../supabase';

const ASSOCIATE_ID = parseInt(process.argv[2] || '409', 10);
if (Number.isNaN(ASSOCIATE_ID)) {
  console.error('Usage: npx tsx server/scripts/diagnose-associate-lead-boxes.ts <associate_id>');
  process.exit(1);
}

function normalizeLeadBox(v: string | null | undefined): string {
  return (v || '').toLowerCase().replace(/[- ]/g, '').trim();
}

function canonicalLeadBox(normalized: string): string {
  if (!normalized) return '';
  if (normalized === 'listleadpool' || normalized === 'list') return 'list';
  if (normalized === 'lapseleadpool' || normalized === 'lapse' || normalized === 'lapsed') return 'lapse';
  if (normalized === 'intown') return 'intown';
  if (normalized === 'roadtrip') return 'roadtrip';
  return normalized;
}

function isCallableResolution(resolution: string | null | undefined): boolean {
  const r = String(resolution ?? '').toLowerCase().trim();
  return r === '' || r === 'pending' || r === 'new';
}

const BOX_LABELS: Record<string, string> = {
  intown: 'In Town',
  roadtrip: 'Road Trip',
  list: 'List Lead Pool',
  lapse: 'Lapse Lead Pool',
};

type LeadRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  cn_email: string | null;
  cnresolution: string | null;
  ao_lead_box: string | null;
  associate_id: number | null;
  priority_score: number | null;
  taalk_market: string | null;
  state: string | null;
  taalk_state: string | null;
};

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured');
    process.exit(1);
  }

  console.log(`\n🔍 Lead box diagnosis for associate_id = ${ASSOCIATE_ID}\n`);
  console.log('='.repeat(70));

  // Resolve emails for this associate
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('company_email, personal_email')
    .eq('associate_id', ASSOCIATE_ID)
    .limit(1)
    .maybeSingle();
  const emails = [customer?.company_email, customer?.personal_email].filter(Boolean) as string[];
  if (emails.length) {
    console.log(`   Emails: ${emails.join(', ')}\n`);
  }

  // Fetch by associate_id
  const { data: byAssociate, error: errAssoc } = await supabaseAdmin
    .from('masterlead')
    .select('id, first_name, last_name, cn_email, cnresolution, ao_lead_box, associate_id, priority_score, taalk_market, state, taalk_state')
    .eq('associate_id', ASSOCIATE_ID)
    .order('updated_at', { ascending: false })
    .limit(500);

  if (errAssoc) {
    console.error('❌ Error fetching by associate_id:', errAssoc.message);
    process.exit(1);
  }

  // Fetch by cn_email for each email
  let byEmail: LeadRow[] = [];
  for (const email of emails) {
    const { data: rows } = await supabaseAdmin
      .from('masterlead')
      .select('id, first_name, last_name, cn_email, cnresolution, ao_lead_box, associate_id, priority_score, taalk_market, state, taalk_state')
      .eq('cn_email', email)
      .order('updated_at', { ascending: false })
      .limit(500);
    if (rows?.length) byEmail = byEmail.concat(rows as LeadRow[]);
  }

  // Merge and dedupe (same as API)
  const seen = new Set<number>();
  const merged: LeadRow[] = [];
  for (const row of [...(byAssociate || []), ...byEmail]) {
    const id = Number(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(row as LeadRow);
  }

  // Exclude Plus leads for "My Leads" (match frontend)
  const myLeadsRelevant = merged.filter((lead) => {
    const market = (lead.taalk_market || '').toLowerCase();
    return !market.includes('plus');
  });

  // Callable = null/pending/new (match frontend)
  const callable = myLeadsRelevant.filter((lead) => isCallableResolution(lead.cnresolution));

  // Build per-lead: raw box, normalized, canonical, which UI box it shows in
  const rows: Array<{
    id: number;
    name: string;
    ao_lead_box_raw: string | null;
    normalized: string;
    canonical: string;
    uiBox: string;
    cnresolution: string | null;
    callable: boolean;
    inAll: boolean;
  }> = [];

  for (const lead of myLeadsRelevant) {
    const raw = lead.ao_lead_box ?? null;
    const norm = normalizeLeadBox(raw);
    const canon = canonicalLeadBox(norm);
    const call = isCallableResolution(lead.cnresolution);
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || `id=${lead.id}`;
    const uiBox = canon ? (BOX_LABELS[canon] ?? canon) : '(no box)';
    const inAll = !!raw && raw.trim() !== '';
    rows.push({
      id: lead.id,
      name,
      ao_lead_box_raw: raw,
      normalized: norm,
      canonical: canon,
      uiBox,
      cnresolution: lead.cnresolution,
      callable: call,
      inAll,
    });
  }

  // Summary by canonical box (what the UI shows)
  const byCanonicalAll = new Map<string, number>();
  const byCanonicalCallable = new Map<string, number>();
  for (const r of rows) {
    if (r.canonical) {
      byCanonicalAll.set(r.canonical, (byCanonicalAll.get(r.canonical) || 0) + 1);
      if (r.callable) byCanonicalCallable.set(r.canonical, (byCanonicalCallable.get(r.canonical) || 0) + 1);
    }
  }

  console.log('  By UI box (canonical)     | All (non-Plus) | Callable (null/pending/new)');
  console.log('  -------------------------|----------------|---------------------------');
  for (const [canon, label] of Object.entries(BOX_LABELS)) {
    const all = byCanonicalAll.get(canon) || 0;
    const call = byCanonicalCallable.get(canon) || 0;
    console.log(`  ${label.padEnd(24)} | ${String(all).padStart(14)} | ${call}`);
  }
  const noBoxAll = rows.filter((r) => !r.canonical).length;
  const noBoxCallable = rows.filter((r) => !r.canonical && r.callable).length;
  if (noBoxAll > 0) {
    console.log(`  (no ao_lead_box)          | ${String(noBoxAll).padStart(14)} | ${noBoxCallable}`);
  }
  console.log('  -------------------------|----------------|---------------------------');
  console.log(`  TOTAL                    | ${String(rows.length).padStart(14)} | ${callable.length}`);
  console.log('');

  // Raw ao_lead_box values in DB (so we can see "In Town" vs "intown" etc.)
  const rawValues = new Map<string, { count: number; callable: number }>();
  for (const r of rows) {
    const key = r.ao_lead_box_raw === null || r.ao_lead_box_raw === '' ? '(null/empty)' : r.ao_lead_box_raw;
    const cur = rawValues.get(key) || { count: 0, callable: 0 };
    cur.count++;
    if (r.callable) cur.callable++;
    rawValues.set(key, cur);
  }
  console.log('  Raw ao_lead_box in DB     | All            | Callable');
  console.log('  -------------------------|----------------|----------');
  for (const [raw, v] of Array.from(rawValues.entries()).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${raw.padEnd(24)} | ${String(v.count).padStart(14)} | ${v.callable}`);
  }
  console.log('');

  // Sample of first 15 leads with box mapping
  console.log('  Sample leads (first 15, non-Plus):');
  console.log('  id      | ao_lead_box (raw) | canonical | UI box         | resolution | callable?');
  console.log('  -------|-------------------|-----------|----------------|------------|----------');
  for (const r of rows.slice(0, 15)) {
    const raw = (r.ao_lead_box_raw ?? '(null)').toString().slice(0, 18).padEnd(18);
    const res = (r.cnresolution ?? '(null)').toString().slice(0, 10).padEnd(10);
    console.log(`  ${String(r.id).padStart(6)} | ${raw} | ${r.canonical.padEnd(9)} | ${r.uiBox.padEnd(14)} | ${res} | ${r.callable ? 'yes' : 'no'}`);
  }
  console.log('');
  console.log('  Callable = cnresolution is null, empty, "pending", or "new" (same as frontend).');
  console.log('  If a lead has ao_lead_box "In Town" it normalizes to intown → shows in "In Town" tab.');
  console.log('');

  // In Town callable: list states (FTC removes leads outside 8am-9pm in lead's timezone)
  const intownCallable = myLeadsRelevant.filter(
    (l) => canonicalLeadBox(normalizeLeadBox(l.ao_lead_box ?? '')) === 'intown' && isCallableResolution(l.cnresolution)
  );
  if (intownCallable.length > 0) {
    const stateCounts = new Map<string, number>();
    for (const l of intownCallable) {
      const st = (l.state || l.taalk_state || '(no state)').trim() || '(no state)';
      stateCounts.set(st, (stateCounts.get(st) || 0) + 1);
    }
    console.log('  In Town callable leads: state breakdown (FTC filters by 8am-9pm in lead timezone):');
    for (const [st, count] of Array.from(stateCounts.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${st}: ${count}`);
    }
    console.log('');
    console.log('  If In Town shows 0 in the app: (1) Log in as ' + (emails[0] || '?') + ' with profile associate_id 409.');
    console.log('  (2) FTC: leads are hidden when outside 8am-9pm in the lead\'s state timezone. Check current time for those states.');
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
