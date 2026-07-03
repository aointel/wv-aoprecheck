import { SupabaseClient } from '@supabase/supabase-js';

export type PresentationSource = 'meet' | 'in_person' | 'phone_presentation';

export async function logPresentationStarted(
  client: SupabaseClient,
  params: {
    leadId: number;
    agentEmail: string;
    taalkMarket?: string | null;
    isPlusLead?: boolean;
    meetingId?: string | null;
    source: PresentationSource;
    startedAt?: string;
  }
) {
  const now = params.startedAt ?? new Date().toISOString();

  const { error } = await client.from('presentation_log').insert({
    lead_id: params.leadId,
    agent_email: params.agentEmail.toLowerCase(),
    taalk_market: params.taalkMarket ?? null,
    is_plus_lead: params.isPlusLead ?? null,
    meeting_id: params.meetingId ?? null,
    source: params.source,
    started_at: now,
    presentation_status: 'pending',
  });

  if (error) {
    console.error('logPresentationStarted failed', error, params);
  } else {
    console.log(`✅ Presentation logged: ${params.source} presentation started for lead ${params.leadId} by ${params.agentEmail}`);
  }
}

export async function logPresentationCompleted(
  client: SupabaseClient,
  params: {
    meetingId: string;
    presentationStatus: string;    // 'completed' | 'no_show' | 'cancelled' | 'reschedule'
    endedAt?: string | null;
    durationSeconds?: number | null;
    notes?: string;
  }
) {
  const {
    meetingId,
    presentationStatus,
    endedAt,
    durationSeconds,
    notes,
  } = params;

  const updatePayload: any = {
    presentation_status: presentationStatus,
    ended_at: endedAt ?? new Date().toISOString(),
    duration_seconds: durationSeconds ?? null,
    notes: notes ?? null,
  };

  const { error } = await client
    .from('presentation_log')
    .update(updatePayload)
    .eq('meeting_id', meetingId);

  if (error) {
    console.error('logPresentationCompleted failed', error, params);
  } else {
    console.log(`✅ Presentation completed: ${meetingId} - ${presentationStatus}`);
  }
}




