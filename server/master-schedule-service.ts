/**
 * Master Schedule Service
 * Unified agent schedule: support, meets, appointments, recruit
 * Feeds countdown timer and accountability flow
 *
 * Time formats: Storage = ISO UTC; Time-of-day in APIs = HH:mm (see docs/SCHEDULE_TIME_FORMATS.md)
 */

import { supabaseAdmin } from './supabase';

export type ScheduleType = 'support' | 'meet' | 'appointment' | 'recruit' | 'callback';
export type SourceTable = 'support_bookings' | 'meets' | 'appointments' | 'recruit_candidates' | 'masterlead';

export interface UpsertMasterScheduleParams {
  agentEmail: string;
  slotStart: string; // ISO
  slotEnd: string;   // ISO
  scheduleType: ScheduleType;
  sourceTable: SourceTable;
  sourceId: string;
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface MasterScheduleItem {
  id: string;
  agent_email: string;
  slot_start: string;
  slot_end: string;
  schedule_type: ScheduleType;
  source_table: SourceTable;
  source_id: string;
  title: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Upsert a schedule item into master_schedule (write-through from source)
 */
export async function upsertMasterSchedule(params: UpsertMasterScheduleParams): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const { agentEmail, slotStart, slotEnd, scheduleType, sourceTable, sourceId, title, description, metadata } = params;
    const row = {
      agent_email: agentEmail.toLowerCase().trim(),
      slot_start: slotStart,
      slot_end: slotEnd,
      schedule_type: scheduleType,
      source_table: sourceTable,
      source_id: String(sourceId),
      title: title ?? null,
      description: description ?? null,
      metadata: metadata ?? {},
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from('master_schedule').upsert(row, {
      onConflict: 'source_table,source_id',
      ignoreDuplicates: false,
    });
    if (error) throw error;
  } catch (err) {
    console.warn('⚠️ master_schedule upsert error:', (err as Error)?.message);
  }
}

/**
 * Get master schedule for an agent within a date range
 */
export async function getMasterSchedule(
  agentEmail: string,
  fromISO?: string,
  toISO?: string,
  upcomingOnly?: boolean
): Promise<MasterScheduleItem[]> {
  if (!supabaseAdmin) return [];
  try {
    let query = supabaseAdmin
      .from('master_schedule')
      .select('*')
      .eq('agent_email', agentEmail.toLowerCase().trim())
      .order('slot_start', { ascending: true });

    const now = new Date().toISOString();
    if (upcomingOnly) {
      query = query.gte('slot_start', now);
    }
    if (fromISO) query = query.gte('slot_start', fromISO);
    if (toISO) query = query.lte('slot_start', toISO);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as MasterScheduleItem[];
  } catch (err) {
    console.warn('⚠️ master_schedule get error:', (err as Error)?.message);
    return [];
  }
}

/**
 * Get the single next upcoming slot for countdown/timer
 */
export async function getNextUpcomingSlot(agentEmail: string): Promise<MasterScheduleItem | null> {
  const items = await getMasterSchedule(agentEmail, undefined, undefined, true);
  return items.length > 0 ? items[0] : null;
}

/**
 * Get booked slots for a calendar day from master_schedule.
 * Returns slots with time in HH:mm format in the given timezone for modal availability.
 * Query params: agentEmail, date (YYYY-MM-DD), timezone (IANA, default America/New_York)
 */
export async function getMasterScheduleForDay(
  agentEmail: string,
  dateStr: string,
  timezone: string = 'America/New_York'
): Promise<Array<MasterScheduleItem & { time: string }>> {
  if (!supabaseAdmin) return [];
  try {
    // Over-fetch: day in any US tz spans at most ~28h in UTC
    const dayStart = new Date(dateStr + 'T00:00:00.000Z').getTime() - 14 * 60 * 60 * 1000;
    const dayEnd = new Date(dateStr + 'T23:59:59.999Z').getTime() + 14 * 60 * 60 * 1000;
    const fromISO = new Date(dayStart).toISOString();
    const toISO = new Date(dayEnd).toISOString();
    const items = await getMasterSchedule(agentEmail, fromISO, toISO, false);
    // Filter to slots whose slot_start falls on dateStr in the given timezone
    const filtered = items.filter((row) => {
      const localDate = new Date(row.slot_start).toLocaleDateString('en-CA', { timeZone: timezone });
      return localDate === dateStr;
    });
    // Add time in HH:mm for modal slot comparison
    return filtered.map((row) => {
      const time = new Date(row.slot_start).toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return { ...row, time };
    });
  } catch (err) {
    console.warn('⚠️ master_schedule for day get error:', (err as Error)?.message);
    return [];
  }
}
