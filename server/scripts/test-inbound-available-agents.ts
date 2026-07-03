/**
 * Test who would be eligible (and optionally who would actually be rang) for an inbound call
 * given a caller phone number. Uses same masterlead + market/state + agent_profiles/customers logic as the webhook.
 *
 * Run: npx tsx server/scripts/test-inbound-available-agents.ts <phone> [--server BASE_URL]
 *
 * Examples:
 *   npx tsx server/scripts/test-inbound-available-agents.ts +15032018470
 *   npx tsx server/scripts/test-inbound-available-agents.ts 5032018470 --server http://localhost:3000
 */

import { supabaseAdmin } from '../supabase';

function parseArrayField(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item): item is string => typeof item === 'string')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      } catch {
        // fall through
      }
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

async function runStandalone(phone: string) {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not available');
    process.exit(1);
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const last10 = cleanPhone.slice(-10);
  if (last10.length < 10) {
    console.error('Phone must have at least 10 digits:', phone);
    process.exit(1);
  }

  // Same lookup as webhook: who would get this call? (cn_email from masterlead)
  const { data: assignedRows, error: assignedError } = await supabaseAdmin
    .from('masterlead')
    .select('id, first_name, last_name, phone, state, taalk_market, cn_email')
    .ilike('phone', `%${last10}%`)
    .not('cn_email', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (assignedError) {
    console.error('masterlead lookup error:', assignedError.message);
    process.exit(1);
  }

  const assignedAgent = assignedRows?.[0];
  if (assignedAgent?.cn_email) {
    const name = [assignedAgent.first_name, assignedAgent.last_name].filter(Boolean).join(' ') || 'Unknown';
    console.log('--- Who would get this call (inbound routing) ---');
    console.log('Caller phone:', phone, '(last 10:', last10 + ')');
    console.log('Lead name (masterlead):', name);
    console.log('Agent who would get the call (cn_email):', assignedAgent.cn_email);
    console.log('');
  } else {
    console.log('No masterlead row with cn_email for phone', phone, '→ inbound would ring default agents (e.g. diankablash, chrislafond).');
    console.log('');
  }

  const { data: leadRows, error: leadError } = await supabaseAdmin
    .from('masterlead')
    .select('id, first_name, last_name, phone, state, taalk_market')
    .ilike('phone', `%${last10}%`)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (leadError || !leadRows?.length) {
    console.log('No lead found in masterlead for phone:', phone);
    process.exit(0);
  }

  const row = leadRows[0];
  const leadName = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown';
  const leadMarket = (row.taalk_market || 'Unknown').trim();
  const leadStateRaw = (row.state || 'Unknown').trim();
  const leadState = leadStateRaw.length === 2 ? leadStateRaw.toUpperCase() : leadStateRaw;

  const eligibleEmails = new Set<string>();

  const { data: activeProfiles } = await supabaseAdmin
    .from('agent_profiles')
    .select('email, license_states, authorized_markets')
    .eq('is_active', true);

  for (const a of activeProfiles || []) {
    const states = (Array.isArray(a.license_states) ? a.license_states : []).map((s: string) => String(s).trim().toUpperCase());
    const markets = (Array.isArray(a.authorized_markets) ? a.authorized_markets : []).map((m: string) => String(m).trim());
    const stateMatch = states.includes(leadState) || states.some((s: string) => s.includes(leadState) || leadState.includes(s));
    const marketMatch = markets.some((m: string) => m.toLowerCase().includes(leadMarket.toLowerCase()) || leadMarket.toLowerCase().includes(m.toLowerCase()));
    if (stateMatch && marketMatch && a.email) eligibleEmails.add(String(a.email).toLowerCase().trim());
  }

  const { data: customers } = await supabaseAdmin
    .from('customers')
    .select('company_email, personal_email, market, states');

  for (const c of customers || []) {
    const states = parseArrayField(c.states).map((s) => s.trim().toUpperCase()).filter(Boolean);
    const markets = parseArrayField(c.market).map((m) => m.trim()).filter(Boolean);
    const stateMatch = states.includes(leadState) || states.some((s: string) => s.includes(leadState) || leadState.includes(s));
    const marketMatch = markets.some((m: string) => m.toLowerCase().includes(leadMarket.toLowerCase()) || leadMarket.toLowerCase().includes(m.toLowerCase()));
    if (stateMatch && marketMatch) {
      // Only company_email — that's the login identity; Twilio Device is registered with company email, not personal (yahoo/gmail)
      if (c.company_email) eligibleEmails.add(String(c.company_email).toLowerCase().trim());
    }
  }

  const eligibleByDb = Array.from(eligibleEmails).sort();

  console.log('Lead:', leadName);
  console.log('Phone:', row.phone || phone);
  console.log('State:', leadState);
  console.log('Market:', leadMarket);
  console.log('Eligible by DB (market+state):', eligibleByDb.length);
  eligibleByDb.forEach((e) => console.log('  -', e));
  console.log('\nTo see who is actually online (WebRTC) and not on a call, run the app and use: --server http://localhost:PORT');
}

async function runWithServer(phone: string, baseUrl: string, userEmail?: string) {
  let url = `${baseUrl.replace(/\/$/, '')}/api/inbound-test-available-agents?phone=${encodeURIComponent(phone)}`;
  if (userEmail) url += `&userEmail=${encodeURIComponent(userEmail)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (userEmail) headers['X-User-Email'] = userEmail;
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    console.error('API error:', res.status, res.statusText);
    const text = await res.text();
    if (text) console.error(text);
    process.exit(1);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const serverIdx = args.indexOf('--server');
  const emailIdx = args.indexOf('--email');
  const serverUrl = serverIdx >= 0 ? args[serverIdx + 1] : null;
  const userEmail = emailIdx >= 0 ? args[emailIdx + 1] : undefined;
  const filtered = args.filter((a, i) => {
    if (a === '--server' || a === '--email') return false;
    if (serverIdx >= 0 && i === serverIdx + 1) return false;
    if (emailIdx >= 0 && i === emailIdx + 1) return false;
    return true;
  });
  const phoneArg = filtered[0];

  if (!phoneArg) {
    console.error('Usage: npx tsx server/scripts/test-inbound-available-agents.ts <phone> [--server BASE_URL] [--email USER_EMAIL]');
    process.exit(1);
  }

  if (serverUrl) {
    if (!userEmail) console.warn('Tip: API requires auth; pass --email user@example.com if you get 401.');
    await runWithServer(phoneArg, serverUrl, userEmail);
  } else {
    await runStandalone(phoneArg);
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
