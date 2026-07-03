/**
 * Find leads in masterlead by name, then send taalk_lead_id + associate_id to Zapier
 * (so the leads get transferred to the given agent in Taalk/Studio).
 *
 * Usage: npx tsx server/scripts/transfer-leads-to-agent-zapier.ts
 *
 * Agent: DENNLEYVENSYRYU SAPINI, associate_id 227398, dennleyvensyryussapini@aoglobelife.com
 * Leads to find: Franklin Deese, Ramon Perez, Rusty Habel, Mary Eleazer
 */

import { supabaseAdmin } from '../supabase';

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

const AGENT_ASSOCIATE_ID = 227398;
const AGENT_EMAIL = 'dennleyvensyryussapini@aoglobelife.com';

const LEAD_NAMES: { first: string; last: string }[] = [
  { first: 'Franklin', last: 'Deese' },
  { first: 'Ramon', last: 'Perez' },
  { first: 'Rusty', last: 'Habel' },
  { first: 'Mary', last: 'Eleazer' },
];

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not initialized');
    process.exit(1);
  }

  console.log('Agent:', AGENT_EMAIL, '| associate_id:', AGENT_ASSOCIATE_ID);
  console.log('Zapier URL:', ZAPIER_WEBHOOK_URL);
  console.log('');

  const results: { name: string; found: boolean; id?: number; taalk_lead_id?: string; zapierOk?: boolean; error?: string }[] = [];

  for (const { first, last } of LEAD_NAMES) {
    const nameStr = `${first} ${last}`;
    console.log(`--- ${nameStr} ---`);

    const { data: rows, error } = await supabaseAdmin
      .from('masterlead')
      .select('id, taalk_lead_id, first_name, last_name, phone')
      .ilike('first_name', first)
      .ilike('last_name', last)
      .limit(5);

    if (error) {
      console.log('  ❌ Query error:', error.message);
      results.push({ name: nameStr, found: false, error: error.message });
      continue;
    }

    if (!rows?.length) {
      // Try alternate: last name only (in case first/last stored differently)
      const { data: alt } = await supabaseAdmin
        .from('masterlead')
        .select('id, taalk_lead_id, first_name, last_name, phone')
        .ilike('last_name', `%${last}%`)
        .limit(5);
      const use = alt?.length ? alt : rows;
      if (!use?.length) {
        console.log('  ❌ Not found in masterlead');
        results.push({ name: nameStr, found: false });
        continue;
      }
      // Use first match if we used alt
      const lead = use[0];
      if (!lead.taalk_lead_id) {
        console.log('  ❌ Found id=', lead.id, 'but no taalk_lead_id');
        results.push({ name: nameStr, found: true, id: lead.id, error: 'no taalk_lead_id' });
        continue;
      }
      const payload = { lead_id: String(lead.taalk_lead_id), associate_id: AGENT_ASSOCIATE_ID };
      const res = await fetch(ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('  id:', lead.id, '| taalk_lead_id:', lead.taalk_lead_id, '| Zapier:', res.ok ? '✅' : res.status);
      results.push({ name: nameStr, found: true, id: lead.id, taalk_lead_id: lead.taalk_lead_id, zapierOk: res.ok });
      continue;
    }

    const lead = rows[0];
    if (!lead.taalk_lead_id) {
      console.log('  ❌ Found id=', lead.id, 'but no taalk_lead_id');
      results.push({ name: nameStr, found: true, id: lead.id, error: 'no taalk_lead_id' });
      continue;
    }

    const payload = { lead_id: String(lead.taalk_lead_id), associate_id: AGENT_ASSOCIATE_ID };
    const res = await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log('  id:', lead.id, '| taalk_lead_id:', lead.taalk_lead_id, '| Zapier:', res.ok ? '✅' : res.status);
    results.push({ name: nameStr, found: true, id: lead.id, taalk_lead_id: lead.taalk_lead_id, zapierOk: res.ok });
  }

  console.log('');
  console.log('--- Summary ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
