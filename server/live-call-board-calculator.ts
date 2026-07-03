/**
 * Live Call Board Calculator - Pure Node.js implementation
 * Calculates all stats directly from source tables (NO SQL functions, NO live_call_boardt reads)
 * Uses getTodayEST from calculate-dial-reach-booked-realtime for consistent date boundaries.
 */

import { supabaseAdmin } from './supabase';
import { getTodayEST } from './scripts/calculate-dial-reach-booked-realtime';

export interface AgentStats {
  agentEmail: string;
  dialed: number;
  reached: number;
  booked: number;
  instantPresentation: number;
  connects: number;
}

export interface LiveCallBoardAgent {
  id: string;
  name: string;
  email: string;
  associateId: string | null;
  mgaName: string | null;
  rgaName: string | null;
  mgaAssociateId: number | null;
  rgaAssociateId: number | null;
  status: string;
  todayStats: {
    dialed: number;
    reached: number;
    booked: number;
    instantPresentation: number;
    presentations: number;
    sales: number;
    alp: number;
  };
  credits: number;
  creditsRemaining: number;
  pendingLeads: number;
  connects: number;
  vdpCalls: number;
  lastActivity: string;
  lastHeartbeatAt: string | null;
  updatedAt: string | null;
  currentCall: any;
  currentPresentation: any;
  currentLive: any;
  ccproEnabled: boolean;
  availableForInbound: boolean;
  hasCallConnectorHeartbeat: boolean;
  hasRecruitHeartbeat: boolean;
}

/**
 * Get today's date range in EST timezone (midnight-to-midnight EST in UTC ISO strings).
 * Uses shared getTodayEST for consistency with agents endpoint and billing_transactions.
 */
function getTodayESTRange(): { start: string; end: string } {
  const { start, end } = getTodayEST();
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Calculate dialed count from twilio_call_logs
 * CRITICAL: Use same methodology as Sales Activity totals:
 * - Count distinct to_number
 * - Count if: (duration >= 1) OR (status = 'answered' or 'completed')
 * - Exclude: failed, busy, no-answer, canceled (unless answered/completed)
 */
async function calculateDialed(agentEmail: string, todayStart: string, todayEnd: string): Promise<number> {
  // Fetch all matching records first (we'll filter in code to match Sales Activity logic)
  // CRITICAL: Only count child calls (parent_call_sid IS NOT NULL) - exclude parent WebRTC calls
  const { data, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('to_number, call_duration, call_status, parent_call_sid')
    .eq('owner_email', agentEmail.toLowerCase().trim())
    .eq('call_direction', 'outbound')
    .gte('call_started_at', todayStart)
    .lt('call_started_at', todayEnd)
    .not('to_number', 'is', null)
    .neq('to_number', '')
    .not('parent_call_sid', 'is', null);  // CRITICAL: Only count child calls (dial legs), exclude parent WebRTC calls

  if (error) {
    console.error(`❌ Error calculating dialed for ${agentEmail}:`, error);
    return 0;
  }

  // Apply same filters as Sales Activity totals
  // CRITICAL: Only count child calls (parent_call_sid IS NOT NULL) - exclude parent WebRTC calls
  // CRITICAL: Count as dial if: (duration >= 1) OR (status = 'answered' or 'completed')
  // CRITICAL: Exclude failed/busy/no-answer/canceled (unless answered/completed)
  const filteredData = (data || []).filter((row: any) => {
    // CRITICAL: Only count child calls (dial legs), not parent WebRTC calls
    // Parent calls have parent_call_sid = NULL, child calls have parent_call_sid IS NOT NULL
    if (!row.parent_call_sid) return false;
    
    const duration = row.call_duration;
    const status = (row.call_status || '').toLowerCase();
    // Count if: (duration >= 1) OR (status = 'answered' or 'completed')
    const hasValidDuration = duration && duration >= 1;
    const isAnsweredOrCompleted = status === 'answered' || status === 'completed';
    const shouldCount = hasValidDuration || isAnsweredOrCompleted;
    // Exclude failed/busy/no-answer/canceled (unless answered/completed)
    const isExcluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !isAnsweredOrCompleted;
    return shouldCount && !isExcluded;
  });

  // Count distinct phone numbers (normalize to last 10 digits)
  const uniquePhones = new Set<string>();
  filteredData.forEach((row: any) => {
    if (row.to_number) {
      const phone = String(row.to_number).trim().replace(/\D/g, '').slice(-10);
      if (phone && phone.length >= 10) {
        uniquePhones.add(phone);
      }
    }
  });

  return uniquePhones.size;
}

/**
 * Calculate reached count from agent_dial_metrics
 */
async function calculateReached(agentEmail: string, todayStart: string, todayEnd: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('lead_phone')
    .eq('agent_email', agentEmail.toLowerCase().trim())
    .eq('event_type', 'reach')
    .gte('event_timestamp', todayStart)
    .lt('event_timestamp', todayEnd)
    .not('lead_phone', 'is', null);

  if (error) {
    console.error(`❌ Error calculating reached for ${agentEmail}:`, error);
    return 0;
  }

  // Count distinct phone numbers
  const uniquePhones = new Set<string>();
  (data || []).forEach((row: any) => {
    if (row.lead_phone) {
      uniquePhones.add(String(row.lead_phone).trim());
    }
  });

  return uniquePhones.size;
}

/**
 * Calculate booked count from agent_dial_metrics
 */
async function calculateBooked(agentEmail: string, todayStart: string, todayEnd: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('lead_phone')
    .eq('agent_email', agentEmail.toLowerCase().trim())
    .in('event_type', ['booked', 'instant_presentation'])
    .gte('event_timestamp', todayStart)
    .lt('event_timestamp', todayEnd)
    .not('lead_phone', 'is', null);

  if (error) {
    console.error(`❌ Error calculating booked for ${agentEmail}:`, error);
    return 0;
  }

  // Count distinct phone numbers
  const uniquePhones = new Set<string>();
  (data || []).forEach((row: any) => {
    if (row.lead_phone) {
      uniquePhones.add(String(row.lead_phone).trim());
    }
  });

  return uniquePhones.size;
}

/**
 * Calculate instant presentation count from agent_dial_metrics
 */
async function calculateInstantPresentation(agentEmail: string, todayStart: string, todayEnd: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('lead_phone')
    .eq('agent_email', agentEmail.toLowerCase().trim())
    .eq('event_type', 'instant_presentation')
    .gte('event_timestamp', todayStart)
    .lt('event_timestamp', todayEnd)
    .not('lead_phone', 'is', null);

  if (error) {
    console.error(`❌ Error calculating instant_presentation for ${agentEmail}:`, error);
    return 0;
  }

  // Count distinct phone numbers
  const uniquePhones = new Set<string>();
  (data || []).forEach((row: any) => {
    if (row.lead_phone) {
      uniquePhones.add(String(row.lead_phone).trim());
    }
  });

  return uniquePhones.size;
}

/**
 * Calculate connects from vdp_calls.
 * Match company_email OR agent_email (vdp_calls may use either field).
 */
async function calculateConnects(agentEmail: string, todayStart: string, todayEnd: string): Promise<number> {
  const email = agentEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('vdp_calls')
    .select('id')
    .or(`company_email.eq.${email},agent_email.eq.${email}`)
    .gte('updated_at', todayStart)
    .lt('updated_at', todayEnd);

  if (error) {
    console.error(`❌ Error calculating connects for ${agentEmail}:`, error);
    return 0;
  }

  return (data || []).length;
}

/**
 * Calculate stats for a single agent
 */
export async function calculateAgentStats(agentEmail: string): Promise<AgentStats> {
  const { start, end } = getTodayESTRange();

  const [dialed, reached, booked, instantPresentation, connects] = await Promise.all([
    calculateDialed(agentEmail, start, end),
    calculateReached(agentEmail, start, end),
    calculateBooked(agentEmail, start, end),
    calculateInstantPresentation(agentEmail, start, end),
    calculateConnects(agentEmail, start, end)
  ]);

  return {
    agentEmail: agentEmail.toLowerCase().trim(),
    dialed,
    reached,
    booked,
    instantPresentation,
    connects
  };
}

/**
 * Calculate stats for multiple agents in parallel
 */
export async function calculateAllAgentStats(agentEmails: string[]): Promise<Map<string, AgentStats>> {
  const statsMap = new Map<string, AgentStats>();
  
  // Calculate in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < agentEmails.length; i += batchSize) {
    const batch = agentEmails.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(email => calculateAgentStats(email))
    );
    
    batchResults.forEach(stats => {
      statsMap.set(stats.agentEmail, stats);
    });
  }

  return statsMap;
}

/**
 * Get all agents from agent_hierarchy
 */
export async function getAllAgentsFromHierarchy(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_email')
    .not('agent_email', 'is', null);

  if (error) {
    console.error('❌ Error fetching agents from hierarchy:', error);
    return [];
  }

  return (data || []).map(row => String(row.agent_email).toLowerCase().trim());
}
