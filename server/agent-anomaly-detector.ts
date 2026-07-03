/**
 * STATISTICAL ANOMALY DETECTION SYSTEM
 * 
 * Replaces hard-coded throttling rules with statistical baselines calculated from
 * historical agent data. Detects anomalies when behavior exceeds 1 standard deviation
 * from the agent's own historical mean.
 * 
 * Features:
 * - Baseline calculation from 30-90 days of historical data
 * - Anomaly detection using 1 standard deviation threshold
 * - Progressive timeouts: warning → 10min → 1hr → 24hr
 * - Tracks violations and active timeouts
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { startOfDay } from 'date-fns';

export type MetricType = 'call_duration' | 'disposition_frequency' | 'completion_rate' | 'action_interval';
export type ActionTaken = 'warning' | 'timeout_10min' | 'timeout_1hr' | 'timeout_24hr';

export interface Baseline {
  agentEmail: string;
  metricType: MetricType;
  meanValue: number;
  stdDev: number;
  sampleSize: number;
  calculatedAt: string;
  dateRangeStart: string;
  dateRangeEnd: string;
}

export interface ViolationResult {
  isAnomaly: boolean;
  deviation: number; // How many std devs from mean
  baseline?: Baseline;
  currentValue: number;
}

export interface TimeoutStatus {
  isTimedOut: boolean;
  timeoutUntil?: string;
  timeoutType?: string;
  violationCount?: number;
  remainingSeconds?: number;
}

let agentTimeoutsTableUnavailable = false;

function isAgentTimeoutsMissing(error: unknown): boolean {
  const code = String((error as any)?.code || '').toUpperCase();
  const message = String((error as any)?.message || error || '').toLowerCase();
  return code === '42P01' || message.includes('relation "public.agent_timeouts" does not exist');
}

/**
 * Calculate mean and standard deviation from an array of numbers
 */
function calculateStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

/**
 * Calculate baselines for an agent from historical data
 * @param supabase Supabase client
 * @param agentEmail Agent email
 * @param dateRangeDays Number of days to look back (default 30-90)
 */
export async function calculateBaselines(
  supabase: SupabaseClient,
  agentEmail: string,
  dateRangeDays: number = 30
): Promise<Baseline[]> {
  try {
    const normalizedEmail = agentEmail.toLowerCase().trim();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRangeDays);

    console.log(`📊 Calculating baselines for ${normalizedEmail} (last ${dateRangeDays} days)`);

    const baselines: Baseline[] = [];

    // 1. Call Duration Baseline
    // Calculate from answered calls (call_duration > 0) with event_type = 'dial'
    const { data: callData, error: callError } = await supabase
      .from('agent_dial_metrics')
      .select('call_duration')
      .eq('agent_email', normalizedEmail)
      .eq('event_type', 'dial')
      .not('call_duration', 'is', null)
      .gt('call_duration', 0)
      .gte('event_timestamp', startDate.toISOString())
      .lt('event_timestamp', endDate.toISOString());

    if (!callError && callData && callData.length > 0) {
      const durations = callData
        .map(d => d.call_duration)
        .filter((d): d is number => d !== null && d !== undefined && d > 0);

      if (durations.length >= 10) { // Need at least 10 samples
        const { mean, stdDev } = calculateStats(durations);
        baselines.push({
          agentEmail: normalizedEmail,
          metricType: 'call_duration',
          meanValue: mean,
          stdDev: stdDev,
          sampleSize: durations.length,
          calculatedAt: new Date().toISOString(),
          dateRangeStart: startDate.toISOString(),
          dateRangeEnd: endDate.toISOString(),
        });
        console.log(`✅ Call duration baseline: mean=${mean.toFixed(2)}s, stdDev=${stdDev.toFixed(2)}s, samples=${durations.length}`);
      } else {
        console.log(`⚠️ Insufficient call duration data: ${durations.length} samples (need 10+)`);
      }
    }

    // 2. Disposition Frequency Baseline
    // Count dispositions per hour for last 30 days
    const { data: dispositionData, error: dispositionError } = await supabase
      .from('agent_dial_metrics')
      .select('event_timestamp, disposition')
      .eq('agent_email', normalizedEmail)
      .not('disposition', 'is', null)
      .gte('event_timestamp', startDate.toISOString())
      .lt('event_timestamp', endDate.toISOString())
      .order('event_timestamp', { ascending: true });

    if (!dispositionError && dispositionData && dispositionData.length > 0) {
      // Group by hour and count dispositions
      const hourlyCounts: { [hour: string]: number } = {};
      dispositionData.forEach(record => {
        const timestamp = new Date(record.event_timestamp);
        const hourKey = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}-${timestamp.getHours()}`;
        hourlyCounts[hourKey] = (hourlyCounts[hourKey] || 0) + 1;
      });

      const counts = Object.values(hourlyCounts);
      if (counts.length >= 10) {
        const { mean, stdDev } = calculateStats(counts);
        baselines.push({
          agentEmail: normalizedEmail,
          metricType: 'disposition_frequency',
          meanValue: mean,
          stdDev: stdDev,
          sampleSize: counts.length,
          calculatedAt: new Date().toISOString(),
          dateRangeStart: startDate.toISOString(),
          dateRangeEnd: endDate.toISOString(),
        });
        console.log(`✅ Disposition frequency baseline: mean=${mean.toFixed(2)}/hr, stdDev=${stdDev.toFixed(2)}/hr, samples=${counts.length}`);
      }
    }

    // 3. Completion Rate Baseline
    // Calculate calls completed vs dialed
    const { data: dialData, error: dialError } = await supabase
      .from('agent_dial_metrics')
      .select('event_type, call_duration')
      .eq('agent_email', normalizedEmail)
      .in('event_type', ['dial', 'reach'])
      .gte('event_timestamp', startDate.toISOString())
      .lt('event_timestamp', endDate.toISOString());

    if (!dialError && dialData) {
      // Group by day and calculate completion rate
      const dailyRates: number[] = [];
      const dailyData: { [day: string]: { dials: number; completed: number } } = {};

      dialData.forEach(record => {
        const timestamp = new Date(record.event_timestamp);
        const dayKey = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}`;
        if (!dailyData[dayKey]) {
          dailyData[dayKey] = { dials: 0, completed: 0 };
        }
        if (record.event_type === 'dial') {
          dailyData[dayKey].dials++;
        }
        if (record.event_type === 'reach' || (record.call_duration && record.call_duration > 0)) {
          dailyData[dayKey].completed++;
        }
      });

      Object.values(dailyData).forEach(day => {
        if (day.dials > 0) {
          dailyRates.push(day.completed / day.dials);
        }
      });

      if (dailyRates.length >= 10) {
        const { mean, stdDev } = calculateStats(dailyRates);
        baselines.push({
          agentEmail: normalizedEmail,
          metricType: 'completion_rate',
          meanValue: mean,
          stdDev: stdDev,
          sampleSize: dailyRates.length,
          calculatedAt: new Date().toISOString(),
          dateRangeStart: startDate.toISOString(),
          dateRangeEnd: endDate.toISOString(),
        });
        console.log(`✅ Completion rate baseline: mean=${(mean * 100).toFixed(2)}%, stdDev=${(stdDev * 100).toFixed(2)}%, samples=${dailyRates.length}`);
      }
    }

    // 4. Action Interval Baseline
    // Time between dial → disposition
    const { data: actionData, error: actionError } = await supabase
      .from('agent_dial_metrics')
      .select('event_timestamp, event_type, disposition, lead_phone')
      .eq('agent_email', normalizedEmail)
      .in('event_type', ['dial'])
      .not('disposition', 'is', null)
      .gte('event_timestamp', startDate.toISOString())
      .lt('event_timestamp', endDate.toISOString())
      .order('event_timestamp', { ascending: true });

    if (!actionError && actionData && actionData.length > 0) {
      const intervals: number[] = [];

      // For each dial, find the next disposition for the same phone
      for (let i = 0; i < actionData.length; i++) {
        const dial = actionData[i];
        const dialTime = new Date(dial.event_timestamp);

        // Find next disposition for same phone
        const nextDisposition = actionData.find((record, idx) => 
          idx > i && 
          record.lead_phone === dial.lead_phone &&
          record.disposition !== null
        );

        if (nextDisposition) {
          const dispositionTime = new Date(nextDisposition.event_timestamp);
          const intervalSeconds = (dispositionTime.getTime() - dialTime.getTime()) / 1000;
          if (intervalSeconds > 0 && intervalSeconds < 3600) { // Valid interval, less than 1 hour
            intervals.push(intervalSeconds);
          }
        }
      }

      if (intervals.length >= 10) {
        const { mean, stdDev } = calculateStats(intervals);
        baselines.push({
          agentEmail: normalizedEmail,
          metricType: 'action_interval',
          meanValue: mean,
          stdDev: stdDev,
          sampleSize: intervals.length,
          calculatedAt: new Date().toISOString(),
          dateRangeStart: startDate.toISOString(),
          dateRangeEnd: endDate.toISOString(),
        });
        console.log(`✅ Action interval baseline: mean=${mean.toFixed(2)}s, stdDev=${stdDev.toFixed(2)}s, samples=${intervals.length}`);
      }
    }

    // Store baselines in database
    for (const baseline of baselines) {
      const { error: insertError } = await supabase
        .from('agent_anomaly_baselines')
        .upsert({
          agent_email: baseline.agentEmail,
          metric_type: baseline.metricType,
          mean_value: baseline.meanValue,
          std_dev: baseline.stdDev,
          sample_size: baseline.sampleSize,
          calculated_at: baseline.calculatedAt,
          date_range_start: baseline.dateRangeStart,
          date_range_end: baseline.dateRangeEnd,
        }, {
          onConflict: 'agent_email,metric_type'
        });

      if (insertError) {
        console.error(`❌ Failed to store baseline for ${baseline.metricType}:`, insertError);
      }
    }

    console.log(`✅ Calculated ${baselines.length} baselines for ${normalizedEmail}`);
    return baselines;
  } catch (error) {
    console.error('❌ Error calculating baselines:', error);
    return [];
  }
}

/**
 * Check if a current value is an anomaly compared to baseline
 * @param supabase Supabase client
 * @param agentEmail Agent email
 * @param metricType Type of metric to check
 * @param currentValue Current value to check
 */
export async function checkAnomaly(
  supabase: SupabaseClient,
  agentEmail: string,
  metricType: MetricType,
  currentValue: number
): Promise<ViolationResult> {
  try {
    const normalizedEmail = agentEmail.toLowerCase().trim();

    // Fetch baseline
    const { data: baselineData, error } = await supabase
      .from('agent_anomaly_baselines')
      .select('*')
      .eq('agent_email', normalizedEmail)
      .eq('metric_type', metricType)
      .single();

    if (error || !baselineData) {
      // No baseline found - return not an anomaly (fail open)
      console.log(`⚠️ No baseline found for ${normalizedEmail} / ${metricType} - allowing action`);
      return {
        isAnomaly: false,
        deviation: 0,
        currentValue,
      };
    }

    const baseline: Baseline = {
      agentEmail: baselineData.agent_email,
      metricType: baselineData.metric_type as MetricType,
      meanValue: parseFloat(baselineData.mean_value),
      stdDev: parseFloat(baselineData.std_dev),
      sampleSize: baselineData.sample_size,
      calculatedAt: baselineData.calculated_at,
      dateRangeStart: baselineData.date_range_start,
      dateRangeEnd: baselineData.date_range_end,
    };

    // Calculate deviation: (currentValue - mean) / stdDev
    const deviation = baseline.stdDev > 0 
      ? (currentValue - baseline.meanValue) / baseline.stdDev 
      : 0;

    // Anomaly if |deviation| > 1.0 (more than 1 standard deviation)
    const isAnomaly = Math.abs(deviation) > 1.0;

    return {
      isAnomaly,
      deviation,
      baseline,
      currentValue,
    };
  } catch (error) {
    console.error('❌ Error checking anomaly:', error);
    // Fail open - allow action if check fails
    return {
      isAnomaly: false,
      deviation: 0,
      currentValue,
    };
  }
}

/**
 * Get violation count for today
 */
async function getViolationCountToday(
  supabase: SupabaseClient,
  agentEmail: string
): Promise<number> {
  try {
    const normalizedEmail = agentEmail.toLowerCase().trim();
    const todayStart = startOfDay(new Date()).toISOString();

    const { count, error } = await supabase
      .from('agent_anomaly_violations')
      .select('*', { count: 'exact', head: true })
      .eq('agent_email', normalizedEmail)
      .gte('violation_timestamp', todayStart);

    if (error) {
      console.error('❌ Error counting violations:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Error getting violation count:', error);
    return 0;
  }
}

/**
 * Get timeout duration based on violation count
 */
function getTimeoutDuration(violationCount: number): number {
  switch (violationCount) {
    case 1: return 0; // Warning only
    case 2: return 10 * 60; // 10 minutes
    case 3: return 60 * 60; // 1 hour
    case 4: return 24 * 60 * 60; // 24 hours
    default: return 24 * 60 * 60; // Max 24 hours
  }
}

/**
 * Record a violation and apply progressive timeout if needed
 * @param supabase Supabase client
 * @param agentEmail Agent email
 * @param violationType Type of violation
 * @param violationValue Value that triggered violation
 * @param metadata Additional context
 */
export async function recordViolation(
  supabase: SupabaseClient,
  agentEmail: string,
  violationType: MetricType,
  violationValue: number,
  metadata?: Record<string, any>
): Promise<{ actionTaken: ActionTaken; timeoutUntil?: string }> {
  try {
    const normalizedEmail = agentEmail.toLowerCase().trim();

    // Get violation count for today
    const violationCount = await getViolationCountToday(supabase, normalizedEmail);
    const newViolationCount = violationCount + 1;

    // Get baseline for deviation calculation
    const { data: baselineData } = await supabase
      .from('agent_anomaly_baselines')
      .select('*')
      .eq('agent_email', normalizedEmail)
      .eq('metric_type', violationType)
      .single();

    const baselineMean = baselineData ? parseFloat(baselineData.mean_value) : 0;
    const baselineStdDev = baselineData ? parseFloat(baselineData.std_dev) : 0;
    const deviation = baselineStdDev > 0 
      ? (violationValue - baselineMean) / baselineStdDev 
      : 0;

    // Determine action based on violation count
    const timeoutSeconds = getTimeoutDuration(newViolationCount);
    let actionTaken: ActionTaken = 'warning';
    let timeoutUntil: string | undefined;

    if (timeoutSeconds > 0) {
      const timeoutDate = new Date();
      timeoutDate.setSeconds(timeoutDate.getSeconds() + timeoutSeconds);
      timeoutUntil = timeoutDate.toISOString();

      if (timeoutSeconds === 10 * 60) {
        actionTaken = 'timeout_10min';
      } else if (timeoutSeconds === 60 * 60) {
        actionTaken = 'timeout_1hr';
      } else if (timeoutSeconds === 24 * 60 * 60) {
        actionTaken = 'timeout_24hr';
      }
    }

    // Record violation
    const { error: violationError } = await supabase
      .from('agent_anomaly_violations')
      .insert({
        agent_email: normalizedEmail,
        violation_type: violationType,
        violation_value: violationValue,
        baseline_mean: baselineMean,
        baseline_std_dev: baselineStdDev,
        deviation_count: deviation,
        action_taken: actionTaken,
        timeout_until: timeoutUntil || null,
        metadata: metadata || null,
      });

    if (violationError) {
      console.error('❌ Failed to record violation:', violationError);
    } else {
      console.log(`📝 Recorded violation #${newViolationCount} for ${normalizedEmail}: ${actionTaken}`);
    }

    // Create timeout record if needed
    if (timeoutUntil && !agentTimeoutsTableUnavailable) {
      const timeoutType = violationType === 'call_duration' ? 'dialing' : 
                         violationType === 'disposition_frequency' ? 'disposition' : 'all';

      const { error: timeoutError } = await supabase
        .from('agent_timeouts')
        .insert({
          agent_email: normalizedEmail,
          timeout_type: timeoutType,
          timeout_until: timeoutUntil,
          violation_count: newViolationCount,
        });

      if (timeoutError) {
        if (isAgentTimeoutsMissing(timeoutError)) {
          agentTimeoutsTableUnavailable = true;
          console.warn('⚠️ agent_timeouts table missing; timeout writes disabled on this process.');
          return { actionTaken, timeoutUntil };
        }
        console.error('❌ Failed to create timeout:', timeoutError);
      } else {
        console.log(`⏸️ Created ${actionTaken} timeout for ${normalizedEmail} until ${timeoutUntil}`);
      }
    }

    return { actionTaken, timeoutUntil };
  } catch (error) {
    console.error('❌ Error recording violation:', error);
    return { actionTaken: 'warning' };
  }
}

/**
 * Check if agent is currently timed out
 * @param supabase Supabase client
 * @param agentEmail Agent email
 */
export async function checkTimeout(
  supabase: SupabaseClient,
  agentEmail: string
): Promise<TimeoutStatus> {
  try {
    if (agentTimeoutsTableUnavailable) {
      return { isTimedOut: false };
    }
    const normalizedEmail = agentEmail.toLowerCase().trim();
    const now = new Date().toISOString();

    // Check for active timeouts
    const { data: timeouts, error } = await supabase
      .from('agent_timeouts')
      .select('*')
      .eq('agent_email', normalizedEmail)
      .gt('timeout_until', now)
      .is('resolved_at', null)
      .order('timeout_until', { ascending: true })
      .limit(1);

    if (error) {
      if (isAgentTimeoutsMissing(error)) {
        agentTimeoutsTableUnavailable = true;
        console.warn('⚠️ agent_timeouts table missing; timeout checks disabled on this process.');
        return { isTimedOut: false };
      }
      console.error('❌ Error checking timeout:', error);
      return { isTimedOut: false };
    }

    if (!timeouts || timeouts.length === 0) {
      return { isTimedOut: false };
    }

    const timeout = timeouts[0];
    const timeoutUntil = new Date(timeout.timeout_until);
    const nowDate = new Date();
    const remainingSeconds = Math.max(0, Math.floor((timeoutUntil.getTime() - nowDate.getTime()) / 1000));

    return {
      isTimedOut: true,
      timeoutUntil: timeout.timeout_until,
      timeoutType: timeout.timeout_type,
      violationCount: timeout.violation_count,
      remainingSeconds,
    };
  } catch (error) {
    console.error('❌ Error checking timeout:', error);
    return { isTimedOut: false };
  }
}

/**
 * Resolve expired timeouts (cleanup function)
 */
export async function resolveExpiredTimeouts(supabase: SupabaseClient): Promise<void> {
  try {
    if (agentTimeoutsTableUnavailable) return;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('agent_timeouts')
      .update({ resolved_at: now })
      .lt('timeout_until', now)
      .is('resolved_at', null);

    if (error) {
      if (isAgentTimeoutsMissing(error)) {
        agentTimeoutsTableUnavailable = true;
        console.warn('⚠️ agent_timeouts table missing; timeout cleanup disabled on this process.');
        return;
      }
      console.error('❌ Error resolving expired timeouts:', error);
    } else {
      console.log('✅ Resolved expired timeouts');
    }
  } catch (error) {
    console.error('❌ Error in resolveExpiredTimeouts:', error);
  }
}
