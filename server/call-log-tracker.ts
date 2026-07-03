import { SupabaseClient } from '@supabase/supabase-js';

export type CallSource = 'dialer' | 'vdp' | 'meet' | 'manual' | 'hotlead';
export type CallDirection = 'outbound' | 'inbound' | 'vdp' | 'meet';

type CallLogBase = {
  leadId: number;
  agentEmail: string;
  taalkMarket?: string | null;
  isPlusLead?: boolean;
  source: CallSource;
};

export async function logCallStarted(
  client: SupabaseClient,
  params: CallLogBase & {
    callSid?: string | null;
    direction?: CallDirection;
    startedAt?: string;
    connectId?: string | null;
    meetingId?: string | null;
  }
) {
  const now = params.startedAt ?? new Date().toISOString();

  const { error } = await client.from('call_log').insert({
    lead_id: params.leadId,
    agent_email: params.agentEmail.toLowerCase(),
    taalk_market: params.taalkMarket ?? null,
    is_plus_lead: params.isPlusLead ?? null,
    call_sid: params.callSid ?? null,
    direction: params.direction ?? 'outbound',
    source: params.source,
    started_at: now,
    call_status: 'started',
    reached: false,
    connect_id: params.connectId ?? null,
    meeting_id: params.meetingId ?? null,
  });

  if (error) {
    console.error('logCallStarted failed', error, params);
  } else {
    console.log(`✅ Call logged: ${params.source} call started for lead ${params.leadId} by ${params.agentEmail}`);
  }
}

export async function logCallCompleted(
  client: SupabaseClient,
  params: {
    callSid: string;
    callStatus: string;            // 'completed', 'no_answer', 'busy', 'failed', etc.
    reached: boolean;
    disposition?: string;
    notes?: string;
    connectedAt?: string | null;
    endedAt?: string | null;
    durationSeconds?: number | null;
    talkSeconds?: number | null;
  }
) {
  const {
    callSid,
    callStatus,
    reached,
    disposition,
    notes,
    connectedAt,
    endedAt,
    durationSeconds,
    talkSeconds,
  } = params;

  const updatePayload: any = {
    call_status: callStatus,
    reached,
    disposition: disposition ?? null,
    notes: notes ?? null,
    connected_at: connectedAt ?? null,
    ended_at: endedAt ?? new Date().toISOString(),
    duration_seconds: durationSeconds ?? null,
    talk_seconds: talkSeconds ?? null,
  };

  const { error } = await client
    .from('call_log')
    .update(updatePayload)
    .eq('call_sid', callSid);

  if (error) {
    console.error('logCallCompleted failed', error, params);
  } else {
    console.log(`✅ Call completed: ${callSid} - ${callStatus} (reached: ${reached})`);
  }
}




