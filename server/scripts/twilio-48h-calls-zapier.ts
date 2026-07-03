/**
 * Find all Twilio calls in the last 48 hours over 45 seconds.
 * Resolve associate_id + taalk_lead_id for each call.
 * Optionally fire to Zapier webhook.
 *
 * Run (dry-run, just list):
 *   npx tsx server/scripts/twilio-48h-calls-zapier.ts
 *
 * Run (fire to Zapier):
 *   npx tsx server/scripts/twilio-48h-calls-zapier.ts --send
 */

import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import { supabaseAdmin } from '../supabase';

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/urpd14m/';
const MIN_DURATION_SEC = 45;
const HOURS_BACK = 48;

const SEND_TO_ZAPIER = process.argv.includes('--send');

function normalizePhone(p: string | null | undefined): string {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}

async function main() {
  console.log(`Fetching Twilio calls from last ${HOURS_BACK}h with duration > ${MIN_DURATION_SEC}s...`);
  if (SEND_TO_ZAPIER) {
    console.log(`🚀 --send flag detected: will POST to Zapier for each matched call`);
  } else {
    console.log(`ℹ️  Dry-run mode (no Zapier calls). Use --send to actually fire.`);
  }
  console.log('');

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const startDate = new Date(Date.now() - HOURS_BACK * 60 * 60 * 1000);
  const startTimeAfter = startDate.toISOString().slice(0, 10);

  const allCalls: any[] = [];
  let pageNum = 0;
  let startTimeBefore: string | undefined;

  while (true) {
    pageNum++;
    const opts: any = { limit: 1000, startTimeAfter };
    if (startTimeBefore) opts.startTimeBefore = startTimeBefore;
    const page = await client.calls.list(opts);
    if (page.length === 0) break;
    for (const c of page) allCalls.push(c);
    console.log(`Page ${pageNum}: ${page.length} calls (total: ${allCalls.length})`);
    if (page.length < 1000) break;
    const last = page[page.length - 1];
    const lastStart = last.startTime ?? (last as any).dateCreated;
    if (!lastStart) break;
    const d = new Date(lastStart);
    if (isNaN(d.getTime())) break;
    d.setSeconds(d.getSeconds() - 1);
    startTimeBefore = d.toISOString().slice(0, 19);
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nTotal calls fetched: ${allCalls.length}`);

  // Filter by duration > 45s and completed/in-progress status
  const longCalls = allCalls.filter((c) => {
    const dur = parseInt(String((c as any).duration ?? '0'), 10);
    return dur > MIN_DURATION_SEC;
  });

  console.log(`Calls over ${MIN_DURATION_SEC}s: ${longCalls.length}\n`);

  if (longCalls.length === 0) {
    console.log('No qualifying calls found.');
    return;
  }

  // Extract unique "to" phone numbers (the lead's number)
  const toNumbers = [...new Set(longCalls.map((c) => normalizePhone((c as any).to)).filter((p) => p.length >= 10))];
  console.log(`Unique lead phone numbers: ${toNumbers.length}`);

  // Lookup taalk_lead_id from masterlead by phone
  const taalkLeadByPhone = new Map<string, string>();
  const cnEmailByPhone = new Map<string, string>();

  if (supabaseAdmin && toNumbers.length > 0) {
    // First: use RPC to get cn_email (fast, indexed)
    try {
      const { data: mlRows, error: rpcErr } = await supabaseAdmin.rpc('get_masterlead_cn_email_by_phones', {
        phone_arr: toNumbers.slice(0, 500),
      });
      if (rpcErr) throw rpcErr;
      for (const row of (mlRows || [])) {
        const norm = String(row?.norm_phone || '').replace(/\D/g, '').slice(-10);
        if (norm.length >= 10) {
          if (row.cn_email && !cnEmailByPhone.has(norm)) cnEmailByPhone.set(norm, row.cn_email);
        }
      }
      console.log(`Resolved ${cnEmailByPhone.size} cn_email(s) via RPC`);
    } catch (rpcEx) {
      console.warn('⚠️ RPC failed:', (rpcEx as Error).message);
    }

    // Second: get taalk_lead_id via batched IN queries (try exact 10-digit and E164 formats)
    // Build phone variants to try
    const phoneVariants: string[] = [];
    for (const p of toNumbers) {
      phoneVariants.push(p); // 10-digit
      phoneVariants.push('+1' + p); // E164
      phoneVariants.push('1' + p); // 11-digit
    }

    const CHUNK = 30;
    for (let i = 0; i < toNumbers.length; i += CHUNK) {
      const chunk = toNumbers.slice(i, i + CHUNK);
      const varChunk = chunk.flatMap((p) => [p, '+1' + p, '1' + p]);
      const { data: mlRows } = await supabaseAdmin
        .from('masterlead')
        .select('phone, taalk_lead_id, cn_email')
        .in('phone', varChunk)
        .not('taalk_lead_id', 'is', null)
        .limit(300);
      for (const row of (mlRows || [])) {
        const norm = normalizePhone(row.phone);
        if (norm.length >= 10 && row.taalk_lead_id && !taalkLeadByPhone.has(norm)) {
          taalkLeadByPhone.set(norm, String(row.taalk_lead_id));
          if (row.cn_email && !cnEmailByPhone.has(norm)) cnEmailByPhone.set(norm, row.cn_email);
        }
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    console.log(`Resolved ${taalkLeadByPhone.size} taalk_lead_id(s) via batched IN`);
  }

  // Lookup associate_id from customers table by cn_email
  const associateIdByEmail = new Map<string, number>();
  const emails = [...new Set([...cnEmailByPhone.values()].filter(Boolean))];

  if (supabaseAdmin && emails.length > 0) {
    const { data: custRows, error: custErr } = await supabaseAdmin
      .from('customers')
      .select('company_email, associate_id')
      .in('company_email', emails.slice(0, 300));

    if (!custErr) {
      for (const c of (custRows || [])) {
        if (c.company_email && c.associate_id != null) {
          associateIdByEmail.set(c.company_email.toLowerCase(), c.associate_id);
        }
      }
    }

    // Fallback: producerlist
    const missingEmails = emails.filter((e) => !associateIdByEmail.has(e.toLowerCase()));
    if (missingEmails.length > 0) {
      const { data: plRows } = await supabaseAdmin
        .from('producerlist')
        .select('company_email, associate_id')
        .in('company_email', missingEmails.slice(0, 300));

      for (const p of (plRows || [])) {
        if (p.company_email && p.associate_id != null && !associateIdByEmail.has(p.company_email.toLowerCase())) {
          associateIdByEmail.set(p.company_email.toLowerCase(), p.associate_id);
        }
      }
    }

    console.log(`Resolved ${associateIdByEmail.size} associate_id(s) from customers/producerlist`);
  }

  // --- Pair outbound-dial calls with their inbound counterpart to extract agent email ---
  // For calls where we have taalk_lead_id but no cn_email, we can get the agent
  // from the paired inbound call: from = "client:agentname@aoglobelife.com"
  // Pair by: same start_time (within 3s) AND same duration (within 30s)

  const agentEmailFromClient = (from: string): string | null => {
    const m = String(from || '').match(/^client:(.+@aoglobelife\.com)$/i);
    return m ? m[1].toLowerCase() : null;
  };

  // Build lookup: startTime (floored to minute) + leadPhone -> agent email
  // Index outbound dials by lead_phone + approx start time
  const outboundByPhone = new Map<string, { sid: string; startMs: number; dur: number }[]>();
  const inboundByTime = new Map<string, { sid: string; startMs: number; dur: number; agentEmail: string | null }[]>();

  for (const c of longCalls) {
    const dir = String((c as any).direction ?? '');
    const st = new Date(String((c as any).startTime ?? (c as any).dateCreated ?? '')).getTime();
    const dur = parseInt(String((c as any).duration ?? '0'), 10);
    if (isNaN(st)) continue;
    if (dir === 'outbound-dial') {
      const p = normalizePhone(String((c as any).to ?? ''));
      if (p.length >= 10) {
        if (!outboundByPhone.has(p)) outboundByPhone.set(p, []);
        outboundByPhone.get(p)!.push({ sid: (c as any).sid, startMs: st, dur });
      }
    } else if (dir === 'inbound') {
      const agentEmail = agentEmailFromClient(String((c as any).from ?? ''));
      const timeKey = Math.floor(st / 60000).toString(); // floor to minute
      if (!inboundByTime.has(timeKey)) inboundByTime.set(timeKey, []);
      inboundByTime.get(timeKey)!.push({ sid: (c as any).sid, startMs: st, dur, agentEmail });
    }
  }

  // For each outbound, find the inbound that started within ±5s and has matching duration ±30s
  const agentEmailBySid = new Map<string, string>(); // outbound sid -> agent email
  for (const [phone, outbounds] of outboundByPhone) {
    for (const ob of outbounds) {
      const timeKey = Math.floor(ob.startMs / 60000).toString();
      const candidates = [
        ...(inboundByTime.get(timeKey) ?? []),
        ...(inboundByTime.get(String(parseInt(timeKey) - 1)) ?? []),
        ...(inboundByTime.get(String(parseInt(timeKey) + 1)) ?? []),
      ];
      const match = candidates.find((ib) =>
        Math.abs(ib.startMs - ob.startMs) <= 5000 && Math.abs(ib.dur - ob.dur) <= 30 && ib.agentEmail
      );
      if (match?.agentEmail) agentEmailBySid.set(ob.sid, match.agentEmail);
    }
  }

  // Resolve associate_ids for newly discovered agent emails
  const newEmails = [...new Set([...agentEmailBySid.values()])].filter(
    (e) => !associateIdByEmail.has(e.toLowerCase())
  );
  if (supabaseAdmin && newEmails.length > 0) {
    const { data: custRows2 } = await supabaseAdmin
      .from('customers')
      .select('company_email, associate_id')
      .in('company_email', newEmails.slice(0, 300));
    for (const c of (custRows2 || [])) {
      if (c.company_email && c.associate_id != null)
        associateIdByEmail.set(c.company_email.toLowerCase(), c.associate_id);
    }
    const stillMissing = newEmails.filter((e) => !associateIdByEmail.has(e.toLowerCase()));
    if (stillMissing.length > 0) {
      const { data: plRows2 } = await supabaseAdmin
        .from('producerlist')
        .select('company_email, associate_id')
        .in('company_email', stillMissing.slice(0, 300));
      for (const p of (plRows2 || [])) {
        if (p.company_email && p.associate_id != null && !associateIdByEmail.has(p.company_email.toLowerCase()))
          associateIdByEmail.set(p.company_email.toLowerCase(), p.associate_id);
      }
    }
    console.log(`Resolved ${associateIdByEmail.size} total associate_ids (after pairing)`);
  }

  // --- Final fallback: agent_dial_metrics reverse lookup by lead phone ---
  // For any outbound call that still has taalk_lead_id but no agent email resolved,
  // look up the most recent agent who called that phone in agent_dial_metrics.
  const stillMissingPhones = longCalls
    .filter((c) => (c as any).direction === 'outbound-dial')
    .map((c) => ({ sid: (c as any).sid, phone: normalizePhone(String((c as any).to ?? '')) }))
    .filter(({ phone, sid }) => {
      const hasLead = taalkLeadByPhone.has(phone);
      const hasCn = cnEmailByPhone.has(phone);
      const hasPaired = agentEmailBySid.has(sid);
      return hasLead && !hasCn && !hasPaired;
    });

  const admPhones = [...new Set(stillMissingPhones.map((x) => x.phone))];
  const admAgentByPhone = new Map<string, string>();

  if (supabaseAdmin && admPhones.length > 0) {
    try {
      const { data: admRows } = await supabaseAdmin.rpc('get_agent_dial_metrics_by_phones', {
        phone_arr: admPhones.slice(0, 500),
      });
      for (const row of (admRows || [])) {
        const norm = String(row?.norm_phone || '').replace(/\D/g, '').slice(-10);
        const email = String(row?.agent_email || '').toLowerCase().trim();
        if (norm.length >= 10 && email.includes('@') && !admAgentByPhone.has(norm))
          admAgentByPhone.set(norm, email);
      }
    } catch {
      // RPC may not exist; try ilike fallback
      const orClause = admPhones.map((p) => `lead_phone.ilike.%${p}`).join(',');
      const { data: admRows } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('lead_phone, agent_email, event_timestamp')
        .or(orClause)
        .order('event_timestamp', { ascending: false })
        .limit(admPhones.length * 3);
      for (const row of (admRows || [])) {
        const norm = normalizePhone(row.lead_phone);
        const email = String(row.agent_email || '').toLowerCase().trim();
        if (norm.length >= 10 && email.includes('@') && !admAgentByPhone.has(norm))
          admAgentByPhone.set(norm, email);
      }
    }

    // Resolve any new associate_ids from newly found emails
    const admEmails = [...new Set(admAgentByPhone.values())].filter((e) => !associateIdByEmail.has(e));
    if (admEmails.length > 0) {
      const { data: custRows3 } = await supabaseAdmin
        .from('customers')
        .select('company_email, associate_id')
        .in('company_email', admEmails.slice(0, 300));
      for (const c of (custRows3 || [])) {
        if (c.company_email && c.associate_id != null)
          associateIdByEmail.set(c.company_email.toLowerCase(), c.associate_id);
      }
    }
    console.log(`ADM fallback resolved ${admAgentByPhone.size} additional agent emails`);
  }

  // Build results
  type CallResult = {
    call_sid: string;
    direction: string;
    from: string;
    to: string;
    duration_sec: number;
    status: string;
    start_time: string;
    lead_phone: string;
    taalk_lead_id: string | null;
    cn_email: string | null;
    associate_id: number | null;
    zapier_sent?: boolean;
    zapier_status?: number;
  };

  const results: CallResult[] = [];

  for (const c of longCalls) {
    const toRaw = String((c as any).to ?? '');
    const leadPhone = normalizePhone(toRaw);
    const taalkLeadId = taalkLeadByPhone.get(leadPhone) ?? null;
    const cnEmailFromMasterlead = cnEmailByPhone.get(leadPhone) ?? null;
    // Fallback: use paired inbound agent email
    const cnEmailFromPairing = (c as any).direction === 'outbound-dial' ? (agentEmailBySid.get((c as any).sid) ?? null) : null;
    const cnEmailFromAdm = (c as any).direction === 'outbound-dial' ? (admAgentByPhone.get(leadPhone) ?? null) : null;
    const cnEmail = cnEmailFromMasterlead ?? cnEmailFromPairing ?? cnEmailFromAdm;
    const associateId = cnEmail ? (associateIdByEmail.get(cnEmail.toLowerCase()) ?? null) : null;

    results.push({
      call_sid: (c as any).sid,
      direction: (c as any).direction ?? '',
      from: String((c as any).from ?? ''),
      to: toRaw,
      duration_sec: parseInt(String((c as any).duration ?? '0'), 10),
      status: (c as any).status ?? '',
      start_time: String((c as any).startTime ?? (c as any).dateCreated ?? ''),
      lead_phone: leadPhone,
      taalk_lead_id: taalkLeadId,
      cn_email: cnEmail,
      associate_id: associateId,
    });
  }

  // Print table
  console.log('\n--- Results ---');
  console.log(`${'call_sid'.padEnd(38)} ${'dur'.padEnd(6)} ${'lead_phone'.padEnd(14)} ${'taalk_lead_id'.padEnd(16)} ${'associate_id'.padEnd(14)} ${'cn_email'}`);
  console.log('-'.repeat(130));

  for (const r of results) {
    console.log(
      `${r.call_sid.padEnd(38)} ${String(r.duration_sec).padEnd(6)} ${r.lead_phone.padEnd(14)} ${(r.taalk_lead_id ?? '—').padEnd(16)} ${String(r.associate_id ?? '—').padEnd(14)} ${r.cn_email ?? '—'}`
    );
  }

  const matched = results.filter((r) => r.taalk_lead_id && r.associate_id != null);
  const unmatched = results.filter((r) => !r.taalk_lead_id || r.associate_id == null);

  console.log(`\n✅ ${matched.length} calls matched (have both taalk_lead_id + associate_id)`);
  console.log(`⚠️  ${unmatched.length} calls missing taalk_lead_id or associate_id`);

  if (SEND_TO_ZAPIER && matched.length > 0) {
    console.log('\n🚀 Sending to Zapier...');
    for (const r of matched) {
      const payload = {
        lead_id: String(r.taalk_lead_id),
        associate_id: r.associate_id,
      };
      try {
        const res = await fetch(ZAPIER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        r.zapier_sent = true;
        r.zapier_status = res.status;
        console.log(`  ${r.call_sid} → lead_id=${r.taalk_lead_id} associate_id=${r.associate_id} → ${res.ok ? '✅' : '❌'} (${res.status})`);
      } catch (err) {
        r.zapier_sent = false;
        console.log(`  ${r.call_sid} → ❌ fetch error: ${(err as Error).message}`);
      }
      await new Promise((res) => setTimeout(res, 100)); // slight throttle
    }
    console.log('\nZapier sends complete.');
  }

  // Summary JSON
  console.log('\n--- Full JSON ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
