/**
 * AOI Score Service
 *
 * Fetches and computes AOI score data from aoi_score_tracker (keyed by associate_id).
 * The table is populated by calculateAndUpsertAOIScore() which derives metrics from
 * agent_dial_metrics, twilio_call_logs, and related sources.
 */

import { supabaseAdmin } from './supabase';
import { subDays } from 'date-fns';

/** PostgREST `.or()` values with @ or . must be double-quoted; internal `"` → `""`. */
export function postgrestQuotedFilterValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export interface AOIScoreData {
  associateId: number;
  agentEmail: string | null;
  dialToConnectRate: number;
  appointmentBookRate: number;
  presentationRate: number;
  closingRate: number;
  followUpConsistency: number;
  leadQualityScore: number;
  aoiScore: number;
  performanceTier: string;
  sampleSize: number;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  calculatedAt: string;
  updatedAt: string;
}

/**
 * Look up associate_id from customers by agent email (company_email or personal_email)
 */
export async function getAssociateIdByEmail(agentEmail: string): Promise<number | null> {
  if (!agentEmail?.trim()) return null;
  if (!supabaseAdmin) return null;

  const normalized = agentEmail.trim().toLowerCase();
  const q = postgrestQuotedFilterValue(normalized);

  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('associate_id')
    .or(`company_email.ilike.${q},personal_email.ilike.${q}`)
    .not('associate_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ AOI Score: Failed to lookup associate_id:', error);
    return null;
  }

  return data?.associate_id ?? null;
}

/**
 * Fetch AOI score for an associate from aoi_score_tracker.
 * Returns null if no row exists or table is not present.
 */
export async function getAOIScoreByAssociateId(
  associateId: number
): Promise<AOIScoreData | null> {
  if (!associateId || !supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from('aoi_score_tracker')
    .select(
      'associate_id, agent_email, dial_to_connect_rate, appointment_book_rate, presentation_rate, closing_rate, follow_up_consistency, lead_quality_score, aoi_score, performance_tier, sample_size, date_range_start, date_range_end, calculated_at, updated_at'
    )
    .eq('associate_id', associateId)
    .maybeSingle();

  if (error) {
    // Table might not exist yet
    if (error.code === '42P01') {
      console.warn('⚠️ AOI Score: aoi_score_tracker table does not exist. Run database/create-aoi-score-tracker.sql');
      return null;
    }
    console.error('❌ AOI Score: Failed to fetch:', error);
    return null;
  }

  if (!data) return null;

  return {
    associateId: data.associate_id,
    agentEmail: data.agent_email ?? null,
    dialToConnectRate: Number(data.dial_to_connect_rate ?? 0),
    appointmentBookRate: Number(data.appointment_book_rate ?? 0),
    presentationRate: Number(data.presentation_rate ?? 0),
    closingRate: Number(data.closing_rate ?? 0),
    followUpConsistency: Number(data.follow_up_consistency ?? 0),
    leadQualityScore: Number(data.lead_quality_score ?? 0),
    aoiScore: Number(data.aoi_score ?? 0),
    performanceTier: data.performance_tier ?? 'needs_improvement',
    sampleSize: Number(data.sample_size ?? 0),
    dateRangeStart: data.date_range_start ?? null,
    dateRangeEnd: data.date_range_end ?? null,
    calculatedAt: data.calculated_at ?? new Date().toISOString(),
    updatedAt: data.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Fetch AOI score by agent email. Resolves associate_id first, then fetches from aoi_score_tracker.
 */
export async function getAOIScoreByEmail(
  agentEmail: string
): Promise<AOIScoreData | null> {
  const associateId = await getAssociateIdByEmail(agentEmail);
  if (!associateId) return null;
  return getAOIScoreByAssociateId(associateId);
}

/**
 * Calculate metrics from agent_dial_metrics and twilio_call_logs, then upsert into aoi_score_tracker.
 * Uses last 30 days of data. Maps agent_email to associate_id via customers.
 */
export async function calculateAndUpsertAOIScore(
  associateId: number,
  agentEmail: string
): Promise<AOIScoreData | null> {
  if (!supabaseAdmin) return null;

  const rangeEnd = new Date();
  const rangeStart = subDays(rangeEnd, 30);
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  const normalizedEmail = agentEmail.trim().toLowerCase();

  // 1. Dial count: twilio_call_logs outbound calls
  // CRITICAL: Use same methodology as Sales Activity totals:
  // - Count distinct to_number
  // - Count if: (duration >= 1) OR (status = 'answered' or 'completed')
  // - Exclude: failed, busy, no-answer, canceled (unless answered/completed)
  const { data: dialData } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('to_number, call_duration, call_status')
    .eq('owner_email', normalizedEmail)
    .eq('call_direction', 'outbound')
    .gte('call_started_at', startIso)
    .lt('call_started_at', endIso)
    .not('to_number', 'is', null)
    .neq('to_number', '');

  // Apply same filters as Sales Activity totals
  const filteredDialData = (dialData || []).filter((row: any) => {
    const duration = row.call_duration;
    const status = (row.call_status || '').toLowerCase();
    const durationOrStatus = (duration && duration >= 1) || 
                            ['answered', 'completed'].includes(status);
    const notExcluded = !['failed', 'busy', 'no-answer', 'canceled'].includes(status);
    return durationOrStatus && notExcluded;
  });

  const dialedPhones = new Set<string>();
  filteredDialData.forEach((r: any) => {
    if (r.to_number) {
      const phone = String(r.to_number).trim().replace(/\D/g, '').slice(-10);
      if (phone && phone.length >= 10) {
        dialedPhones.add(phone);
      }
    }
  });
  const dialed = dialedPhones.size;

  // 2. Reached count: agent_dial_metrics event_type = 'reach'
  const { data: reachData } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('lead_phone')
    .eq('agent_email', normalizedEmail)
    .eq('event_type', 'reach')
    .gte('event_timestamp', startIso)
    .lt('event_timestamp', endIso)
    .not('lead_phone', 'is', null);

  const reachedPhones = new Set<string>();
  (reachData || []).forEach((r: any) => {
    if (r.lead_phone) reachedPhones.add(String(r.lead_phone).trim());
  });
  const reached = reachedPhones.size;

  // 3. Booked count: agent_dial_metrics event_type in ['booked','instant_presentation']
  const { data: bookedData } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('lead_phone')
    .eq('agent_email', normalizedEmail)
    .in('event_type', ['booked', 'instant_presentation'])
    .gte('event_timestamp', startIso)
    .lt('event_timestamp', endIso)
    .not('lead_phone', 'is', null);

  const bookedPhones = new Set<string>();
  (bookedData || []).forEach((r: any) => {
    if (r.lead_phone) bookedPhones.add(String(r.lead_phone).trim());
  });
  const booked = bookedPhones.size;

  // Compute rates (0–100 scale)
  const dialToConnectRate = dialed > 0 ? Math.min(100, (reached / dialed) * 100) : 0;
  const appointmentBookRate = reached > 0 ? Math.min(100, (booked / reached) * 100) : 0;

  // Presentation, closing, follow-up, lead quality: no direct source yet - use placeholders
  // until we wire in producer state / billing / presentation tracker
  const presentationRate = 0;
  const closingRate = 0;
  const followUpConsistency = 0;
  const leadQualityScore = 0;

  const sampleSize = dialed + reached + booked;

  // Upsert via RPC if available, else direct insert/update
  const { data: upserted, error } = await supabaseAdmin.rpc('upsert_aoi_score', {
    p_associate_id: associateId,
    p_agent_email: agentEmail,
    p_dial_to_connect_rate: dialToConnectRate,
    p_appointment_book_rate: appointmentBookRate,
    p_presentation_rate: presentationRate,
    p_closing_rate: closingRate,
    p_follow_up_consistency: followUpConsistency,
    p_lead_quality_score: leadQualityScore,
    p_sample_size: sampleSize,
    p_date_range_start: startIso,
    p_date_range_end: endIso,
  });

  if (error) {
    // RPC might not exist - fallback to raw upsert
    if (error.code === '42883') {
      const { error: insErr } = await supabaseAdmin.from('aoi_score_tracker').upsert(
        {
          associate_id: associateId,
          agent_email: agentEmail,
          dial_to_connect_rate: dialToConnectRate,
          appointment_book_rate: appointmentBookRate,
          presentation_rate: presentationRate,
          closing_rate: closingRate,
          follow_up_consistency: followUpConsistency,
          lead_quality_score: leadQualityScore,
          sample_size: sampleSize,
          date_range_start: startIso,
          date_range_end: endIso,
          calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'associate_id' }
      );
      if (insErr) {
        console.error('❌ AOI Score: Upsert failed:', insErr);
        return null;
      }
      return getAOIScoreByAssociateId(associateId);
    }
    console.error('❌ AOI Score: RPC upsert_aoi_score failed:', error);
    return null;
  }

  if (upserted) {
    return {
      associateId: upserted.associate_id,
      agentEmail: upserted.agent_email ?? null,
      dialToConnectRate: Number(upserted.dial_to_connect_rate ?? 0),
      appointmentBookRate: Number(upserted.appointment_book_rate ?? 0),
      presentationRate: Number(upserted.presentation_rate ?? 0),
      closingRate: Number(upserted.closing_rate ?? 0),
      followUpConsistency: Number(upserted.follow_up_consistency ?? 0),
      leadQualityScore: Number(upserted.lead_quality_score ?? 0),
      aoiScore: Number(upserted.aoi_score ?? 0),
      performanceTier: upserted.performance_tier ?? 'needs_improvement',
      sampleSize: Number(upserted.sample_size ?? 0),
      dateRangeStart: upserted.date_range_start ?? null,
      dateRangeEnd: upserted.date_range_end ?? null,
      calculatedAt: upserted.calculated_at ?? new Date().toISOString(),
      updatedAt: upserted.updated_at ?? new Date().toISOString(),
    };
  }

  return getAOIScoreByAssociateId(associateId);
}
