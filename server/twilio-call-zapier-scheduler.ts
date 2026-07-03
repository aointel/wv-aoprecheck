/**
 * twilio-call-zapier-scheduler.ts
 *
 * Every 5 minutes: pull Twilio calls from the last 10 minutes over 45 seconds,
 * resolve associate_id + taalk_lead_id, and POST to Zapier.
 *
 * Uses a watermark (last run time) so each run only processes NEW calls.
 * Deduplicates by call_sid so nothing gets double-sent.
 */

import * as cron from 'node-cron';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './hardcoded-config.js';
import { supabaseAdmin } from './supabase';

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/urpd14m/';
const MIN_DURATION_SEC = 45;
const LOOKBACK_MS = 12 * 60 * 1000; // 12 min lookback (slightly more than 5 to avoid gaps)

const BAD_EMAILS = ['unknown@aoglobelife.com', 'system@aoglobelife.com', 'cnsysop@aoglobelife.com'];
const JOB_WEBHOOKS_ENABLED = String(process.env.ENABLE_ZAPIER_JOB_WEBHOOKS || '').toLowerCase() === 'true';

// Track call_sids we've already sent to avoid duplicates across runs
const sentSids = new Set<string>();

// Last run watermark
let lastRunAt: Date = new Date(Date.now() - LOOKBACK_MS);

function normalizePhone(p: string | null | undefined): string {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}

function agentEmailFromClient(from: string): string | null {
  const m = String(from || '').match(/^client:(.+@aoglobelife\.com)$/i);
  return m ? m[1].toLowerCase() : null;
}

function isBadEmail(e: string): boolean {
  return BAD_EMAILS.includes(e.toLowerCase());
}

async function runSync(): Promise<void> {
  if (!JOB_WEBHOOKS_ENABLED) {
    console.log('[ZapierSync] Job webhook sender disabled (ENABLE_ZAPIER_JOB_WEBHOOKS!=true)');
    return;
  }
  const sinceDate = lastRunAt;
  const nowDate = new Date();
  lastRunAt = nowDate;

  const startTimeAfter = sinceDate.toISOString().slice(0, 19);

  console.log(`[ZapierSync] Checking Twilio calls since ${startTimeAfter}...`);

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('[ZapierSync] Missing Twilio credentials');
    return;
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  // Fetch all calls in the window
  let allCalls: any[] = [];
  try {
    const page = await client.calls.list({ limit: 1000, startTimeAfter });
    allCalls = page;
  } catch (err) {
    console.error('[ZapierSync] Twilio fetch error:', (err as Error).message);
    return;
  }

  // Filter: outbound-dial, over 45s, not already sent
  const newCalls = allCalls.filter((c) => {
    const dur = parseInt(String((c as any).duration ?? '0'), 10);
    return (
      (c as any).direction === 'outbound-dial' &&
      dur > MIN_DURATION_SEC &&
      !sentSids.has((c as any).sid)
    );
  });

  if (newCalls.length === 0) {
    console.log('[ZapierSync] No new qualifying calls.');
    return;
  }

  console.log(`[ZapierSync] ${newCalls.length} new calls to process.`);

  if (!supabaseAdmin) {
    console.error('[ZapierSync] Supabase not initialized');
    return;
  }

  // Extract lead phones
  const toNumbers = [...new Set(newCalls.map((c) => normalizePhone(String((c as any).to ?? ''))))].filter(
    (p) => p.length >= 10
  );

  // --- Lookup taalk_lead_id + cn_email from masterlead ---
  const taalkLeadByPhone = new Map<string, string>();
  const cnEmailByPhone = new Map<string, string>();

  // RPC for cn_email
  try {
    const { data } = await supabaseAdmin.rpc('get_masterlead_cn_email_by_phones', {
      phone_arr: toNumbers.slice(0, 500),
    });
    for (const row of (data || [])) {
      const norm = String(row?.norm_phone || '').replace(/\D/g, '').slice(-10);
      if (norm.length >= 10 && row.cn_email && !isBadEmail(row.cn_email))
        cnEmailByPhone.set(norm, row.cn_email.toLowerCase());
    }
  } catch { /* RPC may not exist */ }

  // Batched IN for taalk_lead_id
  const CHUNK = 30;
  for (let i = 0; i < toNumbers.length; i += CHUNK) {
    const chunk = toNumbers.slice(i, i + CHUNK);
    const variants = chunk.flatMap((p) => [p, '+1' + p, '1' + p]);
    const { data } = await supabaseAdmin
      .from('masterlead')
      .select('phone, taalk_lead_id, cn_email')
      .in('phone', variants)
      .not('taalk_lead_id', 'is', null)
      .limit(300);
    for (const row of (data || [])) {
      const norm = normalizePhone(row.phone);
      if (norm.length >= 10 && row.taalk_lead_id && !taalkLeadByPhone.has(norm)) {
        taalkLeadByPhone.set(norm, String(row.taalk_lead_id));
        if (row.cn_email && !cnEmailByPhone.has(norm) && !isBadEmail(row.cn_email))
          cnEmailByPhone.set(norm, row.cn_email.toLowerCase());
      }
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  // --- Pair inbound calls to extract agent email ---
  // Index inbound calls from this same batch by approx start time
  const inboundByTime = new Map<string, { startMs: number; dur: number; agentEmail: string | null }[]>();
  for (const c of allCalls) {
    if ((c as any).direction !== 'inbound') continue;
    const agentEmail = agentEmailFromClient(String((c as any).from ?? ''));
    const st = new Date(String((c as any).startTime ?? '')).getTime();
    if (isNaN(st)) continue;
    const key = Math.floor(st / 60000).toString();
    if (!inboundByTime.has(key)) inboundByTime.set(key, []);
    inboundByTime.get(key)!.push({
      startMs: st,
      dur: parseInt(String((c as any).duration ?? '0'), 10),
      agentEmail,
    });
  }

  const agentEmailBySid = new Map<string, string>();
  for (const c of newCalls) {
    const st = new Date(String((c as any).startTime ?? '')).getTime();
    if (isNaN(st)) continue;
    const dur = parseInt(String((c as any).duration ?? '0'), 10);
    const key = Math.floor(st / 60000).toString();
    const candidates = [
      ...(inboundByTime.get(key) ?? []),
      ...(inboundByTime.get(String(parseInt(key) - 1)) ?? []),
      ...(inboundByTime.get(String(parseInt(key) + 1)) ?? []),
    ];
    const match = candidates.find(
      (ib) => Math.abs(ib.startMs - st) <= 5000 && Math.abs(ib.dur - dur) <= 30 && ib.agentEmail
    );
    if (match?.agentEmail) agentEmailBySid.set((c as any).sid, match.agentEmail);
  }

  // --- agent_dial_metrics fallback for any still missing ---
  const admPhonesNeeded = toNumbers.filter(
    (p) => taalkLeadByPhone.has(p) && !cnEmailByPhone.has(p) && ![...agentEmailBySid.values()].length
  );
  const admAgentByPhone = new Map<string, string>();
  if (admPhonesNeeded.length > 0) {
    try {
      const { data: admRows } = await supabaseAdmin.rpc('get_agent_dial_metrics_by_phones', {
        phone_arr: admPhonesNeeded.slice(0, 500),
      });
      for (const row of (admRows || [])) {
        const norm = String(row?.norm_phone || '').replace(/\D/g, '').slice(-10);
        const email = String(row?.agent_email || '').toLowerCase();
        if (norm.length >= 10 && email.includes('@') && !isBadEmail(email) && !admAgentByPhone.has(norm))
          admAgentByPhone.set(norm, email);
      }
    } catch {
      const orClause = admPhonesNeeded.map((p) => `lead_phone.ilike.%${p}`).join(',');
      const { data } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('lead_phone, agent_email, event_timestamp')
        .or(orClause)
        .order('event_timestamp', { ascending: false })
        .limit(admPhonesNeeded.length * 3);
      for (const row of (data || [])) {
        const norm = normalizePhone(row.lead_phone);
        const email = String(row.agent_email || '').toLowerCase();
        if (norm.length >= 10 && email.includes('@') && !isBadEmail(email) && !admAgentByPhone.has(norm))
          admAgentByPhone.set(norm, email);
      }
    }
  }

  // --- Resolve associate_ids ---
  const allEmails = [
    ...new Set([
      ...cnEmailByPhone.values(),
      ...agentEmailBySid.values(),
      ...admAgentByPhone.values(),
    ]),
  ];
  const associateIdByEmail = new Map<string, number>();
  if (allEmails.length > 0) {
    const { data: custRows } = await supabaseAdmin
      .from('customers')
      .select('company_email, associate_id')
      .in('company_email', allEmails.slice(0, 300));
    for (const c of (custRows || [])) {
      if (c.company_email && c.associate_id != null)
        associateIdByEmail.set(c.company_email.toLowerCase(), c.associate_id);
    }
    const missing = allEmails.filter((e) => !associateIdByEmail.has(e));
    if (missing.length > 0) {
      const { data: plRows } = await supabaseAdmin
        .from('producerlist')
        .select('company_email, associate_id')
        .in('company_email', missing.slice(0, 300));
      for (const p of (plRows || [])) {
        if (p.company_email && p.associate_id != null && !associateIdByEmail.has(p.company_email.toLowerCase()))
          associateIdByEmail.set(p.company_email.toLowerCase(), p.associate_id);
      }
    }
  }

  // --- Send to Zapier ---
  let sent = 0;
  let skipped = 0;

  for (const c of newCalls) {
    const leadPhone = normalizePhone(String((c as any).to ?? ''));
    const taalkLeadId = taalkLeadByPhone.get(leadPhone) ?? null;
    if (!taalkLeadId) { skipped++; sentSids.add((c as any).sid); continue; }

    const cnEmail =
      cnEmailByPhone.get(leadPhone) ??
      agentEmailBySid.get((c as any).sid) ??
      admAgentByPhone.get(leadPhone) ??
      null;
    const associateId = cnEmail ? (associateIdByEmail.get(cnEmail) ?? null) : null;

    if (!associateId) { skipped++; sentSids.add((c as any).sid); continue; }

    try {
      const res = await fetch(ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: taalkLeadId, associate_id: associateId }),
      });
      if (res.ok) {
        sent++;
        sentSids.add((c as any).sid);
        console.log(`[ZapierSync] ✅ Sent lead_id=${taalkLeadId} associate_id=${associateId}`);
      } else {
        console.warn(`[ZapierSync] ⚠️ Zapier ${res.status} for lead_id=${taalkLeadId}`);
      }
    } catch (err) {
      console.error(`[ZapierSync] ❌ Fetch error for lead_id=${taalkLeadId}:`, (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  // Keep sentSids from growing unbounded — prune anything older than 2 hours worth
  if (sentSids.size > 10000) {
    const arr = [...sentSids];
    arr.slice(0, arr.length - 5000).forEach((s) => sentSids.delete(s));
  }

  console.log(`[ZapierSync] Done. Sent: ${sent} | Skipped (no match): ${skipped}`);
}

class TwilioCallZapierScheduler {
  private task: cron.ScheduledTask | null = null;

  start(): void {
    if (this.task) return;
    if (!JOB_WEBHOOKS_ENABLED) {
      console.log('[ZapierSync] Disabled: scheduled associate_id/taalk_lead_id webhooks are off');
      return;
    }
    console.log('[ZapierSync] Starting — runs every 5 minutes');

    // Run immediately on start
    runSync().catch((err) => console.error('[ZapierSync] Initial run error:', err));

    // Then every 5 minutes
    this.task = cron.schedule('*/5 * * * *', () => {
      runSync().catch((err) => console.error('[ZapierSync] Scheduled run error:', err));
    });
  }

  stop(): void {
    this.task?.stop();
    this.task = null;
  }
}

export const twilioCallZapierScheduler = new TwilioCallZapierScheduler();
