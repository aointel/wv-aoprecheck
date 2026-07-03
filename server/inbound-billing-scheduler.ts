/**
 * Inbound 609 Billing Scheduler
 * 
 * Polls Taalk API for recent transferred calls, matches to TaskRouter assignments
 * to find which agent answered, then inserts billing_transactions and deducts credits.
 * 
 * Flow:
 * 1. Fetch recent calls from Taalk (hasRedirectCall=true, durationAfterTransfer > 0)
 * 2. Get caller phone from Taalk call data
 * 3. Match to taskrouter_pending by phone_number in task_attributes → get agent_email from worker_attributes
 * 4. Look up associate_id from customers table
 * 5. Insert billing_transactions + deduct credits via creditService
 * 
 * Runs every 5 minutes, looks back 30 minutes for new transfers.
 */

import { supabaseAdmin } from './supabase';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
const TAALK_HEADERS = {
  'Authorization': `Bearer ${TAALK_API_KEY}`,
  'Accept': 'application/json',
};

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours — catches full day, deduplicates via transaction_id

interface TaalkCall {
  _id: string;
  phone?: string;
  duration?: number;
  durationAfterTransfer?: number;
  hasRedirectCall?: boolean;
  agent?: string;
  campaign?: string;
  createdAt?: string;
  created_at?: string;
  params?: {
    Taalk_ClientPhone?: string;
    Taalk_MemberPhone?: string;
    Taalk_Lead_Source?: string;
    [key: string]: any;
  };
}

function extractPhone(call: TaalkCall): string | null {
  // Prefer params.Taalk_ClientPhone
  if (call.params?.Taalk_ClientPhone) {
    return call.params.Taalk_ClientPhone.replace(/\D/g, '').slice(-10);
  }
  if (call.params?.Taalk_MemberPhone) {
    return call.params.Taalk_MemberPhone.replace(/\D/g, '').slice(-10);
  }
  if (call.phone) {
    if (call.phone.startsWith('+')) {
      return call.phone.replace(/\D/g, '').slice(-10);
    }
    // Complex format: "6692192599,,5897015416#,,#,,1#" — second part is the client phone
    const parts = call.phone.split(',').filter(Boolean);
    for (const part of parts) {
      const cleaned = part.replace(/#/g, '').trim().replace(/\D/g, '');
      if (cleaned.length >= 10) {
        return cleaned.slice(-10);
      }
    }
  }
  return null;
}

interface UnbilledCall {
  callSid: string;
  taalkCallId: string;
  agentEmail: string;
  callerPhone: string;
  callDuration: number;
  metadata: any;
}

async function findUnbilledInboundCalls(): Promise<UnbilledCall[]> {
  if (!supabaseAdmin) return [];

  const BAD_EMAILS = ['', 'cnsysop@aoglobelife.com', 'unknown@aoglobelife.com', 'system@aoglobelife.com'];
  const cutoff = new Date(Date.now() - LOOKBACK_MS).toISOString();

  // Get recent completed inbound calls with owner_email set
  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, from_number, owner_email, call_duration, metadata, agent_identity')
    .eq('call_direction', 'inbound')
    .eq('call_status', 'completed')
    .gt('call_duration', 10)
    .gte('call_started_at', cutoff)
    .order('call_started_at', { ascending: false })
    .limit(200);

  if (error || !rows?.length) return [];

  const unbilled: UnbilledCall[] = [];
  for (const row of rows) {
    const meta = row.metadata || {};
    const taalkCallId = (meta as any)?.taalk_call_id;
    if (!taalkCallId) continue; // No Taalk link, skip

    // Resolve agent email
    let agentEmail = '';
    if (row.owner_email && row.owner_email.includes('@') && !BAD_EMAILS.includes(row.owner_email.toLowerCase())) {
      agentEmail = row.owner_email.trim().toLowerCase();
    }
    if (!agentEmail) {
      const metaAgent = (meta as any)?.agent_email || (meta as any)?.accepted_agent_email || '';
      if (metaAgent && metaAgent.includes('@') && !BAD_EMAILS.includes(metaAgent.toLowerCase())) {
        agentEmail = metaAgent.trim().toLowerCase();
      }
    }
    if (!agentEmail && row.agent_identity) {
      const ai = String(row.agent_identity).replace(/^client:/i, '').trim().toLowerCase();
      if (ai.includes('@') && !BAD_EMAILS.includes(ai)) agentEmail = ai;
    }
    if (!agentEmail) continue;

    const callerPhone = String(row.from_number || '').replace(/\D/g, '').slice(-10);

    unbilled.push({
      callSid: row.twilio_call_sid,
      taalkCallId,
      agentEmail,
      callerPhone,
      callDuration: row.call_duration || 0,
      metadata: meta,
    });
  }

  if (unbilled.length === 0) return [];

  // Filter out already-billed ones
  const txIds = unbilled.map(u => `inbound-taalk-${u.taalkCallId}`);
  const { data: existing } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id')
    .in('transaction_id', txIds);
  const billedSet = new Set((existing || []).map(e => e.transaction_id));

  return unbilled.filter(u => !billedSet.has(`inbound-taalk-${u.taalkCallId}`));
}

async function findAgentForCall(taalkCallId: string): Promise<{ agentEmail: string; associateId: string; agentName: string } | null> {
  if (!supabaseAdmin) return null;

  const BAD_EMAILS = ['', 'cnsysop@aoglobelife.com', 'unknown@aoglobelife.com', 'system@aoglobelife.com'];

  // Direct match: twilio_call_logs stores metadata.taalk_call_id from the /incomingcall enrichment.
  // This is the most reliable link between Taalk and Twilio.
  const { data: rows } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('owner_email, metadata, agent_identity')
    .eq('call_direction', 'inbound')
    .gt('call_duration', 10)
    .contains('metadata', { taalk_call_id: taalkCallId })
    .limit(5);

  for (const row of (rows || [])) {
    let agentEmail = '';
    if (row.owner_email && row.owner_email.includes('@') && !BAD_EMAILS.includes(row.owner_email.toLowerCase())) {
      agentEmail = row.owner_email.trim().toLowerCase();
    }
    if (!agentEmail) {
      const meta = row.metadata || {};
      const metaAgent = (meta as any)?.agent_email || (meta as any)?.accepted_agent_email || '';
      if (metaAgent && metaAgent.includes('@') && !BAD_EMAILS.includes(metaAgent.toLowerCase())) {
        agentEmail = metaAgent.trim().toLowerCase();
      }
    }
    if (!agentEmail && row.agent_identity) {
      const ai = String(row.agent_identity).replace(/^client:/i, '').trim().toLowerCase();
      if (ai.includes('@') && !BAD_EMAILS.includes(ai)) {
        agentEmail = ai;
      }
    }
    if (!agentEmail) continue;

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('associate_id, first_name, last_name')
      .eq('company_email', agentEmail)
      .maybeSingle();

    if (!customer?.associate_id) {
      console.warn(`⚠️ Billing scheduler: no associate_id for ${agentEmail}`);
      continue;
    }

    return {
      agentEmail,
      associateId: String(customer.associate_id).trim(),
      agentName: [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || agentEmail,
    };
  }

  return null;
}

async function processCall(call: UnbilledCall): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const transactionId = `inbound-taalk-${call.taalkCallId}`;
  const taalkRecordingUrl = `https://api.taalk.ai/api/calls/${call.taalkCallId}/recording?db=michaelmandella`;

  // Look up associate_id
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('associate_id, first_name, last_name')
    .eq('company_email', call.agentEmail)
    .maybeSingle();
  const associateId = customer?.associate_id ? String(customer.associate_id).trim() : null;
  if (!associateId) {
    console.warn(`⚠️ Billing scheduler: no associate_id for ${call.agentEmail}, call ${call.callSid}`);
    return false;
  }
  const agentName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || call.agentEmail;

  // Insert as pending — adjudicator handles actual billing
  try {
    await supabaseAdmin.from('billing_transactions').insert({
      transaction_id: transactionId,
      transaction_type: 'connect',
      agent_email: call.agentEmail,
      agent_associate_id: parseInt(associateId, 10) || null,
      agent_name: agentName,
      transaction_date: new Date().toISOString(),
      amount_usd: 8.0,
      credits_charged: 0,
      lead_name: null,
      lead_phone: call.callerPhone,
      source_table: 'twilio_call_logs',
      description: 'Inbound connect (609/TaskRouter)',
      status: 'completed',
      adjudication_status: 'pending',
      taalk_call_id: call.taalkCallId,
      segment_recording_url: taalkRecordingUrl,
      metadata: {
        taalk_call_id: call.taalkCallId,
        twilio_call_sid: call.callSid,
        caller_phone: call.callerPhone,
        call_duration: call.callDuration,
        persona: (call.metadata as any)?.taalk_persona_name || null,
        source: 'inbound_billing_scheduler',
      },
    });
    console.log(`📝 Billing scheduler: inserted for ${call.agentEmail} (${associateId}), taalk ${call.taalkCallId}, ${call.callDuration}s`);
  } catch (btEx: any) {
    if (btEx?.code === '23505') return false;
    console.warn('⚠️ Billing scheduler: insert failed:', btEx?.message || btEx);
    return false;
  }

  // Credits charged by catchup loop AFTER adjudicator decides 'uphold'
  return true;
}

export const inboundBillingScheduler = {
  timer: null as ReturnType<typeof setInterval> | null,
  isRunning: false,

  start(): void {
    if (!supabaseAdmin) {
      console.warn('⚠️ Inbound billing scheduler disabled — no Supabase');
      return;
    }
    if (this.timer) {
      console.log('⚠️ Inbound billing scheduler already running');
      return;
    }
    console.log(`🚀 Inbound billing scheduler started — every ${POLL_INTERVAL_MS / 1000}s, lookback ${LOOKBACK_MS / 60000}min`);

    // Run immediately, then on interval
    this.runCycle().catch(e => console.error('❌ Billing scheduler initial run:', e?.message));
    this.timer = setInterval(() => {
      if (!this.isRunning) {
        this.runCycle().catch(e => console.error('❌ Billing scheduler:', e?.message));
      }
    }, POLL_INTERVAL_MS);
  },

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('🛑 Inbound billing scheduler stopped');
    }
  },

  async runCycle(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      // 1) Insert new billing rows for unbilled calls
      const unbilled = await findUnbilledInboundCalls();
      let billed = 0;
      let skipped = 0;
      for (const call of unbilled) {
        const result = await processCall(call);
        if (result) billed++;
        else skipped++;
        await new Promise(r => setTimeout(r, 100));
      }
      if (billed > 0 || skipped > 0) {
        console.log(`✅ Billing scheduler: ${billed} new, ${skipped} skipped`);
      }

      // 2) Catchup: deduct credits for any rows that were inserted but not charged
      if (supabaseAdmin) {
        // Only charge rows where adjudicator decided 'uphold' (NOT 'refund')
        const { data: uncharged } = await supabaseAdmin
          .from('billing_transactions')
          .select('transaction_id, agent_email, agent_associate_id, lead_phone, metadata')
          .like('transaction_id', 'inbound-taalk-%')
          .eq('credits_charged', 0)
          .eq('adjudication_decision', 'uphold')
          .limit(100);

        let catchup = 0;
        for (const row of (uncharged || [])) {
          if (!row.agent_email) continue;
          try {
            const { data: uc } = await supabaseAdmin.from('user_credits')
              .select('credits_used')
              .eq('email', row.agent_email)
              .maybeSingle();
            if (uc) {
              const newUsed = (uc.credits_used || 0) + 8;
              await supabaseAdmin.from('user_credits')
                .update({ credits_used: newUsed })
                .eq('email', row.agent_email);
              await supabaseAdmin.from('billing_transactions')
                .update({ credits_charged: 8 })
                .eq('transaction_id', row.transaction_id);
              catchup++;
              console.log(`✅ Catchup: ${row.agent_email} charged, credits_used: ${newUsed}`);
            }
          } catch (_) {}
          await new Promise(r => setTimeout(r, 50));
        }
        if (catchup > 0) console.log(`✅ Catchup: ${catchup} uncharged rows now billed`);
      }
    } catch (err) {
      console.error('❌ Billing scheduler cycle error:', err);
    } finally {
      this.isRunning = false;
    }
  },
};
