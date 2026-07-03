/**
 * Timezone Helper
 * Converts times to the lead's state timezone
 */

import { pool } from "./db";

// US State to Timezone mapping
export const STATE_TIMEZONES: Record<string, string> = {
  // Eastern Time
  'CT': 'America/New_York',
  'DE': 'America/New_York',
  'FL': 'America/New_York',
  'GA': 'America/New_York',
  'MA': 'America/New_York',
  'MD': 'America/New_York',
  'ME': 'America/New_York',
  'NC': 'America/New_York',
  'NH': 'America/New_York',
  'NJ': 'America/New_York',
  'NY': 'America/New_York',
  'OH': 'America/New_York',
  'PA': 'America/New_York',
  'RI': 'America/New_York',
  'SC': 'America/New_York',
  'VA': 'America/New_York',
  'VT': 'America/New_York',
  'WV': 'America/New_York',
  'MI': 'America/Detroit',
  'IN': 'America/Indiana/Indianapolis',
  'KY': 'America/Kentucky/Louisville',
  
  // Central Time
  'AL': 'America/Chicago',
  'AR': 'America/Chicago',
  'IA': 'America/Chicago',
  'IL': 'America/Chicago',
  'KS': 'America/Chicago',
  'LA': 'America/Chicago',
  'MN': 'America/Chicago',
  'MO': 'America/Chicago',
  'MS': 'America/Chicago',
  'NE': 'America/Chicago',
  'OK': 'America/Chicago',
  'SD': 'America/Chicago',
  'TN': 'America/Chicago',
  'TX': 'America/Chicago',
  'WI': 'America/Chicago',
  'ND': 'America/North_Dakota/Center',
  
  // Mountain Time
  'AZ': 'America/Phoenix', // Arizona doesn't observe DST
  'CO': 'America/Denver',
  'ID': 'America/Boise',
  'MT': 'America/Denver',
  'NM': 'America/Denver',
  'UT': 'America/Denver',
  'WY': 'America/Denver',
  
  // Pacific Time
  'CA': 'America/Los_Angeles',
  'NV': 'America/Los_Angeles',
  'OR': 'America/Los_Angeles',
  'WA': 'America/Los_Angeles',
  
  // Alaska
  'AK': 'America/Anchorage',
  
  // Hawaii
  'HI': 'America/Honolulu'
};

/**
 * Get timezone for a US state
 */
export function getTimezoneForState(state: string): string {
  const upperState = state?.toUpperCase().trim();
  return STATE_TIMEZONES[upperState] || 'America/New_York'; // Default to Eastern
}

/**
 * Format time in the lead's timezone
 */
export function formatTimeInStateTimezone(date: Date, state: string): string {
  const timezone = getTimezoneForState(state);
  
  return date.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Get current time in PST (for logging)
 */
export function getCurrentTimePST(): Date {
  const now = new Date();
  const pstTimeString = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  return new Date(pstTimeString);
}

/**
 * Convert Date to PST ISO string (for database storage)
 */
export function toPSTISOString(date: Date): string {
  const pstTimeString = date.toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Convert to ISO format
  const [datePart, timePart] = pstTimeString.split(', ');
  const [month, day, year] = datePart.split('/');
  return `${year}-${month}-${day}T${timePart}-08:00`; // PST offset
}

/**
 * Get current time in state's timezone
 */
export function getCurrentTimeInState(state: string): Date {
  const timezone = getTimezoneForState(state);
  const now = new Date();
  
  // Convert to state's timezone
  const stateTimeString = now.toLocaleString('en-US', { timeZone: timezone });
  return new Date(stateTimeString);
}

/**
 * Get timezone offset in hours from UTC
 */
export function getTimezoneOffsetHours(state: string): number {
  const timezone = getTimezoneForState(state);
  const now = new Date();
  
  // Get offset by comparing UTC to state time
  const utcTime = now.getTime();
  const stateTimeString = now.toLocaleString('en-US', { timeZone: timezone });
  const stateTime = new Date(stateTimeString).getTime();
  
  return (stateTime - utcTime) / (1000 * 60 * 60);
}

/**
 * Get timezone abbreviation (EST, CST, MST, PST, etc.)
 */
export function getTimezoneAbbr(state: string): string {
  const timezone = getTimezoneForState(state);
  
  if (timezone.includes('New_York') || timezone.includes('Detroit') || timezone.includes('Indiana') || timezone.includes('Kentucky')) {
    return 'ET';
  } else if (timezone.includes('Chicago') || timezone.includes('North_Dakota')) {
    return 'CT';
  } else if (timezone.includes('Denver') || timezone.includes('Boise')) {
    return 'MT';
  } else if (timezone === 'America/Phoenix') {
    return 'MST'; // Arizona (no DST)
  } else if (timezone.includes('Los_Angeles')) {
    return 'PT';
  } else if (timezone.includes('Anchorage')) {
    return 'AKT';
  } else if (timezone.includes('Honolulu')) {
    return 'HST';
  }
  
  return 'ET'; // Default
}

/**
 * Check if it's safe to call based on FTC restrictions (8 AM - 9 PM in lead's timezone)
 */
export function isSafeToCall(state: string): { 
  safe: boolean; 
  reason?: string;
  leadLocalTime: string;
  leadHour: number;
} {
  const timezone = getTimezoneForState(state);
  const now = new Date();
  
  // Get lead's current time
  const leadTimeString = now.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  // Get lead's current hour (24-hour format)
  const leadHour = parseInt(now.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false
  }));
  
  // FTC restrictions: Cannot call before 8 AM or after 9 PM in lead's local time
  if (leadHour < 8) {
    return {
      safe: false,
      reason: `Too early (before 8 AM ${getTimezoneAbbr(state)})`,
      leadLocalTime: leadTimeString,
      leadHour
    };
  }
  
  if (leadHour >= 21) { // 9 PM = 21:00 in 24-hour format
    return {
      safe: false,
      reason: `Too late (after 9 PM ${getTimezoneAbbr(state)})`,
      leadLocalTime: leadTimeString,
      leadHour
    };
  }
  
  return {
    safe: true,
    leadLocalTime: leadTimeString,
    leadHour
  };
}

/**
 * Count PENDING leads for an agent, excluding leads outside their timezone restriction
 * ONLY counts leads with cnresolution = 'pending' or null
 * This is used to determine if an agent needs more leads - only counts leads that are
 * currently callable (within 8 AM - 9 PM in the lead's timezone)
 */
export async function countCallableLeads(
  _supabaseClient: any,
  agentEmail: string
): Promise<number> {
  try {
    const email = String(agentEmail || "").trim().toLowerCase();
    if (!email) return 0;

    const r = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM masterlead
       WHERE LOWER(TRIM(COALESCE(cn_email, ''))) = $1
         AND COALESCE(dnc::text, 'false') IN ('false', 'f', '0', '')
         AND (
           taalk_market IS NULL
           OR LOWER(TRIM(taalk_market)) NOT IN ('plus lead', 'plus leads')
         )
        AND COALESCE("TaalkResolve"::text, '') NOT IN ('true', '1')
         AND (
           cnresolution IS NULL
           OR LOWER(TRIM(cnresolution)) IN ('pending', 'called', 'no_answer_vm', 'new')
         )`,
      [email],
    );
    return Number(r.rows[0]?.c || 0);
  } catch (error) {
    console.error(`❌ Error in countCallableLeads for ${agentEmail}:`, error);
    return 0;
  }
}

/**
 * Count pending verification sessions for an agent
 * This is used to determine if an agent has too many pending verification sessions
 * Similar to countCallableLeads but for verification sessions (no timezone restriction needed)
 */
export async function countPendingVerificationSessions(
  supabaseClient: any,
  agentEmail: string
): Promise<number> {
  try {
    const normalizedEmail = agentEmail.toLowerCase();
    
    // Count pending/in_progress verification sessions for this agent
    // Check both agent_email and company_email fields
    const { count, error } = await supabaseClient
      .from('verification_sessions')
      .select('*', { count: 'exact', head: true })
      .or(`agent_email.eq.${normalizedEmail},company_email.eq.${normalizedEmail}`)
      .in('status', ['pending', 'in_progress'])
      .neq('session_type', 'demo'); // Exclude demo sessions

    if (error) {
      console.error(`❌ Error counting pending verification sessions for ${agentEmail}:`, error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error(`❌ Error in countPendingVerificationSessions for ${agentEmail}:`, error);
    return 0;
  }
}

