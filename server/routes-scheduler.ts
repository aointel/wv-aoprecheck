/**
 * Calendly-lite scheduler API for AOI My Calendar.
 *
 * Appointments remain the source appointment records. master_schedule and
 * scheduler_external_busy are used as the free/busy sources for slot building.
 */
import { Router } from 'express';
import { addMinutes, isBefore, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { supabaseAdmin } from './supabase';
import { upsertMasterSchedule } from './master-schedule-service';

const router = Router();

type EventTypeRow = {
  id: string;
  agent_email: string;
  slug: string;
  name: string;
  description?: string | null;
  category: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_advance_days: number;
  location_type: string;
  meeting_link?: string | null;
  active: boolean;
  public_enabled: boolean;
  reminder_policy?: Array<{ channel: string; offset_minutes: number }>;
};

type AvailabilityRuleRow = {
  id?: string;
  agent_email: string;
  event_type_id?: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  timezone: string;
  active: boolean;
};

const DEFAULT_TIMEZONE = 'America/New_York';

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'event';
}

function timePart(value: string): string {
  return String(value || '').slice(0, 5);
}

function localToUtcISO(date: string, time: string, timezone: string): string {
  return fromZonedTime(`${date}T${timePart(time)}:00`, timezone).toISOString();
}

function overlaps(start: Date, end: Date, busyStart: Date, busyEnd: Date): boolean {
  return start < busyEnd && end > busyStart;
}

function renderTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => String(values[key] ?? ''));
}

function requireSupabase(res: any): boolean {
  if (!supabaseAdmin) {
    res.status(503).json({ success: false, error: 'Supabase admin client not available' });
    return false;
  }
  return true;
}

async function ensureDefaultEventType(agentEmail: string): Promise<EventTypeRow | null> {
  if (!supabaseAdmin) return null;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('scheduler_event_types')
    .select('*')
    .eq('agent_email', agentEmail)
    .eq('slug', 'aoi-presentation')
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') throw existingError;
  if (existing) return existing as EventTypeRow;

  const { data, error } = await supabaseAdmin
    .from('scheduler_event_types')
    .insert({
      agent_email: agentEmail,
      slug: 'aoi-presentation',
      name: 'AOI Presentation',
      description: 'Default AOI presentation appointment.',
      category: 'appointment',
      duration_minutes: 60,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_notice_minutes: 120,
      max_advance_days: 30,
      location_type: 'zoom',
      active: true,
      public_enabled: false,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as EventTypeRow;
}

async function getEventType(agentEmail: string, eventTypeId?: string): Promise<EventTypeRow> {
  if (!supabaseAdmin) throw new Error('Supabase unavailable');

  let query = supabaseAdmin
    .from('scheduler_event_types')
    .select('*')
    .eq('agent_email', agentEmail)
    .eq('active', true);

  if (eventTypeId) query = query.eq('id', eventTypeId);
  else query = query.order('created_at', { ascending: true }).limit(1);

  const { data, error } = eventTypeId ? await query.single() : await query.maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  if (data) return data as EventTypeRow;

  const created = await ensureDefaultEventType(agentEmail);
  if (!created) throw new Error('Could not create default event type');
  return created;
}

async function getAvailabilityRules(agentEmail: string, eventTypeId?: string | null): Promise<AvailabilityRuleRow[]> {
  if (!supabaseAdmin) return [];

  let query = supabaseAdmin
    .from('scheduler_availability_rules')
    .select('*')
    .eq('agent_email', agentEmail)
    .eq('active', true)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true });

  if (eventTypeId) query = query.or(`event_type_id.is.null,event_type_id.eq.${eventTypeId}`);

  const { data, error } = await query;
  if (error) throw error;
  if (data && data.length > 0) return data as AvailabilityRuleRow[];

  return [1, 2, 3, 4, 5].map((weekday) => ({
    agent_email: agentEmail,
    event_type_id: eventTypeId ?? null,
    weekday,
    start_time: '09:00',
    end_time: '17:00',
    timezone: DEFAULT_TIMEZONE,
    active: true,
  }));
}

async function getBusyBlocks(agentEmail: string, fromISO: string, toISO: string) {
  if (!supabaseAdmin) return [];

  const [masterResult, externalResult] = await Promise.all([
    supabaseAdmin
      .from('master_schedule')
      .select('slot_start, slot_end, title, source_table, source_id')
      .eq('agent_email', agentEmail)
      .lt('slot_start', toISO)
      .gt('slot_end', fromISO),
    supabaseAdmin
      .from('scheduler_external_busy')
      .select('busy_start, busy_end, title, provider, calendar_id, provider_event_id')
      .eq('agent_email', agentEmail)
      .lt('busy_start', toISO)
      .gt('busy_end', fromISO),
  ]);

  if (masterResult.error) throw masterResult.error;
  if (externalResult.error) throw externalResult.error;

  const masterBusy = (masterResult.data ?? []).map((row: any) => ({
    start: row.slot_start,
    end: row.slot_end,
    title: row.title,
    source: row.source_table,
    sourceId: row.source_id,
  }));
  const externalBusy = (externalResult.data ?? []).map((row: any) => ({
    start: row.busy_start,
    end: row.busy_end,
    title: row.title,
    source: row.provider,
    sourceId: row.provider_event_id || row.calendar_id,
  }));

  return [...masterBusy, ...externalBusy];
}

async function queueReminderJobs(params: {
  appointmentId: number | string;
  agentEmail: string;
  eventType: EventTypeRow;
  startTime: string;
  payload: Record<string, unknown>;
}) {
  if (!supabaseAdmin) return;

  const policy = Array.isArray(params.eventType.reminder_policy)
    ? params.eventType.reminder_policy
    : [
        { channel: 'sms', offset_minutes: 1440 },
        { channel: 'sms', offset_minutes: 60 },
        { channel: 'sms', offset_minutes: 15 },
      ];

  const start = parseISO(params.startTime);
  const rows = policy
    .map((item) => ({
      appointment_id: params.appointmentId,
      agent_email: params.agentEmail,
      event_type_id: params.eventType.id,
      channel: item.channel || 'sms',
      template_key: `reminder_${Number(item.offset_minutes) || 0}m`,
      due_at: addMinutes(start, -Math.max(0, Number(item.offset_minutes) || 0)).toISOString(),
      status: 'pending',
      payload: params.payload,
    }))
    .filter((row) => isBefore(new Date(), parseISO(row.due_at)));

  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from('scheduler_reminder_jobs').insert(rows);
  if (error) console.warn('scheduler reminder job insert failed:', error.message);
}

router.get('/settings', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const agentEmail = normalizeEmail(req.query.agentEmail);
    if (!agentEmail) return res.status(400).json({ success: false, error: 'Missing agentEmail' });

    await ensureDefaultEventType(agentEmail);

    const [page, eventTypes, connections] = await Promise.all([
      supabaseAdmin!
        .from('scheduler_booking_pages')
        .select('*')
        .eq('agent_email', agentEmail)
        .maybeSingle(),
      supabaseAdmin!
        .from('scheduler_event_types')
        .select('*')
        .eq('agent_email', agentEmail)
        .order('created_at', { ascending: true }),
      supabaseAdmin!
        .from('scheduler_calendar_connections')
        .select('id, agent_email, provider, provider_account_email, scopes, selected_calendars, free_busy_enabled, writeback_enabled, status, last_synced_at, last_error')
        .eq('agent_email', agentEmail),
    ]);

    if (page.error && page.error.code !== 'PGRST116') throw page.error;
    if (eventTypes.error) throw eventTypes.error;
    if (connections.error) throw connections.error;

    res.json({
      success: true,
      bookingPage: page.data ?? null,
      eventTypes: eventTypes.data ?? [],
      calendarConnections: connections.data ?? [],
    });
  } catch (error: any) {
    console.error('scheduler settings error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to load scheduler settings' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const agentEmail = normalizeEmail(req.body.agentEmail);
    if (!agentEmail) return res.status(400).json({ success: false, error: 'Missing agentEmail' });

    const slug = slugify(req.body.slug || agentEmail.split('@')[0]);
    const row = {
      agent_email: agentEmail,
      slug,
      display_name: req.body.displayName || req.body.display_name || agentEmail.split('@')[0],
      timezone: req.body.timezone || DEFAULT_TIMEZONE,
      active: req.body.active !== false,
      branding: req.body.branding || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin!
      .from('scheduler_booking_pages')
      .upsert(row, { onConflict: 'agent_email' })
      .select('*')
      .single();

    if (error) throw error;
    res.json({ success: true, bookingPage: data });
  } catch (error: any) {
    console.error('scheduler settings save error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to save scheduler settings' });
  }
});

router.get('/event-types', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const agentEmail = normalizeEmail(req.query.agentEmail);
    if (!agentEmail) return res.status(400).json({ success: false, error: 'Missing agentEmail' });
    await ensureDefaultEventType(agentEmail);

    const { data, error } = await supabaseAdmin!
      .from('scheduler_event_types')
      .select('*')
      .eq('agent_email', agentEmail)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ success: true, eventTypes: data ?? [] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to load event types' });
  }
});

router.post('/event-types', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const agentEmail = normalizeEmail(req.body.agentEmail);
    const name = String(req.body.name || '').trim();
    if (!agentEmail || !name) return res.status(400).json({ success: false, error: 'Missing agentEmail or name' });

    const row = {
      agent_email: agentEmail,
      slug: slugify(req.body.slug || name),
      name,
      description: req.body.description || null,
      category: req.body.category || 'appointment',
      duration_minutes: Number(req.body.durationMinutes || req.body.duration_minutes || 60),
      buffer_before_minutes: Number(req.body.bufferBeforeMinutes || req.body.buffer_before_minutes || 0),
      buffer_after_minutes: Number(req.body.bufferAfterMinutes || req.body.buffer_after_minutes || 0),
      min_notice_minutes: Number(req.body.minNoticeMinutes || req.body.min_notice_minutes || 120),
      max_advance_days: Number(req.body.maxAdvanceDays || req.body.max_advance_days || 30),
      location_type: req.body.locationType || req.body.location_type || 'zoom',
      meeting_link: req.body.meetingLink || req.body.meeting_link || null,
      public_enabled: Boolean(req.body.publicEnabled ?? req.body.public_enabled ?? false),
      active: req.body.active !== false,
      booking_questions: req.body.bookingQuestions || req.body.booking_questions || [],
      reminder_policy: req.body.reminderPolicy || req.body.reminder_policy || undefined,
    };

    const { data, error } = await supabaseAdmin!
      .from('scheduler_event_types')
      .insert(row)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ success: true, eventType: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to create event type' });
  }
});

router.patch('/event-types/:id', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const agentEmail = normalizeEmail(req.body.agentEmail || req.query.agentEmail);
    if (!agentEmail) return res.status(400).json({ success: false, error: 'Missing agentEmail' });

    const allowed: Record<string, string> = {
      name: 'name',
      description: 'description',
      category: 'category',
      durationMinutes: 'duration_minutes',
      bufferBeforeMinutes: 'buffer_before_minutes',
      bufferAfterMinutes: 'buffer_after_minutes',
      minNoticeMinutes: 'min_notice_minutes',
      maxAdvanceDays: 'max_advance_days',
      locationType: 'location_type',
      meetingLink: 'meeting_link',
      publicEnabled: 'public_enabled',
      active: 'active',
      bookingQuestions: 'booking_questions',
      reminderPolicy: 'reminder_policy',
    };
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [inputKey, column] of Object.entries(allowed)) {
      if (Object.prototype.hasOwnProperty.call(req.body, inputKey)) update[column] = req.body[inputKey];
    }
    if (req.body.slug) update.slug = slugify(req.body.slug);

    const { data, error } = await supabaseAdmin!
      .from('scheduler_event_types')
      .update(update)
      .eq('id', req.params.id)
      .eq('agent_email', agentEmail)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ success: true, eventType: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to update event type' });
  }
});

router.get('/availability', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const agentEmail = normalizeEmail(req.query.agentEmail);
    if (!agentEmail) return res.status(400).json({ success: false, error: 'Missing agentEmail' });
    const eventTypeId = String(req.query.eventTypeId || '') || null;
    const rules = await getAvailabilityRules(agentEmail, eventTypeId);
    res.json({ success: true, rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to load availability' });
  }
});

router.put('/availability', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const agentEmail = normalizeEmail(req.body.agentEmail);
    if (!agentEmail) return res.status(400).json({ success: false, error: 'Missing agentEmail' });
    const eventTypeId = req.body.eventTypeId || null;
    const rules = Array.isArray(req.body.rules) ? req.body.rules : [];

    let deleteQuery = supabaseAdmin!
      .from('scheduler_availability_rules')
      .delete()
      .eq('agent_email', agentEmail);
    deleteQuery = eventTypeId ? deleteQuery.eq('event_type_id', eventTypeId) : deleteQuery.is('event_type_id', null);
    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw deleteError;

    const rows = rules.map((rule: any) => ({
      agent_email: agentEmail,
      event_type_id: eventTypeId,
      weekday: Number(rule.weekday),
      start_time: timePart(rule.startTime || rule.start_time),
      end_time: timePart(rule.endTime || rule.end_time),
      timezone: rule.timezone || req.body.timezone || DEFAULT_TIMEZONE,
      active: rule.active !== false,
    }));

    if (rows.length > 0) {
      const { error } = await supabaseAdmin!.from('scheduler_availability_rules').insert(rows);
      if (error) throw error;
    }

    res.json({ success: true, rules: await getAvailabilityRules(agentEmail, eventTypeId) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to save availability' });
  }
});

router.get('/slots', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const agentEmail = normalizeEmail(req.query.agentEmail);
    const date = String(req.query.date || '').trim();
    if (!agentEmail || !date) return res.status(400).json({ success: false, error: 'Missing agentEmail or date' });

    const eventType = await getEventType(agentEmail, String(req.query.eventTypeId || '') || undefined);
    const timezone = String(req.query.timezone || '') || DEFAULT_TIMEZONE;
    const dateNoon = fromZonedTime(`${date}T12:00:00`, timezone);
    const weekday = Number(formatInTimeZone(dateNoon, timezone, 'i')) % 7;
    const rules = (await getAvailabilityRules(agentEmail, eventType.id)).filter((rule) => rule.weekday === weekday);
    const dayStartISO = localToUtcISO(date, '00:00', timezone);
    const dayEndISO = localToUtcISO(date, '23:59', timezone);
    const busy = await getBusyBlocks(agentEmail, dayStartISO, dayEndISO);
    const now = new Date();
    const minStart = addMinutes(now, eventType.min_notice_minutes || 0);
    const slots: Array<{ start: string; end: string; label: string; timezone: string }> = [];

    for (const rule of rules) {
      const ruleTimezone = rule.timezone || timezone;
      let cursor = fromZonedTime(`${date}T${timePart(rule.start_time)}:00`, ruleTimezone);
      const ruleEnd = fromZonedTime(`${date}T${timePart(rule.end_time)}:00`, ruleTimezone);

      while (addMinutes(cursor, eventType.duration_minutes) <= ruleEnd) {
        const slotStart = cursor;
        const slotEnd = addMinutes(slotStart, eventType.duration_minutes);
        const blockedStart = addMinutes(slotStart, -eventType.buffer_before_minutes);
        const blockedEnd = addMinutes(slotEnd, eventType.buffer_after_minutes);
        const isBlocked = busy.some((block) => overlaps(blockedStart, blockedEnd, parseISO(block.start), parseISO(block.end)));
        if (!isBlocked && !isBefore(slotStart, minStart)) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            label: formatInTimeZone(slotStart, ruleTimezone, 'h:mm a'),
            timezone: ruleTimezone,
          });
        }
        cursor = addMinutes(cursor, eventType.duration_minutes);
      }
    }

    res.json({ success: true, eventType, date, timezone, slots });
  } catch (error: any) {
    console.error('scheduler slots error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to load slots' });
  }
});

router.post('/book', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const agentEmail = normalizeEmail(req.body.agentEmail);
    const agentName = req.body.agentName || agentEmail.split('@')[0];
    const leadName = String(req.body.leadName || req.body.inviteeName || '').trim();
    const leadPhone = String(req.body.leadPhone || req.body.inviteePhone || '').trim();
    if (!agentEmail || !leadName || !leadPhone || !req.body.startTime) {
      return res.status(400).json({ success: false, error: 'Missing agentEmail, leadName, leadPhone, or startTime' });
    }

    const eventType = await getEventType(agentEmail, req.body.eventTypeId);
    const start = parseISO(req.body.startTime);
    const end = req.body.endTime ? parseISO(req.body.endTime) : addMinutes(start, eventType.duration_minutes);
    const templateValues = {
      first_name: leadName.split(/\s+/)[0] || leadName,
      lead_name: leadName,
      agent_name: agentName,
      appointment_time: formatInTimeZone(start, req.body.timezone || DEFAULT_TIMEZONE, 'EEEE, MMMM d h:mm a zzz'),
      meeting_link: req.body.meetingLink || eventType.meeting_link || '',
      reschedule_link: '',
      cancel_link: '',
    };

    const insertPayload = {
      title: req.body.title || `${eventType.name} with ${leadName}`,
      appointment_type: eventType.category || 'presentation',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration: Math.round((end.getTime() - start.getTime()) / 60000),
      timezone: req.body.timezone || DEFAULT_TIMEZONE,
      agent_id: req.body.agentId || agentEmail,
      agent_email: agentEmail,
      agent_name: agentName,
      lead_id: req.body.leadId || null,
      lead_name: leadName,
      lead_phone: leadPhone,
      lead_email: req.body.leadEmail || null,
      lead_city: req.body.leadCity || null,
      lead_state: req.body.leadState || null,
      lead_market: req.body.leadMarket || null,
      meeting_platform: req.body.meetingPlatform || eventType.location_type || 'AO Meet',
      meeting_link: req.body.meetingLink || eventType.meeting_link || null,
      zoom_join_url: req.body.zoomJoinUrl || req.body.meetingLink || eventType.meeting_link || null,
      status: 'scheduled',
      confirmation_status: 'pending',
      outcome: 'pending',
      disposition_source: req.body.bookingSource || 'scheduler',
      booking_source: req.body.bookingSource || 'scheduler',
      invitee_timezone: req.body.inviteeTimezone || req.body.timezone || DEFAULT_TIMEZONE,
      scheduler_event_type_id: eventType.id,
      notes: req.body.notes || null,
      template_snapshot: {
        confirmation_sms: renderTemplate(
          req.body.confirmationTemplate || 'Hi {first_name}, your appointment with {agent_name} is confirmed for {appointment_time}. {meeting_link}',
          templateValues,
        ),
      },
      reminder_policy_snapshot: eventType.reminder_policy || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: appointment, error } = await supabaseAdmin!
      .from('appointments')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;

    await upsertMasterSchedule({
      agentEmail,
      slotStart: appointment.start_time,
      slotEnd: appointment.end_time,
      scheduleType: eventType.category === 'recruit' ? 'recruit' : 'appointment',
      sourceTable: 'appointments',
      sourceId: String(appointment.id),
      title: appointment.title,
      metadata: {
        lead_name: appointment.lead_name,
        lead_phone: appointment.lead_phone,
        scheduler_event_type_id: eventType.id,
        event_type_name: eventType.name,
      },
    });

    await queueReminderJobs({
      appointmentId: appointment.id,
      agentEmail,
      eventType,
      startTime: appointment.start_time,
      payload: { appointment, eventType, templateValues },
    });

    res.json({ success: true, appointment });
  } catch (error: any) {
    console.error('scheduler book error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to book appointment' });
  }
});

router.get('/calendar-connections', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const agentEmail = normalizeEmail(req.query.agentEmail);
    if (!agentEmail) return res.status(400).json({ success: false, error: 'Missing agentEmail' });
    const { data, error } = await supabaseAdmin!
      .from('scheduler_calendar_connections')
      .select('id, agent_email, provider, provider_account_email, scopes, selected_calendars, free_busy_enabled, writeback_enabled, status, last_synced_at, last_error')
      .eq('agent_email', agentEmail);
    if (error) throw error;
    res.json({ success: true, connections: data ?? [] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to load calendar connections' });
  }
});

router.post('/calendar-sync/run', async (req, res) => {
  try {
    if (!requireSupabase(res)) return;
    const agentEmail = normalizeEmail(req.body.agentEmail || req.query.agentEmail);
    if (!agentEmail) return res.status(400).json({ success: false, error: 'Missing agentEmail' });
    res.json({
      success: true,
      message: 'Calendar sync endpoint is ready. Provider OAuth workers are the next implementation step.',
      synced: 0,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to run calendar sync' });
  }
});

export default router;
