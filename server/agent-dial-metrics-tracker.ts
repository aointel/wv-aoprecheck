/**
 * AGENT DIAL METRICS TRACKER
 * 
 * This module logs dial/reach/booked metrics to a separate table (agent_dial_metrics)
 * that is independent of masterlead. This allows cleaning up and reassigning leads
 * in masterlead without losing historical tracking data.
 * 
 * CRITICAL: This is the source of truth for agent performance metrics across date ranges.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { checkTimeout, checkAnomaly, recordViolation, resolveExpiredTimeouts } from './agent-anomaly-detector';
import { existsRecentDialMetricLocal, insertAgentDialMetricLocal, incrementAgentDailyStat } from './local-hot-tables';

export interface DialMetricParams {
  agentEmail: string;
  agentName?: string;
  leadId?: number | null;
  leadPhone: string;
  leadName?: string;
  leadState?: string;
  eventType: 'dial' | 'reach' | 'booked' | 'instant_presentation';
  callDuration?: number;
  callStatus?: string;
  disposition?: string;
  callSid?: string;
  source?: string;
  notes?: string;
  eventTimestamp?: string; // ISO timestamp, defaults to now
}

/**
 * Log a dial/reach/booked event to agent_dial_metrics table
 */
export async function logDialMetric(
  _supabase: SupabaseClient,
  params: DialMetricParams
): Promise<void> {
  try {
    const {
      agentEmail,
      agentName,
      leadId,
      leadPhone,
      leadName,
      leadState,
      eventType,
      callDuration,
      callStatus,
      disposition,
      callSid,
      source = 'dialer',
      notes,
      eventTimestamp
    } = params;

    // Validate required fields
    if (!agentEmail || !leadPhone || !eventType) {
      console.error('❌ Missing required fields for dial metric:', { agentEmail, leadPhone, eventType });
      return;
    }

    // Normalize phone number (remove non-digits)
    const cleanPhone = leadPhone.replace(/\D/g, '');
    
    // Validate phone number after cleaning
    if (!cleanPhone || cleanPhone.length < 10) {
      console.error(`❌ Invalid phone number after cleaning: ${leadPhone} -> ${cleanPhone}`);
      return;
    }

    const insertData = {
      agent_email: agentEmail.toLowerCase().trim(),
      agent_name: agentName?.trim() || null,
      lead_id: leadId || null,
      lead_phone: cleanPhone,
      lead_name: leadName?.trim() || null,
      lead_state: leadState?.trim().toUpperCase() || null,
      event_type: eventType,
      event_timestamp: eventTimestamp || new Date().toISOString(),
      // CRITICAL: Only set call_duration if it's a valid positive number
      // If callDuration is 0, null, or undefined, set to null (don't use 0)
      call_duration: (callDuration && callDuration > 0) ? callDuration : null,
      call_status: callStatus || null,
      disposition: disposition?.trim().toLowerCase() || null,
      call_sid: callSid?.trim() || null,
      source: source.trim().toLowerCase() || 'dialer',
      notes: notes?.trim() || null,
    };

    console.log(`🔍 Attempting to insert dial metric:`, {
      agent_email: insertData.agent_email,
      event_type: insertData.event_type,
      lead_phone: insertData.lead_phone,
      source: insertData.source
    });

    // CRITICAL: Check if this exact event already exists in the last hour (prevent duplicates)
    // Each phone number can only have ONE of each event type per agent per hour
    // This applies to: dial, reach, booked (NOT instant_presentation - those can have multiple)
    if (eventType === 'dial' || eventType === 'reach' || eventType === 'booked') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      try {
        const localDuplicate = await existsRecentDialMetricLocal({
          agentEmail: insertData.agent_email,
          eventType,
          leadPhone: cleanPhone,
          sinceIso: oneHourAgo,
        });
        if (localDuplicate) {
          console.log(`⚠️ DUPLICATE ${eventType} event prevented (local): ${insertData.agent_email} -> ${cleanPhone} (already exists in last hour)`);
          return;
        }
      } catch (localCheckErr) {
        console.error(`❌ Local duplicate check failed for ${eventType}; skipped supabase fallback due to EOD-only mode:`, localCheckErr);
      }
    }

    // Throttling removed - agents must start a call first, so throttling is no longer needed

    // CRITICAL VALIDATION: Block invalid events at the database insert level
    // This is a final safety net - certain dispositions MUST have call_sid and duration
    
    // Dispositions that require call validation (must have call_sid and duration >= 30s)
    const dispositionsRequiringCall = [
      'booked', 'not_interested', 'sale', 'callback', 'call_back', 'appointment_set', 'appointment',
      'instant_presentation', 'already_been_sold', 'medically_uninsurable', 'duplicate', 'over_age',
      'dnc', 'do_not_call', 'do-not-call', 'do not call'
    ];
    
    const dispositionLower = insertData.disposition?.toLowerCase() || '';
    const requiresCallValidation = eventType === 'booked' || 
                                   eventType === 'reach' ||
                                   dispositionsRequiringCall.includes(dispositionLower);
    
    // Exempt dispositions that can legitimately have no duration (no_answer, wrong_number)
    const exemptDispositions = ['no_answer', 'no_answer_vm', 'no_answer_voicemail', 'wrong_number', 'wrong number', 'bad_number'];
    const isExempt = exemptDispositions.includes(dispositionLower);
    
    // CRITICAL: Block ALL event types if duration is null/0
    // reach/booked require duration (must have actually connected). dials do not.
    const eventTypesRequiringDuration = ['reach', 'booked', 'instant_presentation'];
    if (eventTypesRequiringDuration.includes(eventType) && (!callDuration || callDuration <= 0)) {
      console.error(`❌ BLOCKED: Cannot log ${eventType} event without duration. Agent: ${agentEmail}, Phone: ${cleanPhone}, Duration: ${callDuration}`);
      return;
    }
    
    // CRITICAL: Block certain dispositions if duration is null/0 (even for 'dial' events)
    const dispositionsRequiringDuration = [
      'booked', 'appointment', 'appointment_set', 'callback', 'call_back',
      'instant_presentation', 'sale', 'not_interested', 'already_been_sold',
      'medically_uninsurable', 'duplicate', 'over_age', 'dnc', 'do_not_call'
    ];
    if (dispositionsRequiringDuration.includes(dispositionLower) && 
        !exemptDispositions.includes(dispositionLower) &&
        (!callDuration || callDuration <= 0)) {
      console.error(`❌ BLOCKED: Cannot log ${eventType} event with disposition ${disposition} without duration. Agent: ${agentEmail}, Phone: ${cleanPhone}, Duration: ${callDuration}`);
      return; // Don't insert the record
    }

    // Insert into agent_dial_metrics + increment agent_daily_stats atomically
    try {
      const insertedId = await insertAgentDialMetricLocal(insertData as Record<string, unknown>);
      if (!insertedId) {
        console.warn(`⚠️ Skipped ${eventType} metric local write for ${agentEmail} (db cooldown/timeout)`);
        return;
      }
      console.log(`✅ SUCCESSFULLY logged ${eventType} metric (local): ${agentEmail} -> ${cleanPhone}`);
      // Increment the real-time daily stats counter — fire and forget
      void incrementAgentDailyStat(
        agentEmail,
        eventType as 'dial' | 'reach' | 'booked' | 'instant_presentation',
      ).catch(e =>
        console.warn(`⚠️ incrementAgentDailyStat failed (non-critical):`, e?.message)
      );
    } catch (localInsertErr) {
      console.error(`❌ FAILED to log ${eventType} metric locally for ${agentEmail}:`, localInsertErr);
    }
  } catch (error) {
    console.error('❌ Error logging dial metric:', error);
    // Don't throw errors - this is non-blocking logging
  }
}

/**
 * Validate booking throttle to prevent gaming the system
 * Returns { allowed: boolean, reason: string }
 */
async function validateBookingThrottle(
  supabase: SupabaseClient,
  agentEmail: string,
  leadPhone: string,
  eventTimestamp: string,
  callDuration: number | null | undefined
): Promise<{ allowed: boolean; reason: string }> {
  try {
    // NOTE: Removed strict duration requirement - if disposition says "booked", trust it
    // Duration validation can be added back if needed, but it was blocking legitimate bookings
    // The throttle now focuses on rate limiting and suspicious patterns, not duration

    // 2. Check if there was a recent dial event for this phone (can't book within 30 seconds of dialing)
    const eventTime = new Date(eventTimestamp);
    const minTimeBetweenDialAndBook = 30 * 1000; // 30 seconds in milliseconds
    const earliestAllowedBookTime = new Date(eventTime.getTime() - minTimeBetweenDialAndBook);

    const { data: recentDial, error: dialError } = await supabase
      .from('agent_dial_metrics')
      .select('event_timestamp, call_duration')
      .eq('agent_email', agentEmail)
      .eq('lead_phone', leadPhone)
      .eq('event_type', 'dial')
      .gte('event_timestamp', earliestAllowedBookTime.toISOString())
      .lt('event_timestamp', eventTime.toISOString())
      .order('event_timestamp', { ascending: false })
      .limit(1);

    if (!dialError && recentDial && recentDial.length > 0) {
      const dialTime = new Date(recentDial[0].event_timestamp);
      const timeSinceDial = eventTime.getTime() - dialTime.getTime();
      
      if (timeSinceDial < minTimeBetweenDialAndBook) {
        return { 
          allowed: false, 
          reason: `Booking too soon after dial: ${Math.round(timeSinceDial / 1000)}s (minimum 30s required)` 
        };
      }
    }

    // 3. Rate limiting: Check combined bookings + callbacks in the last hour (max 5 combined per hour)
    const oneHourAgo = new Date(eventTime.getTime() - 60 * 60 * 1000);
    const callbackDispositions = ['callback', 'callback_scheduled', 'call_back'];
    
    // Count booked events
    // CRITICAL: Count by DISPOSITION field, not event_type (many records have event_type='dial' with disposition='booked')
    // Count ALL booking-related dispositions, not just 'booked'
    const bookedDispositions = ['appointment', 'appointment_set', 'set_appointment', 'booked', 'qualified', 'callback_scheduled', 'instant_presentation', 'sale', 'meet'];
    const { data: recentBookings, error: bookingError } = await supabase
      .from('agent_dial_metrics')
      .select('id')
      .eq('agent_email', agentEmail)
      .in('disposition', bookedDispositions)
      .gte('event_timestamp', oneHourAgo.toISOString())
      .lt('event_timestamp', eventTime.toISOString());

    // Count callback events
    const { data: recentCallbacks, error: callbackError } = await supabase
      .from('agent_dial_metrics')
      .select('id')
      .eq('agent_email', agentEmail)
      .in('disposition', callbackDispositions)
      .gte('event_timestamp', oneHourAgo.toISOString())
      .lt('event_timestamp', eventTime.toISOString());

    const bookedCount = (!bookingError && recentBookings) ? recentBookings.length : 0;
    const callbackCount = (!callbackError && recentCallbacks) ? recentCallbacks.length : 0;
    const combinedCount = bookedCount + callbackCount;

    if (combinedCount >= 8) {
      return { 
        allowed: false, 
        reason: `Combined booking/callback rate limit exceeded: ${combinedCount} total (${bookedCount} booked + ${callbackCount} callback) in the last hour (max 8 combined/hour)` 
      };
    }

    // 4. Check for suspicious pattern: too many bookings in short time window (last 10 minutes)
    const tenMinutesAgo = new Date(eventTime.getTime() - 10 * 60 * 1000);
    const { data: recentBookings10min, error: booking10minError } = await supabase
      .from('agent_dial_metrics')
      .select('id')
      .eq('agent_email', agentEmail)
      .eq('event_type', 'booked')
      .gte('event_timestamp', tenMinutesAgo.toISOString())
      .lt('event_timestamp', eventTime.toISOString());

    if (!booking10minError && recentBookings10min && recentBookings10min.length >= 10) {
      return { 
        allowed: false, 
        reason: `Suspicious pattern detected: ${recentBookings10min.length} bookings in last 10 minutes (max 10/10min)` 
      };
    }

    return { allowed: true, reason: 'Validation passed' };
  } catch (error) {
    console.error('❌ Error in validateBookingThrottle:', error);
    // On error, allow the booking (fail open) but log the error
    return { allowed: true, reason: 'Validation error (allowed by default)' };
  }
}

/**
 * Validate reach throttle to prevent gaming the system
 * Returns { allowed: boolean, reason: string }
 */
async function validateReachThrottle(
  supabase: SupabaseClient,
  agentEmail: string,
  leadPhone: string,
  eventTimestamp: string
): Promise<{ allowed: boolean; reason: string }> {
  try {
    const eventTime = new Date(eventTimestamp);
    const normalizedEmail = agentEmail.toLowerCase().trim();

    // 1. Rate limiting: Check reach events in the last hour (max 20 per hour)
    const oneHourAgo = new Date(eventTime.getTime() - 60 * 60 * 1000);
    const { data: recentReaches1hr, error: hourError } = await supabase
      .from('agent_dial_metrics')
      .select('id')
      .eq('agent_email', normalizedEmail)
      .eq('event_type', 'reach')
      .gte('event_timestamp', oneHourAgo.toISOString())
      .lt('event_timestamp', eventTime.toISOString());

    if (!hourError && recentReaches1hr && recentReaches1hr.length >= 20) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${recentReaches1hr.length} reach events in the last hour (max 20/hour)`
      };
    }

    // 2. Rate limiting: Check reach events today (max 50 per day)
    const { todayStart, todayEnd } = await getTodayPSTRange(supabase);
    const { data: todayReaches, error: todayError } = await supabase
      .from('agent_dial_metrics')
      .select('id')
      .eq('agent_email', normalizedEmail)
      .eq('event_type', 'reach')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd);

    if (!todayError && todayReaches && todayReaches.length >= 50) {
      return {
        allowed: false,
        reason: `Daily limit exceeded: ${todayReaches.length} reach events today (max 50/day)`
      };
    }

    return { allowed: true, reason: '' };
  } catch (error) {
    console.error('❌ Error in validateReachThrottle:', error);
    // On error, allow the reach event (fail open)
    return { allowed: true, reason: 'Error checking throttle' };
  }
}

/**
 * Validate disposition throttle to prevent rapid farming
 * Returns { allowed: boolean, reason: string }
 * Excludes "no_answer" and "called" from throttling
 */
async function validateDispositionThrottle(
  supabase: SupabaseClient,
  agentEmail: string,
  leadPhone: string,
  leadId: number | null,
  disposition: string,
  eventTimestamp: string
): Promise<{ allowed: boolean; reason: string }> {
  try {
    const eventTime = new Date(eventTimestamp);
    const normalizedEmail = agentEmail.toLowerCase().trim();
    const cleanPhone = leadPhone.replace(/\D/g, '');

    // Define disposition arrays at the top for reuse throughout the function
    const bookedDispositions = ['appointment', 'booked', 'qualified', 'callback_scheduled', 'instant_presentation', 'sale', 'meet'];
    const callbackDispositions = ['callback', 'callback_scheduled', 'call_back'];

    // NOTE: Duplicate dispositions on same lead are now allowed (excluded from throttling)
    // This allows agents to correct mistakes or update dispositions on the same lead

    // 1. CRITICAL: For "booked" dispositions, check if this exact lead was already booked today
    // Check ALL booking-related dispositions, not just 'booked'
    if (bookedDispositions.includes(disposition.toLowerCase())) {
      const { todayStart, todayEnd } = await getTodayPSTRange(supabase);
      const { data: existingBookings, error: bookingCheckError } = await supabase
        .from('agent_dial_metrics')
        .select('id, event_timestamp')
        .eq('agent_email', normalizedEmail)
        .in('disposition', bookedDispositions)
        .eq('lead_phone', cleanPhone)
        .gte('event_timestamp', todayStart)
        .lt('event_timestamp', todayEnd)
        .order('event_timestamp', { ascending: false })
        .limit(1);

      if (!bookingCheckError && existingBookings && existingBookings.length > 0) {
        const lastBookingTime = new Date(existingBookings[0].event_timestamp);
        const timeSinceLastBooking = eventTime.getTime() - lastBookingTime.getTime();
        // Block if same lead was booked within last 5 minutes
        if (timeSinceLastBooking < 5 * 60 * 1000) {
          return {
            allowed: false,
            reason: `This lead was already booked ${Math.round(timeSinceLastBooking / 1000)}s ago. Cannot book the same lead again within 5 minutes.`
          };
        }
      }
    }

    // 1b. CRITICAL: For "callback" dispositions, check if this exact lead was already marked as callback today
    if (callbackDispositions.includes(disposition.toLowerCase())) {
      const { todayStart, todayEnd } = await getTodayPSTRange(supabase);
      const { data: existingCallbacks, error: callbackCheckError } = await supabase
        .from('agent_dial_metrics')
        .select('id, event_timestamp, disposition')
        .eq('agent_email', normalizedEmail)
        .eq('lead_phone', cleanPhone)
        .in('disposition', callbackDispositions)
        .gte('event_timestamp', todayStart)
        .lt('event_timestamp', todayEnd)
        .order('event_timestamp', { ascending: false })
        .limit(1);

      if (!callbackCheckError && existingCallbacks && existingCallbacks.length > 0) {
        const lastCallbackTime = new Date(existingCallbacks[0].event_timestamp);
        const timeSinceLastCallback = eventTime.getTime() - lastCallbackTime.getTime();
        // Block if same lead was marked as callback within last 5 minutes
        if (timeSinceLastCallback < 5 * 60 * 1000) {
          return {
            allowed: false,
            reason: `This lead was already marked as callback ${Math.round(timeSinceLastCallback / 1000)}s ago. Cannot mark the same lead as callback again within 5 minutes.`
          };
        }
      }
    }

    // 2. Check minimum time after dial for callbacks (must be at least 15 seconds after dial)
    if (callbackDispositions.includes(disposition.toLowerCase())) {
      const minTimeBetweenDialAndCallback = 15 * 1000; // 15 seconds
      const earliestAllowedCallbackTime = new Date(eventTime.getTime() - minTimeBetweenDialAndCallback);
      
      const { data: recentDial, error: dialError } = await supabase
        .from('agent_dial_metrics')
        .select('event_timestamp')
        .eq('agent_email', normalizedEmail)
        .eq('lead_phone', cleanPhone)
        .eq('event_type', 'dial')
        .gte('event_timestamp', earliestAllowedCallbackTime.toISOString())
        .lt('event_timestamp', eventTime.toISOString())
        .order('event_timestamp', { ascending: false })
        .limit(1);

      if (!dialError && recentDial && recentDial.length > 0) {
        const dialTime = new Date(recentDial[0].event_timestamp);
        const timeSinceDial = eventTime.getTime() - dialTime.getTime();
        
        if (timeSinceDial < minTimeBetweenDialAndCallback) {
          return {
            allowed: false,
            reason: `Callback too soon after dial: ${Math.round(timeSinceDial / 1000)}s (minimum 15s required)`
          };
        }
      }
    }

    // 3. Rate limiting: Check dispositions in the last minute (max 1 per minute)
    const oneMinuteAgo = new Date(eventTime.getTime() - 60 * 1000);
    const excludedDispositions = ['no_answer', 'no_answer_vm', 'called', 'wrong_number'];
    const { data: recentDispositions1min, error: minError } = await supabase
      .from('agent_dial_metrics')
      .select('id')
      .eq('agent_email', normalizedEmail)
      .not('disposition', 'is', null)
      .not('disposition', 'in', excludedDispositions)
      .gte('event_timestamp', oneMinuteAgo.toISOString())
      .lt('event_timestamp', eventTime.toISOString());

    if (!minError && recentDispositions1min && recentDispositions1min.length >= 1) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${recentDispositions1min.length} dispositions in the last minute (max 1/min)`
      };
    }

    // 3. Rate limiting: Check dispositions in the last hour
    // CRITICAL: "booked" and "callback" share a combined limit of 8 per hour
    const oneHourAgo = new Date(eventTime.getTime() - 60 * 60 * 1000);
    // Reuse bookedDispositions and callbackDispositions already declared above
    const allBookedOrCallbackDispositions = [...bookedDispositions, ...callbackDispositions];
    const isBookedOrCallback = allBookedOrCallbackDispositions.includes(disposition.toLowerCase());
    
    if (isBookedOrCallback) {
      // Check combined count of booked + callback events in the last hour
      // CRITICAL: Count by DISPOSITION field, not event_type (many records have event_type='dial' with disposition='booked')
      // Count ALL booking-related dispositions, not just 'booked'
      const { data: recentBooked1hr, error: bookedHourError } = await supabase
        .from('agent_dial_metrics')
        .select('id')
        .eq('agent_email', normalizedEmail)
        .in('disposition', bookedDispositions)
        .gte('event_timestamp', oneHourAgo.toISOString())
        .lt('event_timestamp', eventTime.toISOString());

      const { data: recentCallbacks1hr, error: callbackHourError } = await supabase
        .from('agent_dial_metrics')
        .select('id')
        .eq('agent_email', normalizedEmail)
        .in('disposition', callbackDispositions)
        .gte('event_timestamp', oneHourAgo.toISOString())
        .lt('event_timestamp', eventTime.toISOString());

      const bookedCount = (!bookedHourError && recentBooked1hr) ? recentBooked1hr.length : 0;
      const callbackCount = (!callbackHourError && recentCallbacks1hr) ? recentCallbacks1hr.length : 0;
      const combinedCount = bookedCount + callbackCount;

      if (combinedCount >= 8) {
        const dispositionType = disposition.toLowerCase() === 'booked' ? 'bookings' : 'callbacks';
        return {
          allowed: false,
          reason: `Combined booking/callback rate limit exceeded: ${combinedCount} total (${bookedCount} booked + ${callbackCount} callback) in the last hour (max 8 combined/hour)`
        };
      }
    }
    
    // General disposition limit (non-booked, non-callback dispositions)
    const { data: recentDispositions1hr, error: hourError } = await supabase
      .from('agent_dial_metrics')
      .select('id')
      .eq('agent_email', normalizedEmail)
      .not('disposition', 'is', null)
      .not('disposition', 'in', excludedDispositions)
      .neq('disposition', 'booked') // Exclude booked from general count
      .not('disposition', 'in', callbackDispositions) // Exclude callbacks from general count
      .gte('event_timestamp', oneHourAgo.toISOString())
      .lt('event_timestamp', eventTime.toISOString());

    if (!hourError && recentDispositions1hr && recentDispositions1hr.length >= 10) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${recentDispositions1hr.length} dispositions in the last hour (max 10/hour)`
      };
    }

    return { allowed: true, reason: 'Validation passed' };
  } catch (error) {
    console.error('❌ Error in validateDispositionThrottle:', error);
    // On error, allow the disposition (fail open) but log the error
    return { allowed: true, reason: 'Validation error (allowed by default)' };
  }
}

/**
 * Get today's EST date range using database function
 * Falls back to simple calculation if RPC fails
 */
async function getTodayPSTRange(supabase: SupabaseClient): Promise<{ todayStart: string; todayEnd: string }> {
  try {
    // Try to use database function for accurate EST calculation
    const { data, error } = await supabase.rpc('get_today_est_range');
    
    if (!error && data && data.length > 0) {
      return {
        todayStart: data[0].today_start,
        todayEnd: data[0].today_end
      };
    }
  } catch (err) {
    console.warn('⚠️ Could not use RPC for EST range, using fallback');
  }
  
  // Fallback: approximate calculation (EST is UTC-5, EDT is UTC-4)
  const now = new Date();
  const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const utcNow = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  
  // Calculate offset
  const offsetMs = utcNow.getTime() - estNow.getTime();
  
  // Get start of today in EST, then convert to UTC
  const estTodayStart = new Date(estNow);
  estTodayStart.setHours(0, 0, 0, 0);
  const utcTodayStart = new Date(estTodayStart.getTime() + offsetMs);
  
  const utcTodayEnd = new Date(utcTodayStart.getTime() + 24 * 60 * 60 * 1000);
  
  return {
    todayStart: utcTodayStart.toISOString(),
    todayEnd: utcTodayEnd.toISOString()
  };
}

/**
 * Determine if a disposition qualifies as "reached" (human contact)
 * CRITICAL: Also requires call_status = 'completed' to count as reached
 */
export function isReachedDisposition(disposition: string | null | undefined, duration?: number, callStatus?: string | null): boolean {
  // VALIDATION REMOVED: Frontend controls which dispositions are available
  // If disposition indicates reached, trust it regardless of callStatus
  
  if (!disposition) {
    // No disposition - if we have duration > 0, consider it reached
    if (duration !== undefined && duration !== null && duration > 0) {
      return true;
    }
    return false;
  }
  
  const disp = disposition.toLowerCase().trim();
  
  // These dispositions indicate human contact
  const reachedDispositions = [
    'contacted', 'connected', 'talked', 'qualified', 'interested', 
    'not_interested', 'transfer', 'appointment', 'booked', 
    'callback_scheduled', 'call_back', 'callback', 'sale', 'instant_presentation'
  ];
  
  // These dispositions indicate no human contact - NEVER count as reached
  const notReachedDispositions = [
    'no_answer', 'busy', 'failed', 'voicemail', 'bad_number',
    'no_answer_vm', 'no_answer_voicemail', 'wrong_number', 'wrong number'
  ];
  
  // CRITICAL: Check this FIRST - wrong numbers should NEVER be counted as reached
  if (notReachedDispositions.includes(disp)) {
    return false;
  }
  
  if (reachedDispositions.includes(disp)) {
    // CRITICAL: Require duration > 0 to count as reached
    // This prevents logging reach events when call_duration is null or 0
    // Even if disposition says "reached", we need actual call duration
    if (duration !== undefined && duration !== null && duration > 0) {
      return true;
    }
    // If disposition says reached but duration is null/0, don't count it
    console.warn(`⚠️ Skipping reach: disposition=${disp} but duration=${duration} (null or 0)`);
    return false;
  }
  
  // Default: if we have a disposition that's not in notReachedDispositions, and duration > 0, consider it reached
  if (duration !== undefined && duration !== null && duration > 0) {
    return true;
  }
  
  return false;
}

/**
 * Determine if a disposition qualifies as "booked" (appointment set)
 */
export function isBookedDisposition(disposition: string | null | undefined, duration?: number): boolean {
  if (!disposition) return false;
  
  const disp = disposition.toLowerCase().trim();
  
  // These dispositions indicate booking/appointment
  const bookedDispositions = [
    'appointment', 'appointment_set', 'set_appointment', 'booked', 'qualified', 'callback_scheduled',
    'instant_presentation', 'sale', 'meet'
  ];
  
  if (bookedDispositions.includes(disp)) {
    // CRITICAL: Require duration > 0 to count as booked
    // This prevents logging booked events when call_duration is null or 0
    // Even if disposition says "booked", we need actual call duration
    if (duration !== undefined && duration !== null && duration > 0) {
      return true;
    }
    // If disposition says booked but duration is null/0, don't count it
    console.warn(`⚠️ Skipping booked: disposition=${disp} but duration=${duration} (null or 0)`);
    return false;
  }
  
  // Special case: "interested" with duration >= 60 seconds
  if (disp === 'interested' && duration !== undefined && duration !== null && duration > 0) {
    return duration >= 60;
  }
  
  return false;
}

/**
 * Log multiple events based on call outcome
 * - Always logs "dial" if contact was attempted
 * - Logs "reach" if human contact was made
 * - Logs "booked" if appointment was set
 * 
 * Throws an error if throttling blocks the disposition (so API can return error to frontend)
 */
export async function logCallOutcome(
  supabase: SupabaseClient,
  params: Omit<DialMetricParams, 'eventType'> & {
    disposition?: string | null;
    callDuration?: number | null;
  }
): Promise<void> {
  const { disposition, callDuration: providedDuration, ...baseParams } = params;
  
  // STATISTICAL ANOMALY DETECTION: Check timeout and anomalies before logging
  try {
    // Resolve expired timeouts first
    await resolveExpiredTimeouts(supabase);
    
    // Check if agent is timed out
    const timeoutStatus = await checkTimeout(supabase, baseParams.agentEmail);
    if (timeoutStatus.isTimedOut) {
      const remainingMinutes = timeoutStatus.remainingSeconds 
        ? Math.ceil(timeoutStatus.remainingSeconds / 60) 
        : 0;
      throw new Error(
        `⏸️ You've been temporarily paused for ${remainingMinutes} minute(s) due to unusual activity patterns. Timeout expires at ${timeoutStatus.timeoutUntil ? new Date(timeoutStatus.timeoutUntil).toLocaleString() : 'unknown'}.`
      );
    }
    
    // If disposition is provided, check for anomalies
    if (disposition) {
      // 1. Check disposition frequency (dispositions per hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: dispositionCount } = await supabase
        .from('agent_dial_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('agent_email', baseParams.agentEmail.toLowerCase().trim())
        .not('disposition', 'is', null)
        .gte('event_timestamp', oneHourAgo);
      
      if (dispositionCount !== null && dispositionCount > 0) {
        const anomalyCheck = await checkAnomaly(
          supabase,
          baseParams.agentEmail,
          'disposition_frequency',
          dispositionCount + 1 // Include current disposition
        );
        
        if (anomalyCheck.isAnomaly) {
          const { actionTaken } = await recordViolation(
            supabase,
            baseParams.agentEmail,
            'disposition_frequency',
            dispositionCount + 1,
            {
              lead_id: baseParams.leadId,
              lead_phone: baseParams.leadPhone,
              disposition,
              call_sid: baseParams.callSid,
            }
          );
          
          if (actionTaken !== 'warning') {
            // Timeout applied - block the action
            throw new Error(
              `⏸️ Disposition frequency anomaly detected. Action blocked due to timeout.`
            );
          } else {
            // Warning only - allow to proceed but log
            console.warn(`⚠️ Disposition frequency anomaly detected for ${baseParams.agentEmail}: ${dispositionCount + 1} dispositions/hour (baseline deviation: ${anomalyCheck.deviation.toFixed(2)})`);
          }
        }
      }
      
      // 2. Check action interval (time between dial and disposition)
      if (providedDuration && providedDuration > 0) {
        // Find the most recent dial event for this phone
        const { data: recentDial } = await supabase
          .from('agent_dial_metrics')
          .select('event_timestamp')
          .eq('agent_email', baseParams.agentEmail.toLowerCase().trim())
          .eq('lead_phone', baseParams.leadPhone.replace(/\D/g, ''))
          .eq('event_type', 'dial')
          .order('event_timestamp', { ascending: false })
          .limit(1);
        
        if (recentDial && recentDial.length > 0) {
          const dialTime = new Date(recentDial[0].event_timestamp);
          const now = new Date();
          const intervalSeconds = (now.getTime() - dialTime.getTime()) / 1000;
          
          if (intervalSeconds > 0 && intervalSeconds < 3600) { // Valid interval, less than 1 hour
            const intervalCheck = await checkAnomaly(
              supabase,
              baseParams.agentEmail,
              'action_interval',
              intervalSeconds
            );
            
            if (intervalCheck.isAnomaly && intervalCheck.deviation < -1.0) {
              // Too fast (negative deviation means below mean)
              const { actionTaken } = await recordViolation(
                supabase,
                baseParams.agentEmail,
                'action_interval',
                intervalSeconds,
                {
                  lead_id: baseParams.leadId,
                  lead_phone: baseParams.leadPhone,
                  disposition,
                  call_sid: baseParams.callSid,
                }
              );
              
              if (actionTaken !== 'warning') {
                throw new Error(
                  `⏸️ Action interval anomaly detected (disposition applied too quickly). Action blocked due to timeout.`
                );
              } else {
                console.warn(`⚠️ Action interval anomaly detected: ${intervalSeconds.toFixed(1)}s between dial and disposition (baseline deviation: ${intervalCheck.deviation.toFixed(2)})`);
              }
            }
          }
        }
      }
      
      // 3. Check call duration anomaly (if duration provided)
      if (providedDuration && providedDuration > 0) {
        const durationCheck = await checkAnomaly(
          supabase,
          baseParams.agentEmail,
          'call_duration',
          providedDuration
        );
        
        if (durationCheck.isAnomaly) {
          // Only warn on very short calls (negative deviation)
          if (durationCheck.deviation < -1.0) {
            const { actionTaken } = await recordViolation(
              supabase,
              baseParams.agentEmail,
              'call_duration',
              providedDuration,
              {
                lead_id: baseParams.leadId,
                lead_phone: baseParams.leadPhone,
                disposition,
                call_sid: baseParams.callSid,
              }
            );
            
            if (actionTaken !== 'warning') {
              throw new Error(
                `⏸️ Call duration anomaly detected (unusually short call). Action blocked due to timeout.`
              );
            } else {
              console.warn(`⚠️ Call duration anomaly detected: ${providedDuration}s (baseline deviation: ${durationCheck.deviation.toFixed(2)})`);
            }
          }
        }
      }
    }
  } catch (error) {
    // Re-throw timeout/anomaly errors to block the action
    if (error instanceof Error && error.message.includes('⏸️')) {
      throw error;
    }
    // Log other errors but don't block
    console.error('❌ Error in anomaly detection (non-blocking):', error);
  }
  
  // Frontend handles duration tracking and passes it to backend
  // CRITICAL: Treat 0 as null (no valid call duration)
  // Frontend should only send duration > 0 for actual calls
  const realCallDuration = (providedDuration && providedDuration > 0) ? providedDuration : null;
  
  console.log(`📞 logCallOutcome called: agent=${baseParams.agentEmail}, phone=${baseParams.leadPhone}, disposition=${disposition || 'null'}, duration=${realCallDuration || 'null'} (provided: ${providedDuration || 'null'})`);
  
  // Always log a dial — no-answer/voicemail calls have duration 0 and still count as dials
  await logDialMetric(supabase, {
    ...baseParams,
    eventType: 'dial',
    disposition,
    callDuration: realCallDuration || 0,
  });
  
    // CRITICAL RULE: ANY call with duration > 55 seconds = REACH (regardless of disposition)
    // Agents are incorrectly using "no_answer_vm" for calls with human contact
    // Voicemails rarely last > 55 seconds, so long calls definitely had human contact
    let isReached = false;
    
    if (realCallDuration && realCallDuration > 55) {
      // DURATION > 55 SECONDS = AUTOMATIC REACH (OVERRIDES DISPOSITION)
      console.log(`🎯 AUTOMATIC REACH: Duration=${realCallDuration}s > 55s - counting as reached (disposition: ${disposition || 'null'} is ignored)`);
      isReached = true;
    } else {
      // For calls <= 55 seconds, use disposition-based logic
      isReached = isReachedDisposition(disposition, realCallDuration, baseParams.callStatus);
    }
    
    console.log(`🔍 isReached check: disposition=${disposition || 'null'}, duration=${realCallDuration || 'null'}, callStatus=${baseParams.callStatus || 'null'}, callSid=${baseParams.callSid || 'null'}, result=${isReached}`);
    
    // Log reach if human contact was made
    if (isReached) {
      console.log(`✅ LOGGING REACH EVENT: agent=${baseParams.agentEmail}, phone=${baseParams.leadPhone}, duration=${realCallDuration || 'null'}s`);
      await logDialMetric(supabase, {
        ...baseParams,
        eventType: 'reach',
        disposition,
        callDuration: realCallDuration,
      });
    }
  
  // Do not auto-log booked from disposition alone.
  // Booked appointment accounting must come from actual appointment records/reconciliation.
  const isBooked = isBookedDisposition(disposition, realCallDuration);
  console.log(`🔍 isBooked check (auto-log disabled): disposition=${disposition || 'null'}, duration=${realCallDuration || 'null'}, callSid=${baseParams.callSid || 'null'}, result=${isBooked}`);
  
  // Log instant_presentation if disposition is instant_presentation
  // TIMER DISABLED: No duration requirement - instant_presentation can be logged at any duration
  // CRITICAL: If instant_presentation is logged, ALWAYS also log a reach event (instant_presentation = reached)
  if (disposition && disposition.toLowerCase() === 'instant_presentation') {
    // Only require that we have a valid duration (not null/undefined) - no minimum time requirement
    if (realCallDuration !== undefined && realCallDuration !== null && realCallDuration > 0) {
      console.log(`⚡ LOGGING INSTANT_PRESENTATION EVENT: agent=${baseParams.agentEmail}, phone=${baseParams.leadPhone}, duration=${realCallDuration}s`);
      
      // CRITICAL: Always log reach event for instant_presentation (if not already logged above)
      // This ensures instant_presentation always counts as reached
      if (!isReached) {
        console.log(`✅ LOGGING REACH EVENT (from instant_presentation): agent=${baseParams.agentEmail}, phone=${baseParams.leadPhone}, duration=${realCallDuration}s`);
        await logDialMetric(supabase, {
          ...baseParams,
          eventType: 'reach',
          disposition,
          callDuration: realCallDuration,
        });
      }
      
      await logDialMetric(supabase, {
        ...baseParams,
        eventType: 'instant_presentation',
        disposition,
        callDuration: realCallDuration,
      });
    } else {
      console.warn(`⚠️ Skipping instant_presentation: disposition=instant_presentation but duration=${realCallDuration} (requires > 0 seconds)`);
    }
  }
}

