/**
 * Verify lead lookup for recent inbound 609 calls.
 * For each recent call TO +16096048379, runs the SAME masterlead lookup as /incomingcall
 * (RPC get_masterlead_by_phone_last10 then ilike fallback) and reports whether we'd get
 * the right market/state/lead_id. Surfaces NO LEAD and Unknown/XX issues.
 *
 * Run: npx tsx server/scripts/verify-recent-609-lead-lookup.ts
 *      npx tsx server/scripts/verify-recent-609-lead-lookup.ts 20
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';
import { supabaseAdmin } from '../supabase';

const TO_609 = '+16096048379';
const LIMIT = parseInt(process.argv[2] || '15', 10);

type LeadRow = Record<string, unknown>;

async function fetchLeadForCaller(callerLast10: string): Promise<LeadRow | null> {
  if (!supabaseAdmin || callerLast10.length < 10) return null;
  try {
    const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc('get_masterlead_by_phone_last10', { last10: callerLast10 });
    if (!rpcErr && rpcRows && Array.isArray(rpcRows) && rpcRows.length > 0) {
      return rpcRows[0] as LeadRow;
    }
  } catch (_) {}
  const { data: leadRow } = await supabaseAdmin
    .from('masterlead')
    .select('id, state, taalk_state, taalk_market, first_name, last_name, taalk_lead_id, email, cn_email, city, taalk_city')
    .ilike('phone', `%${callerLast10}%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return leadRow ?? null;
}

function deriveMarketState(leadRow: LeadRow): { market: string; state: string } {
  let leadState = 'XX';
  let leadMarket = 'Unknown';
  const rawState = (leadRow.state ?? (leadRow as any)?.taalk_state) != null ? String(leadRow.state ?? (leadRow as any).taalk_state).trim() : '';
  if (rawState) leadState = rawState.length === 2 ? rawState.toUpperCase() : rawState;
  const rawMarket = ((leadRow as any)?.taalk_market ?? (leadRow as any)?.market) != null ? String((leadRow as any).taalk_market ?? (leadRow as any).market).trim() : '';
  if (rawMarket) leadMarket = rawMarket;
  return { market: leadMarket, state: leadState };
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  if (!supabaseAdmin) {
    console.error('Supabase admin not configured');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const calls = await client.calls.list({ to: TO_609, limit: LIMIT });

  console.log(`\n=== Lead lookup check: recent ${calls.length} calls TO ${TO_609} ===\n`);
  console.log('Same lookup as /incomingcall: RPC get_masterlead_by_phone_last10 → ilike fallback.\n');

  let ok = 0;
  let noLead = 0;
  let unknownXX = 0;

  for (const c of calls) {
    const from = (c.from || '').trim();
    const callerLast10 = from.replace(/\D/g, '').slice(-10);
    const start = c.startTime ? new Date(c.startTime).toISOString() : '—';
    const status = c.status ?? '—';

    if (callerLast10.length < 10) {
      console.log(`Call ${c.sid}  From: ${from}  (invalid phone)  — SKIP`);
      continue;
    }

    const leadRow = await fetchLeadForCaller(callerLast10);
    const marketState = leadRow ? deriveMarketState(leadRow) : { market: 'Unknown', state: 'XX' };
    const leadId = leadRow?.id != null ? String(leadRow.id) : null;
    const taalkId = (leadRow as any)?.taalk_lead_id ? String((leadRow as any).taalk_lead_id).trim() : null;

    let issue = '';
    if (!leadRow) {
      noLead++;
      issue = 'NO LEAD — no masterlead row for this phone (RPC + ilike)';
    } else if (marketState.market === 'Unknown' || marketState.state === 'XX') {
      unknownXX++;
      issue = `Unknown/XX — lead id=${leadId} has null/empty state or taalk_market in masterlead`;
    } else {
      ok++;
    }

    const name = leadRow && ((leadRow as any).first_name || (leadRow as any).last_name)
      ? [((leadRow as any).first_name ?? ''), ((leadRow as any).last_name ?? '')].filter(Boolean).join(' ').trim()
      : '—';
    console.log(`SID:    ${c.sid}`);
    console.log(`From:   ${from}  (last10: ${callerLast10})  ${start}  ${status}`);
    console.log(`Lead:   ${leadRow ? `id=${leadId}${taalkId ? ` taalk_lead_id=${taalkId}` : ''}  ${name}` : 'NONE'}`);
    console.log(`Route:  market=${marketState.market}  state=${marketState.state}`);
    if (issue) console.log(`>>> ${issue}`);
    console.log('');
  }

  console.log('--- Summary ---');
  console.log(`OK (lead found, market+state set): ${ok}`);
  console.log(`NO LEAD (no masterlead row):      ${noLead}`);
  console.log(`Unknown/XX (row exists, no data):  ${unknownXX}`);
  console.log('\nIf NO LEAD: ensure masterlead has a row for that phone; RPC get_masterlead_by_phone_last10 matches on normalized last-10 digits.');
  console.log('If Unknown/XX: fill state and taalk_market (or taalk_state) on that masterlead row.');
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
