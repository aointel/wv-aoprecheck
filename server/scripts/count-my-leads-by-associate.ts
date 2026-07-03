/**
 * Count My Leads queue sizes for an associate_id (e.g. 409).
 * Matches what /api/outbound-dialer/leads returns: leads by associate_id (and cn_email),
 * then client filters by ao_lead_box (In Town, Road Trip, List, Lapse).
 *
 * Run: tsx server/scripts/count-my-leads-by-associate.ts 409
 * Run with FTC filter (matches API/UI): tsx server/scripts/count-my-leads-by-associate.ts 409 --ftcFilter
 */

import { supabaseAdmin } from '../supabase';
import { isCallPermissible } from '../ftc-compliance';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const ftcFilter = process.argv.includes('--ftcFilter');
const ASSOCIATE_ID = parseInt(args[0] || '409', 10);
if (Number.isNaN(ASSOCIATE_ID)) {
  console.error('Usage: tsx server/scripts/count-my-leads-by-associate.ts <associate_id> [--ftcFilter]');
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

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured');
    process.exit(1);
  }

  console.log(`\n📊 My Leads queue counts for associate_id = ${ASSOCIATE_ID}\n`);
  console.log('='.repeat(60));

  // 1) Resolve email(s) for this associate (for reference)
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('company_email, personal_email')
    .eq('associate_id', ASSOCIATE_ID)
    .limit(1)
    .maybeSingle();
  const emails = [customer?.company_email, customer?.personal_email].filter(Boolean) as string[];
  if (emails.length) {
    console.log(`   Emails for associate ${ASSOCIATE_ID}: ${emails.join(', ')}\n`);
  }

  // 2) All leads for this associate (by associate_id only; API also merges cn_email)
  // NOTE: ftcrestricted/FTCRESTRICTED omitted - column may not exist in all deployments
  const { data: byAssociate, error: errAssoc } = await supabaseAdmin
    .from('masterlead')
    .select('id, cnresolution, ao_lead_box, dnc, TaalkResolve, state, taalk_state')
    .eq('associate_id', ASSOCIATE_ID);

  if (errAssoc) {
    console.error('❌ Error fetching by associate_id:', errAssoc.message);
    process.exit(1);
  }

  // Associate_id only - match API (no cn_email merge)
  const merged = byAssociate || [];

  // Callable = pending or new, not DNC, TaalkResolve not true (matches API baseLeadFilter)
  let callable = merged.filter((r) => {
    const res = (r.cnresolution || '').toLowerCase();
    if (res !== 'pending' && res !== 'new') return false;
    if (r.dnc === true) return false;
    if (r.TaalkResolve === true || (r as any).TaalkResolve === 'true') return false;
    return true;
  });

  // Optional FTC filter: match API - only count leads within 8am-9pm in lead's timezone
  // (ftcrestricted column not selected - use isCallPermissible from state/timezone)
  if (ftcFilter) {
    const ftcFilterLead = (lead: any): boolean => {
      const leadState = lead.state || lead.taalk_state;
      if (!leadState) return true;
      return isCallPermissible(leadState);
    };
    callable = callable.filter(ftcFilterLead);
    console.log(`   (--ftcFilter: showing FTC-compliant counts only)\n`);
  }

  // Count by ao_lead_box (raw value); then group by normalized queue name
  const byBox = new Map<string, number>();
  const byBoxCallable = new Map<string, number>();
  const emptyBox: string[] = [];
  const emptyBoxCallable: string[] = [];

  for (const lead of merged) {
    const box = lead.ao_lead_box ?? '';
    const norm = normalizeLeadBox(box);
    const canon = canonicalLeadBox(norm);
    if (!canon) {
      emptyBox.push(String(lead.id));
    } else {
      byBox.set(canon, (byBox.get(canon) || 0) + 1);
    }
  }
  for (const lead of callable) {
    const box = lead.ao_lead_box ?? '';
    const norm = normalizeLeadBox(box);
    const canon = canonicalLeadBox(norm);
    if (!canon) {
      emptyBoxCallable.push(String(lead.id));
    } else {
      byBoxCallable.set(canon, (byBoxCallable.get(canon) || 0) + 1);
    }
  }

  // Map normalized names to display names (match UI)
  const queueLabels: Record<string, string> = {
    intown: 'In Town',
    roadtrip: 'Road Trip',
    list: 'List Lead Pool',
    lapse: 'Lapse Lead Pool',
  };

  console.log('  Queue (My Leads)     | All leads | Callable (pending/new)');
  console.log('  ---------------------|-----------|------------------------');
  const totalAll = merged.length;
  const totalCallable = callable.length;

  for (const [norm, label] of Object.entries(queueLabels)) {
    const all = byBox.get(norm) || 0;
    const call = byBoxCallable.get(norm) || 0;
    console.log(`  ${label.padEnd(20)} | ${String(all).padStart(9)} | ${call}`);
  }

  // Any other ao_lead_box values in DB
  const allNorms = new Set([...byBox.keys(), ...byBoxCallable.keys()]);
  for (const norm of allNorms) {
    if (queueLabels[norm]) continue;
    const all = byBox.get(norm) || 0;
    const call = byBoxCallable.get(norm) || 0;
    console.log(`  ${norm.padEnd(20)} | ${String(all).padStart(9)} | ${call}`);
  }

  const noBoxAll = emptyBox.length;
  const noBoxCallable = emptyBoxCallable.length;
  if (noBoxAll > 0) {
    console.log(`  (no ao_lead_box)     | ${String(noBoxAll).padStart(9)} | ${noBoxCallable}`);
  }

  console.log('  ---------------------|-----------|------------------------');
  console.log(`  TOTAL                | ${String(totalAll).padStart(9)} | ${totalCallable}`);
  console.log('');
  console.log('  Callable = cnresolution in (pending, new), dnc=false, TaalkResolve != true');
  if (ftcFilter) {
    console.log('  + FTC filter: only leads within 8am-9pm in lead\'s timezone (matches API/UI)');
  }
  console.log('  These are the counts that should appear in each My Leads queue in the app.');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
