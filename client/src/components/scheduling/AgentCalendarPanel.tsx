'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, RefreshCw, X, CalendarDays, Plus, Search, RotateCcw, Phone, MessageSquare, ShieldCheck, Presentation, Settings, Check, Copy, ExternalLink, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { format, addDays, isToday, isTomorrow, parseISO, startOfDay, endOfDay, isSameDay, setHours, addHours, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { AppointmentOutcomeModal } from './AppointmentOutcomeModal';
import { useAuth } from '@/hooks/use-auth';
import { getServiceRequestCredentials, resolveServiceUrl } from '@/lib/service-routing';
import LeadDisplay from '@/components/outbound-dialer/LeadDisplay';
import type { DialerState, Lead } from '@/components/outbound-dialer/types';

interface RawAppointment {
  id: number;
  lead_name?: string;
  leadName?: string;
  lead_spouse_name?: string;
  leadSpouseName?: string;
  lead_phone?: string;
  leadPhone?: string;
  lead_market?: string;
  leadMarket?: string;
  lead_state?: string;
  leadState?: string;
  start_time?: string;
  startTime?: string;
  timezone?: string;
  status?: string;
  outcome?: string;
  outcome_notes?: string;
  meeting_link?: string;
  meetingLink?: string;
  zoom_join_url?: string;
  disposition_source?: string;
  notes?: string;
  internal_notes?: string;
  appointment_type?: string;
  meeting_platform?: string;
  confirmation_status?: string;
  reminders_sent?: number;
}

interface AppointmentFormState {
  id?: number;
  leadId?: string | number | null;
  date: string;
  time: string;
  leadName: string;
  spouseName: string;
  leadPhone: string;
  leadMarket: string;
  leadState: string;
  leadCity: string;
  notes: string;
}

interface CalendarDraftAppointment {
  leadId?: string | number | null;
  leadName?: string;
  leadPhone?: string;
  leadMarket?: string;
  leadState?: string;
  leadCity?: string;
  dispositionSource?: 'booked' | 'instant_presentation' | 'callback' | 'manual';
}

interface CalendarConfigState {
  zoomLink: string;
  zoomPassword: string;
  timezone: string;
  confirmationTemplate: string;
  reminder1Template: string;
  reminder2Template: string;
  reminder3Template: string;
  reminder1Hours: string;
  reminder2Minutes: string;
  reminder3Minutes: string;
}

interface SchedulerEventType {
  id: string;
  name: string;
  category?: string;
  duration_minutes?: number;
  meeting_link?: string | null;
  public_enabled?: boolean;
  active?: boolean;
}

interface SchedulerCalendarConnection {
  id: string;
  provider: 'google' | 'outlook';
  provider_account_email?: string | null;
  status?: string;
  free_busy_enabled?: boolean;
  writeback_enabled?: boolean;
  last_synced_at?: string | null;
}

interface SchedulerSettingsState {
  bookingPage?: {
    slug?: string;
    active?: boolean;
    timezone?: string;
  } | null;
  eventTypes: SchedulerEventType[];
  calendarConnections: SchedulerCalendarConnection[];
}

interface SchedulerAvailabilityRule {
  id?: string;
  weekday: number;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  timezone?: string;
  active?: boolean;
}

interface LeadSearchResult {
  id?: string | number;
  lead_id?: string | number;
  taalk_lead_id?: string | number;
  taalkLeadId?: string | number;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  lead_phone?: string;
  market?: string;
  taalk_market?: string;
  state?: string;
  taalk_state?: string;
  city?: string;
  taalk_city?: string;
  source?: 'sales' | 'recruit';
}

type CalendarAppointmentType = 'presentation' | 'recruit_interview' | 'recruit_group_overview';

function isRecruitAppointmentType(value: string): value is 'recruit_interview' | 'recruit_group_overview' {
  return value === 'recruit_interview' || value === 'recruit_group_overview';
}

function getField(appt: RawAppointment, snake: string, camel: string): string {
  return (appt as any)[snake] || (appt as any)[camel] || '';
}

function getLeadMarket(appt: RawAppointment): string {
  const storedMarket = getField(appt, 'lead_market', 'leadMarket');
  if (storedMarket) return storedMarket;

  const match = String(appt.notes || '').match(/Market:\s*([^|,\n]+)/i);
  return match?.[1]?.trim() || '';
}

function getSpouseName(appt: RawAppointment): string {
  const explicit = getField(appt, 'lead_spouse_name', 'leadSpouseName');
  if (explicit) return explicit;
  const blob = `${appt.notes || ''}\n${appt.internal_notes || ''}`;
  const match = blob.match(/(?:spouse|spouse name)\s*:\s*([^|,\n]+)/i);
  return match?.[1]?.trim() || '';
}

function buildHouseholdName(leadName: string, spouseName?: string): string {
  const primary = String(leadName || '').trim();
  const spouse = String(spouseName || '').trim();
  if (!primary) return spouse || '';
  if (!spouse) return primary;
  if (/\sand\s/i.test(primary)) return primary;

  const parts = primary.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return `${primary} and ${spouse}`;
  const lastName = parts[parts.length - 1];
  const firstSegment = parts.slice(0, -1).join(' ');
  if (/\s/.test(spouse)) return `${firstSegment} and ${spouse}`;
  return `${firstSegment} and ${spouse} ${lastName}`;
}

function getOutcomeTone(appt: RawAppointment): 'positive' | 'negative' | 'pending' {
  const outcome = String(appt.outcome || '').toLowerCase();
  const status = String(appt.status || '').toLowerCase();
  if (['sale', 'policy_issued', 'completed'].includes(outcome) || status === 'completed') return 'positive';
  if (['no_sale', 'no_show', 'cancelled', 'not_interested', 'cannot_afford', 'medically_uninsurable'].includes(outcome) || ['cancelled', 'no_show'].includes(status)) return 'negative';
  return 'pending';
}

function isResolvedOutcome(outcome: unknown): boolean {
  const normalized = String(outcome || '').toLowerCase();
  return Boolean(normalized && normalized !== 'pending');
}

function formatOutcomeLabel(outcome: unknown): string {
  const normalized = String(outcome || '').trim();
  if (!normalized || normalized.toLowerCase() === 'pending') return 'Pending';
  return normalized.replace(/_/g, ' ');
}

function getTrackingBlob(appt: RawAppointment): string {
  return `${appt.notes || ''}\n${appt.internal_notes || ''}`;
}

function hasTrackingMarker(appt: RawAppointment, marker: string): boolean {
  return getTrackingBlob(appt).toLowerCase().includes(marker.toLowerCase());
}

function getMeetingLink(appt: RawAppointment): string {
  return appt.meeting_link || appt.meetingLink || appt.zoom_join_url || '';
}

function normalizeZoomPassword(password?: string | null): string {
  const raw = String(password || '').trim();
  if (!raw || raw === '1') return '';
  return raw;
}

function getDispositionSourceValue(appt: RawAppointment): 'booked' | 'instant_presentation' | 'callback' | 'manual' {
  const raw = String((appt as any).disposition_source || (appt as any).dispositionSource || '').toLowerCase().trim();
  if (raw === 'booked') return 'booked';
  if (raw === 'instant_presentation') return 'instant_presentation';
  if (raw === 'callback') return 'callback';
  return 'manual';
}

function dispositionSourceLabel(source: 'booked' | 'instant_presentation' | 'callback' | 'manual'): string {
  if (source === 'instant_presentation') return 'Instant';
  if (source === 'booked') return 'Booked';
  if (source === 'callback') return 'Callback';
  return 'Appointment';
}

function parseAppointmentInstant(raw: string): Date {
  const normalized = raw.trim().replace(' ', 'T');
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return parseISO(hasExplicitZone ? normalized : `${normalized}Z`);
}

function getStartTime(appt: RawAppointment): Date {
  const raw = appt.start_time || appt.startTime || '';
  return raw ? parseAppointmentInstant(raw) : new Date();
}

function getDayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
}

function formatApptTime(appt: RawAppointment, timezoneOverride?: string): string {
  const raw = appt.start_time || appt.startTime || '';
  if (!raw) return '';
  const tz = timezoneOverride || appt.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    return formatInTimeZone(parseAppointmentInstant(raw), tz, 'h:mm a zzz');
  } catch {
    return format(parseAppointmentInstant(raw), 'h:mm a');
  }
}

function formatSlotHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

function asDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function asTimeInputValue(date: Date): string {
  return format(date, 'HH:mm');
}

function buildLocalDateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr || '08:00'}:00`);
}

function zonedDateTimeToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  return fromZonedTime(`${dateStr}T${timeStr || '08:00'}:00`, timezone);
}

function getZonedDateKey(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

function getZonedHour(date: Date, timezone: string): number {
  return Number(formatInTimeZone(date, timezone, 'H'));
}

function addDaysToDateKey(dateKey: string, days: number): string {
  return format(addDays(new Date(`${dateKey}T12:00:00`), days), 'yyyy-MM-dd');
}

function getZonedDayRange(dateKey: string, timezone: string): { start: Date; end: Date } {
  return {
    start: zonedDateTimeToUtc(dateKey, '00:00', timezone),
    end: zonedDateTimeToUtc(dateKey, '23:59', timezone),
  };
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-slate-100 text-slate-800 border-slate-200',
  no_show: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const OUTCOME_COLORS: Record<string, string> = {
  sale: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  no_sale: 'bg-red-100 text-red-800 border-red-200',
  no_show: 'bg-red-100 text-red-800 border-red-200',
  rescheduled: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  not_interested: 'bg-slate-100 text-slate-800 border-slate-200',
  cannot_afford: 'bg-orange-100 text-orange-800 border-orange-200',
  medically_uninsurable: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  policy_issued: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const DEFAULT_CALENDAR_CONFIG: CalendarConfigState = {
  zoomLink: '',
  zoomPassword: '',
  timezone: 'America/New_York',
  confirmationTemplate: 'Hi {first_name}, your appointment with {agent_name} is scheduled for {appointment_time}. Zoom: {zoom_link}',
  reminder1Template: 'Reminder: your appointment with {agent_name} is tomorrow at {appointment_time}. Zoom: {zoom_link}',
  reminder2Template: 'Reminder: your appointment starts in about 1 hour. Zoom: {zoom_link}',
  reminder3Template: 'Your appointment starts soon. Join here: {zoom_link}',
  reminder1Hours: '24',
  reminder2Minutes: '60',
  reminder3Minutes: '15',
};

const CALENDAR_TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'EST / ET (Eastern)' },
  { value: 'America/Chicago', label: 'CST / CT (Central)' },
  { value: 'America/Denver', label: 'MST / MT (Mountain)' },
  { value: 'America/Los_Angeles', label: 'PST / PT (Pacific)' },
];

export function AgentCalendarPanel() {
  const [open, setOpen] = useState(false);
  const [appointments, setAppointments] = useState<RawAppointment[]>([]);
  const [callbacks, setCallbacks] = useState<RawAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [outcomeTarget, setOutcomeTarget] = useState<RawAppointment[]>([]);
  const [showOutcome, setShowOutcome] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => asDateInputValue(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadSearchResults, setLeadSearchResults] = useState<LeadSearchResult[]>([]);
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);
  const [leadSearchError, setLeadSearchError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<RawAppointment | null>(null);
  const [noSaleTarget, setNoSaleTarget] = useState<RawAppointment | null>(null);
  const [modalPosition, setModalPosition] = useState({ x: 360, y: 90 });
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [formModalPosition, setFormModalPosition] = useState({ x: 320, y: 86 });
  const [formDragOffset, setFormDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfigState>(DEFAULT_CALENDAR_CONFIG);
  const [schedulerSettings, setSchedulerSettings] = useState<SchedulerSettingsState | null>(null);
  const [schedulerSettingsLoading, setSchedulerSettingsLoading] = useState(false);
  const [schedulerSaving, setSchedulerSaving] = useState(false);
  const [bookingSlug, setBookingSlug] = useState('');
  const [bookingActive, setBookingActive] = useState(false);
  const [eventPublic, setEventPublic] = useState(false);
  const [eventDuration, setEventDuration] = useState('60');
  const [eventMeetingLink, setEventMeetingLink] = useState('');
  const [availabilityStart, setAvailabilityStart] = useState('09:00');
  const [availabilityEnd, setAvailabilityEnd] = useState('17:00');
  const [availabilityDays, setAvailabilityDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [pendingDraft, setPendingDraft] = useState<CalendarDraftAppointment | null>(null);
  const [formMode, setFormMode] = useState<'appointment' | 'callback'>('appointment');
  const [formAppointmentType, setFormAppointmentType] = useState<CalendarAppointmentType>('presentation');
  const [formDispositionSource, setFormDispositionSource] = useState<'booked' | 'instant_presentation' | 'callback' | 'manual'>('manual');
  const [formSendTextConfirmation, setFormSendTextConfirmation] = useState(false);
  const [form, setForm] = useState<AppointmentFormState>(() => ({
    leadId: null,
    date: asDateInputValue(new Date()),
    time: '08:00',
    leadName: '',
    spouseName: '',
    leadPhone: '',
    leadMarket: '',
    leadState: '',
    leadCity: '',
    notes: '',
  }));
  const { authState } = useAuth();
  const agentEmail = authState?.user?.email;
  const agentName =
    (authState?.user as any)?.name ||
    (authState?.user as any)?.user_metadata?.full_name ||
    agentEmail?.split('@')[0] ||
    'Agent';
  const agentTimezone = calendarConfig.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  const leadSearchSource: 'sales' | 'recruit' = isRecruitAppointmentType(formAppointmentType) ? 'recruit' : 'sales';

  const fetchSchedulerSettings = useCallback(async () => {
    if (!agentEmail) return;
    setSchedulerSettingsLoading(true);
    try {
      const endpoint = resolveServiceUrl(`/api/scheduler/settings?agentEmail=${encodeURIComponent(agentEmail)}`);
      const response = await fetch(endpoint, {
        credentials: getServiceRequestCredentials(endpoint),
        headers: { 'x-user-email': agentEmail },
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.success !== false) {
        const eventTypes = Array.isArray(payload.eventTypes) ? payload.eventTypes : [];
        const bookingPage = payload.bookingPage ?? null;
        setSchedulerSettings({
          bookingPage,
          eventTypes,
          calendarConnections: Array.isArray(payload.calendarConnections) ? payload.calendarConnections : [],
        });
        setBookingSlug(String(bookingPage?.slug || agentEmail.split('@')[0] || ''));
        setBookingActive(Boolean(bookingPage?.active));
        const primaryEvent = eventTypes[0];
        setEventPublic(Boolean(primaryEvent?.public_enabled));
        setEventDuration(String(primaryEvent?.duration_minutes || 60));
        setEventMeetingLink(String(primaryEvent?.meeting_link || ''));
        if (bookingPage?.timezone) {
          setCalendarConfig(prev => ({ ...prev, timezone: String(bookingPage.timezone) }));
        }

        const availabilityEndpoint = resolveServiceUrl(`/api/scheduler/availability?agentEmail=${encodeURIComponent(agentEmail)}${primaryEvent?.id ? `&eventTypeId=${encodeURIComponent(primaryEvent.id)}` : ''}`);
        const availabilityResponse = await fetch(availabilityEndpoint, {
          credentials: getServiceRequestCredentials(availabilityEndpoint),
        });
        const availabilityPayload = await availabilityResponse.json().catch(() => ({}));
        const rules: SchedulerAvailabilityRule[] = Array.isArray(availabilityPayload?.rules) ? availabilityPayload.rules : [];
        if (rules.length > 0) {
          setAvailabilityDays(rules.map(rule => Number(rule.weekday)).filter(day => Number.isFinite(day)));
          setAvailabilityStart(String(rules[0]?.start_time || rules[0]?.startTime || '09:00').slice(0, 5));
          setAvailabilityEnd(String(rules[0]?.end_time || rules[0]?.endTime || '17:00').slice(0, 5));
        }
      }
    } catch (error) {
      console.warn('[AgentCalendarPanel] scheduler settings failed', error);
    } finally {
      setSchedulerSettingsLoading(false);
    }
  }, [agentEmail]);

  useEffect(() => {
    if (!agentEmail) return;
    try {
      const saved = localStorage.getItem(`aoi-meet-calendar-config:${agentEmail.toLowerCase()}`);
      if (saved) {
        setCalendarConfig({ ...DEFAULT_CALENDAR_CONFIG, ...JSON.parse(saved) });
      }
    } catch {
      setCalendarConfig(DEFAULT_CALENDAR_CONFIG);
    }
  }, [agentEmail]);

  useEffect(() => {
    if (!agentEmail) return;
    const endpoint = resolveServiceUrl(`/api/agent/profile-direct?userEmail=${encodeURIComponent(agentEmail)}`);
    fetch(endpoint, { credentials: getServiceRequestCredentials(endpoint) })
      .then(res => (res.ok ? res.json() : null))
      .then(profile => {
        if (!profile) return;
        const zoomId = profile.zoom_id || profile.zoomId;
        const zoomPassword = normalizeZoomPassword(profile.zoom_password || profile.zoomPassword || '');
        const profileTimezone = profile.timezone || profile.time_zone;
        setCalendarConfig(prev => ({
          ...prev,
          zoomLink: prev.zoomLink || (zoomId ? (String(zoomId).startsWith('http') ? String(zoomId) : `https://zoom.us/j/${zoomId}`) : ''),
          zoomPassword: zoomPassword || prev.zoomPassword || '',
          timezone: profileTimezone || prev.timezone || DEFAULT_CALENDAR_CONFIG.timezone,
        }));
      })
      .catch(() => undefined);
  }, [agentEmail]);

  const fetchAppointments = useCallback(async () => {
    if (!agentEmail) return;
    setLoading(true);
    try {
      const firstRange = getZonedDayRange(selectedDate, agentTimezone);
      const lastRange = getZonedDayRange(addDaysToDateKey(selectedDate, 2), agentTimezone);
      const from = firstRange.start.toISOString();
      const to = lastRange.end.toISOString();
      const endpoint = resolveServiceUrl(
        `/api/appointments?agentEmail=${encodeURIComponent(agentEmail)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      const res = await fetch(endpoint, { credentials: getServiceRequestCredentials(endpoint) });
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data) ? data : data.appointments || [];
        setAppointments(rows.filter((row: RawAppointment) => String((row as any).appointment_type || '').toLowerCase() !== 'callback'));
      }
    } catch (e) {
      console.error('[AgentCalendarPanel] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [agentEmail, selectedDate, agentTimezone]);

  const fetchCallbacks = useCallback(async () => {
    if (!agentEmail) return;
    try {
      const todayKey = getZonedDateKey(new Date(), agentTimezone);
      const from = getZonedDayRange(todayKey, agentTimezone).start.toISOString();
      const to = addDays(new Date(from), 31).toISOString();
      const endpoint = resolveServiceUrl(
        `/api/appointments?agentEmail=${encodeURIComponent(agentEmail)}&appointmentType=callback&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      const res = await fetch(endpoint, { credentials: getServiceRequestCredentials(endpoint) });
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data) ? data : data.appointments || [];
        setCallbacks(rows);
      }
    } catch (e) {
      console.error('[AgentCalendarPanel] callbacks fetch error', e);
    }
  }, [agentEmail, agentTimezone]);

  // Listen for open event dispatched from sidebar
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CalendarDraftAppointment | undefined>).detail;
      setOpen(true);
      if (detail) setPendingDraft(detail);
      fetchAppointments();
      fetchCallbacks();
    };
    window.addEventListener('aoirail-open-calendar', handler);
    return () => window.removeEventListener('aoirail-open-calendar', handler);
  }, [fetchAppointments, fetchCallbacks]);

  useEffect(() => {
    if (open) {
      fetchAppointments();
      fetchCallbacks();
    }
  }, [open, fetchAppointments, fetchCallbacks]);

  useEffect(() => {
    if (open) void fetchSchedulerSettings();
  }, [open, fetchSchedulerSettings]);

  useEffect(() => {
    if (!showForm || form.id || !agentEmail || leadSearchQuery.trim().length < 2) {
      setLeadSearchResults([]);
      setLeadSearchLoading(false);
      setLeadSearchError(null);
      return;
    }

    const controller = new AbortController();
    setLeadSearchLoading(true);
    setLeadSearchError(null);

    const timeout = window.setTimeout(async () => {
      try {
        const endpoint = resolveServiceUrl(
          `/api/appointments/lead-search?query=${encodeURIComponent(leadSearchQuery.trim())}&agentEmail=${encodeURIComponent(agentEmail)}&limit=12&leadSource=${encodeURIComponent(leadSearchSource)}`
        );
        const response = await fetch(endpoint, {
          signal: controller.signal,
          credentials: getServiceRequestCredentials(endpoint),
          headers: { 'x-user-email': agentEmail },
        });
        const payload = await response.json();
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error || 'Lead search failed');
        }
        setLeadSearchResults(Array.isArray(payload.results) ? payload.results : []);
      } catch (error: any) {
        if (controller.signal.aborted) return;
        setLeadSearchResults([]);
        setLeadSearchError(error?.message || 'Lead search failed');
      } finally {
        if (!controller.signal.aborted) setLeadSearchLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [agentEmail, form.id, leadSearchQuery, leadSearchSource, showForm]);

  const now = new Date();
  const isPastAndPending = (appt: RawAppointment) => {
    const st = getStartTime(appt);
    return st < now && (!appt.outcome || appt.outcome === 'pending');
  };

  const visibleDays = useMemo(() => {
    return [selectedDate, addDaysToDateKey(selectedDate, 1), addDaysToDateKey(selectedDate, 2)];
  }, [selectedDate]);

  const callbacksTodayCount = useMemo(() => {
    const todayKey = getZonedDateKey(new Date(), agentTimezone);
    return callbacks.filter(cb => getZonedDateKey(getStartTime(cb), agentTimezone) === todayKey).length;
  }, [callbacks, agentTimezone]);

  const callbacksByDay = useMemo(() => {
    const grouped = new Map<string, RawAppointment[]>();
    callbacks
      .slice()
      .sort((a, b) => getStartTime(a).getTime() - getStartTime(b).getTime())
      .forEach(cb => {
        const key = getZonedDateKey(getStartTime(cb), agentTimezone);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(cb);
      });
    return grouped;
  }, [callbacks, agentTimezone]);

  const getReminderDayLabel = (dayKey: string): string => {
    const todayKey = getZonedDateKey(new Date(), agentTimezone);
    const tomorrowKey = addDaysToDateKey(todayKey, 1);
    if (dayKey === todayKey) return 'Today';
    if (dayKey === tomorrowKey) return 'Tomorrow';
    return format(buildLocalDateTime(dayKey, '12:00'), 'EEE, MMM d');
  };

  const appointmentsForDay = (dayKey: string) =>
    appointments
      .filter(appt => getZonedDateKey(getStartTime(appt), agentTimezone) === dayKey)
      .sort((a, b) => getStartTime(a).getTime() - getStartTime(b).getTime());

  const appointmentsForSlot = (dayKey: string, hour: number) =>
    appointmentsForDay(dayKey).filter(appt => getZonedHour(getStartTime(appt), agentTimezone) === hour);

  const getAlpAmount = (appt: RawAppointment): number => {
    const match = String((appt as any).outcome_notes || appt.notes || '').match(/ALP:\s*\$?([0-9.]+)/i);
    return match ? Number(match[1]) || 0 : 0;
  };

  const getDayStats = (day: string) => {
    const dayAppointments = appointmentsForDay(day);
    const booked = dayAppointments.length;
    const presentations = dayAppointments.filter(appt =>
      hasTrackingMarker(appt, 'presentation_started_at') || Boolean(appt.outcome && appt.outcome !== 'pending')
    ).length;
    const sales = dayAppointments.filter(appt => appt.outcome === 'sale').length;
    const alp = dayAppointments.reduce((sum, appt) => sum + getAlpAmount(appt), 0);
    return { booked, presentations, sales, alp };
  };

  const getDayHeaderLabel = (day: string, index: number): string => {
    const todayKey = getZonedDateKey(new Date(), agentTimezone);
    const tomorrowKey = addDaysToDateKey(todayKey, 1);
    if (day === todayKey) return "Today's Schedule";
    if (day === tomorrowKey) return 'Tomorrow';
    return format(buildLocalDateTime(day, '12:00'), 'EEE do');
  };

  const scheduleHours = useMemo(() => {
    const hours = appointments.map(appt => getZonedHour(getStartTime(appt), agentTimezone));
    const minHour = Math.min(8, ...hours);
    const maxHour = Math.max(21, ...hours);
    return Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour);
  }, [appointments, agentTimezone]);

  const openFormForSlot = (dayKey: string, hour: number) => {
    setFormMode('appointment');
    setFormAppointmentType('presentation');
    setFormDispositionSource('manual');
    setFormSendTextConfirmation(false);
    setForm({
      leadId: null,
      date: dayKey,
      time: `${String(hour).padStart(2, '0')}:00`,
      leadName: '',
      spouseName: '',
      leadPhone: '',
      leadMarket: '',
      leadState: '',
      leadCity: '',
      notes: '',
    });
    setLeadSearchQuery('');
    setLeadSearchResults([]);
    setLeadSearchError(null);
    if (typeof window !== 'undefined') {
      setFormModalPosition({
        x: Math.max(24, Math.round(window.innerWidth * 0.18)),
        y: 84,
      });
    }
    setShowForm(true);
  };

  useEffect(() => {
    if (!pendingDraft) return;
    const source = pendingDraft.dispositionSource || 'manual';
    const callbackMode = source === 'callback';
    setFormMode(callbackMode ? 'callback' : 'appointment');
    setFormAppointmentType('presentation');
    const now = new Date();
    const dateKey =
      source === 'instant_presentation'
        ? getZonedDateKey(now, agentTimezone)
        : (selectedDate || getZonedDateKey(now, agentTimezone));
    const defaultTime =
      source === 'instant_presentation'
        ? formatInTimeZone(now, agentTimezone, 'HH:mm')
        : `${String(Math.min(Math.max(8, getZonedHour(now, agentTimezone) + 1), 21)).padStart(2, '0')}:00`;
    setFormDispositionSource(source);
    setFormSendTextConfirmation(false);
    setForm({
      leadId: pendingDraft.leadId ?? null,
      date: dateKey,
      time: defaultTime,
      leadName: pendingDraft.leadName || '',
      spouseName: '',
      leadPhone: pendingDraft.leadPhone || '',
      leadMarket: pendingDraft.leadMarket || '',
      leadState: (pendingDraft.leadState || '').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(),
      leadCity: pendingDraft.leadCity || '',
      notes: source === 'manual' ? '' : `Source: ${dispositionSourceLabel(source)}`,
    });
    setLeadSearchQuery('');
    setLeadSearchResults([]);
    setLeadSearchError(null);
    setShowForm(true);
    setPendingDraft(null);
  }, [agentTimezone, pendingDraft, selectedDate]);

  const openFormForAppointment = (appt: RawAppointment) => {
    setFormMode('appointment');
    const apptType = String((appt as any).appointment_type || '').toLowerCase();
    setFormAppointmentType(isRecruitAppointmentType(apptType) ? apptType : 'presentation');
    const start = getStartTime(appt);
    setFormDispositionSource(getDispositionSourceValue(appt));
    setFormSendTextConfirmation(false);
    setForm({
      id: appt.id,
      leadId: (appt as any).lead_id ?? (appt as any).leadId ?? null,
      date: getZonedDateKey(start, agentTimezone),
      time: formatInTimeZone(start, agentTimezone, 'HH:mm'),
      leadName: getField(appt, 'lead_name', 'leadName'),
      spouseName: getSpouseName(appt),
      leadPhone: getField(appt, 'lead_phone', 'leadPhone'),
      leadMarket: getLeadMarket(appt),
      leadState: getField(appt, 'lead_state', 'leadState'),
      leadCity: getField(appt, 'lead_city', 'leadCity'),
      notes: appt.notes || '',
    });
    setLeadSearchQuery('');
    setLeadSearchResults([]);
    setLeadSearchError(null);
    if (typeof window !== 'undefined') {
      setFormModalPosition({
        x: Math.min(modalPosition.x + 36, Math.max(24, window.innerWidth - 1140)),
        y: Math.max(24, modalPosition.y + 12),
      });
    }
    setSelectedAppointment(null);
    setShowForm(true);
  };

  const openFormForCallback = (cb?: RawAppointment) => {
    setFormMode('callback');
    setFormAppointmentType('presentation');
    setFormDispositionSource('manual');
    setFormSendTextConfirmation(false);
    if (cb) {
      const start = getStartTime(cb);
      setForm({
        id: cb.id,
        leadId: (cb as any).lead_id ?? (cb as any).leadId ?? null,
        date: getZonedDateKey(start, agentTimezone),
        time: formatInTimeZone(start, agentTimezone, 'HH:mm'),
        leadName: getField(cb, 'lead_name', 'leadName'),
        spouseName: getSpouseName(cb),
        leadPhone: getField(cb, 'lead_phone', 'leadPhone'),
        leadMarket: getLeadMarket(cb),
        leadState: getField(cb, 'lead_state', 'leadState'),
        leadCity: getField(cb, 'lead_city', 'leadCity'),
        notes: cb.notes || '',
      });
    } else {
      const nowDate = new Date();
      setForm({
        leadId: null,
        date: getZonedDateKey(nowDate, agentTimezone),
        time: formatInTimeZone(nowDate, agentTimezone, 'HH:mm'),
        leadName: '',
        spouseName: '',
        leadPhone: '',
        leadMarket: '',
        leadState: '',
        leadCity: '',
        notes: '',
      });
    }
    setLeadSearchQuery('');
    setLeadSearchResults([]);
    setLeadSearchError(null);
    if (typeof window !== 'undefined') {
      setFormModalPosition({
        x: Math.max(24, Math.round(window.innerWidth * 0.18)),
        y: 84,
      });
    }
    setShowForm(true);
  };

  const selectLeadForAppointment = (lead: LeadSearchResult) => {
    const leadName =
      lead.name ||
      [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() ||
      'Unknown';
    setForm(prev => ({
      ...prev,
      leadId: lead.taalk_lead_id ?? lead.taalkLeadId ?? lead.lead_id ?? lead.id ?? null,
      leadName,
      spouseName: '',
      leadPhone: String(lead.phone || lead.lead_phone || ''),
      leadMarket: String(lead.taalk_market || lead.market || ''),
      leadState: String(lead.taalk_state || lead.state || '').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(),
      leadCity: String(lead.taalk_city || lead.city || ''),
      notes: prev.notes,
    }));
    setLeadSearchQuery(leadName);
    setLeadSearchResults([]);
  };

  const patchAppointment = async (id: number, body: Record<string, unknown>) => {
    const endpoint = resolveServiceUrl(`/api/appointments/${id}`);
    const res = await fetch(endpoint, {
      method: 'PATCH',
      credentials: getServiceRequestCredentials(endpoint),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.details || 'Appointment update failed');
    await fetchAppointments();
    await fetchCallbacks();
  };

  const moveItemToSlot = async (item: RawAppointment, type: 'appointment' | 'callback', dayKey: string, hour: number) => {
    const startUtc = zonedDateTimeToUtc(dayKey, `${String(hour).padStart(2, '0')}:00`, agentTimezone);
    const endUtc = addHours(startUtc, type === 'callback' ? 0.25 : 1);
    await patchAppointment(item.id, {
      startTime: startUtc.toISOString(),
      endTime: endUtc.toISOString(),
      timezone: agentTimezone,
      status: 'scheduled',
    });
  };

  const handleDropToSlot = async (
    event: React.DragEvent<HTMLDivElement>,
    dayKey: string,
    hour: number,
  ) => {
    event.preventDefault();
    const payloadRaw = event.dataTransfer.getData('application/json');
    if (!payloadRaw) return;
    try {
      const payload = JSON.parse(payloadRaw) as { id: number; kind: 'appointment' | 'callback' };
      const source = payload.kind === 'callback' ? callbacks : appointments;
      const item = source.find(row => Number(row.id) === Number(payload.id));
      if (!item) return;
      await moveItemToSlot(item, payload.kind, dayKey, hour);
    } catch {
      // ignore malformed drops
    }
  };

  const saveOutcome = async (appt: RawAppointment, outcome: string, outcomeNotes?: string) => {
    const endpoint = resolveServiceUrl(`/api/appointments/${appt.id}/outcome`);
    const res = await fetch(endpoint, {
      method: 'PATCH',
      credentials: getServiceRequestCredentials(endpoint),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, outcomeNotes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || data.details || 'Failed to save outcome');
    }
    const outcomeStamp = new Date().toISOString();
    setAppointments(prev =>
      prev.map(item =>
        Number(item.id) === Number(appt.id)
          ? {
              ...item,
              outcome,
              outcome_notes: outcomeNotes ?? null,
              outcome_at: outcomeStamp,
              status: outcome === 'cancelled' ? 'cancelled' : 'completed',
              completed_at: outcome === 'cancelled' ? null : outcomeStamp,
              cancelled_at: outcome === 'cancelled' ? outcomeStamp : null,
            }
          : item,
      ),
    );
    await fetchAppointments();
  };

  const handleSaleOutcome = async (appt: RawAppointment) => {
    const alp = window.prompt('Enter ALP / premium amount for this sale');
    if (!alp) return;
    const cleanAlp = alp.replace(/[^0-9.]/g, '');
    if (!cleanAlp || Number(cleanAlp) <= 0) {
      alert('Enter a valid ALP amount.');
      return;
    }
    await saveOutcome(appt, 'sale', `ALP: $${cleanAlp}`);
  };

  const handleSaveForm = async () => {
    if (!agentEmail) return;
    if (!form.leadName.trim() || !form.leadPhone.trim()) {
      alert('Lead name and phone are required.');
      return;
    }

    setSavingForm(true);
    try {
      let appointmentIdForTexts: number | null = null;
      const startUtc = zonedDateTimeToUtc(form.date, form.time, agentTimezone);
      const end = addHours(startUtc, formMode === 'callback' ? 0.25 : 1);
      const displayLeadName = buildHouseholdName(form.leadName, form.spouseName);
      const notes = [form.notes, form.spouseName ? `Spouse: ${form.spouseName}` : '', form.leadMarket ? `Market: ${form.leadMarket}` : '']
        .filter(Boolean)
        .join('\n');
      const zoomLink = calendarConfig.zoomLink.trim();
      const zoomPassword = normalizeZoomPassword(calendarConfig.zoomPassword);
      const effectiveAppointmentType = formMode === 'callback' ? 'callback' : formAppointmentType;
      const appointmentLabel =
        effectiveAppointmentType === 'recruit_group_overview'
          ? 'Recruit Group Overview'
          : effectiveAppointmentType === 'recruit_interview'
            ? 'Recruit Interview'
            : 'Appointment';

      if (form.id) {
        appointmentIdForTexts = Number(form.id);
        await patchAppointment(form.id, {
          title: `${formMode === 'callback' ? 'Callback with' : `${appointmentLabel} with`} ${displayLeadName}`,
          startTime: startUtc.toISOString(),
          endTime: end.toISOString(),
          timezone: agentTimezone,
          leadName: displayLeadName,
          leadPhone: form.leadPhone,
          leadId: form.leadId || null,
          leadState: form.leadState || null,
          leadCity: form.leadCity || null,
          notes: notes || null,
          status: 'scheduled',
          appointmentType: effectiveAppointmentType,
          zoomPassword: formMode === 'callback' ? null : (zoomPassword || null),
        });
      } else {
        const endpoint = resolveServiceUrl('/api/appointments');
        const res = await fetch(endpoint, {
          method: 'POST',
          credentials: getServiceRequestCredentials(endpoint),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `${formMode === 'callback' ? 'Callback with' : `${appointmentLabel} with`} ${displayLeadName}`,
            appointmentType: effectiveAppointmentType,
            startTime: startUtc.toISOString(),
            endTime: end.toISOString(),
            duration: formMode === 'callback' ? 15 : 60,
            timezone: agentTimezone,
            agentId: agentEmail,
            agentEmail,
            agentName,
            leadId: form.leadId || null,
            leadName: displayLeadName,
            leadPhone: form.leadPhone,
            leadMarket: form.leadMarket || null,
            leadState: form.leadState || null,
            leadCity: form.leadCity || null,
            meetingPlatform: formMode === 'callback' ? null : 'zoom',
            meetingLink: formMode === 'callback' ? null : (zoomLink || null),
            zoomJoinUrl: formMode === 'callback' ? null : (zoomLink || null),
            zoomPassword: formMode === 'callback' ? null : (zoomPassword || null),
            notes: notes || null,
            status: 'scheduled',
            dispositionSource: formMode === 'callback' ? 'callback' : formDispositionSource,
            outcome: 'pending',
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.details || data.error || 'Appointment create failed');
        appointmentIdForTexts = Number(data?.appointment?.id || data?.id || 0) || null;
        await fetchAppointments();
        await fetchCallbacks();
      }

      if (formMode === 'appointment' && !isRecruitAppointmentType(formAppointmentType) && formSendTextConfirmation) {
        if (!appointmentIdForTexts) {
          throw new Error('Appointment saved but could not resolve id for text confirmation');
        }
        const sendEndpoint = resolveServiceUrl(`/api/appointments/${appointmentIdForTexts}/send-client-texts`);
        const sendRes = await fetch(sendEndpoint, {
          method: 'POST',
          credentials: getServiceRequestCredentials(sendEndpoint),
          headers: { 'Content-Type': 'application/json' },
        });
        const sendData = await sendRes.json().catch(() => ({}));
        if (!sendRes.ok || sendData.success === false) {
          throw new Error(sendData.error || sendData.details || 'Appointment saved, but text confirmation failed');
        }
      }

      setShowForm(false);
    } catch (error: any) {
      alert(error?.message || 'Failed to save appointment.');
    } finally {
      setSavingForm(false);
    }
  };

  const appendTrackingNote = (appt: RawAppointment, label: string) => {
    const stamp = `${label}: ${new Date().toISOString()}`;
    const nextNotes = [appt.notes || '', stamp].filter(Boolean).join('\n');
    return patchAppointment(appt.id, { notes: nextNotes, status: label === 'meet_started_at' ? 'confirmed' : 'confirmed' });
  };

  const handleJoin = async (appt: RawAppointment) => {
    await appendTrackingNote(appt, 'meet_started_at');
    const link = getMeetingLink(appt);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  const handleStartPresentation = async (appt: RawAppointment) => {
    await appendTrackingNote(appt, 'presentation_started_at');
    window.open('https://hppro.planetaltig.com/#/', '_blank', 'width=1600,height=1000,resizable=yes,scrollbars=yes');
  };

  const handleSendTextConfirmationAndReminders = async (appt: RawAppointment) => {
    const zoomLink = getMeetingLink(appt).trim();
    if (!zoomLink) {
      alert('Please make sure Zoom info is saved before sending text confirmation.');
      return;
    }
    const endpoint = resolveServiceUrl(`/api/appointments/${appt.id}/send-client-texts`);
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: getServiceRequestCredentials(endpoint),
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || data.details || 'Failed to send text confirmation');
    }
    await fetchAppointments();
    setSelectedAppointment(prev => (prev ? { ...prev, confirmation_status: 'sent' } : prev));
    alert('Text confirmation sent and reminders are enabled for this client.');
  };

  const saveSchedulerControls = async () => {
    if (!agentEmail) return;
    const primaryEvent = schedulerSettings?.eventTypes?.[0];
    setSchedulerSaving(true);
    try {
      const settingsEndpoint = resolveServiceUrl('/api/scheduler/settings');
      await fetch(settingsEndpoint, {
        method: 'PUT',
        credentials: getServiceRequestCredentials(settingsEndpoint),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentEmail,
          slug: bookingSlug,
          active: bookingActive,
          timezone: agentTimezone,
        }),
      });

      if (primaryEvent?.id) {
        const eventEndpoint = resolveServiceUrl(`/api/scheduler/event-types/${primaryEvent.id}`);
        await fetch(eventEndpoint, {
          method: 'PATCH',
          credentials: getServiceRequestCredentials(eventEndpoint),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentEmail,
            durationMinutes: Number(eventDuration || 60),
            publicEnabled: eventPublic,
            meetingLink: eventMeetingLink || null,
          }),
        });
      }

      const availabilityEndpoint = resolveServiceUrl('/api/scheduler/availability');
      await fetch(availabilityEndpoint, {
        method: 'PUT',
        credentials: getServiceRequestCredentials(availabilityEndpoint),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentEmail,
          eventTypeId: primaryEvent?.id || null,
          timezone: agentTimezone,
          rules: availabilityDays.map(weekday => ({
            weekday,
            startTime: availabilityStart,
            endTime: availabilityEnd,
            timezone: agentTimezone,
            active: true,
          })),
        }),
      });

      await fetchSchedulerSettings();
    } catch (error: any) {
      alert(error?.message || 'Failed to save scheduler settings.');
    } finally {
      setSchedulerSaving(false);
    }
  };

  useEffect(() => {
    if (!agentEmail) return;
    try {
      localStorage.setItem(`aoi-meet-calendar-config:${agentEmail.toLowerCase()}`, JSON.stringify(calendarConfig));
    } catch {
      // best-effort local persistence
    }
  }, [agentEmail, calendarConfig]);

  const copyBookingLink = async () => {
    const slug = bookingSlug || schedulerSettings?.bookingPage?.slug || agentEmail.split('@')[0];
    await navigator.clipboard?.writeText(`${window.location.origin}/book/${slug}`).catch(() => undefined);
  };

  const toggleAvailabilityDay = (weekday: number) => {
    setAvailabilityDays(prev =>
      prev.includes(weekday)
        ? prev.filter(day => day !== weekday)
        : [...prev, weekday].sort((a, b) => a - b),
    );
  };

  const appointmentToLead = (appt: RawAppointment): Lead => {
    const leadName = getField(appt, 'lead_name', 'leadName') || 'Appointment Lead';
    const leadPhone = getField(appt, 'lead_phone', 'leadPhone') || '';
    const leadState = getField(appt, 'lead_state', 'leadState') || '';
    const market = getLeadMarket(appt) || 'Appointment';
    return {
      id: String(appt.id),
      leadId: String((appt as any).lead_id || appt.id),
      taalk_lead_id: String((appt as any).lead_id || ''),
      name: leadName,
      phone: leadPhone,
      market,
      taalk_market: market,
      state: leadState,
      city: String((appt as any).lead_city || ''),
      status: isResolvedOutcome(appt.outcome) ? 'resolved' : (appt.status || 'scheduled'),
      timestamp: appt.start_time || appt.startTime || new Date().toISOString(),
      notes: appt.notes || '',
      appointment_notes: appt.notes || '',
      appointment_date: appt.start_time || appt.startTime || null,
      rawWebhookData: {
        appointment_id: appt.id,
        appointment_time: appt.start_time || appt.startTime,
        outcome: appt.outcome,
        market,
        state: leadState,
      },
    };
  };

  const formToLead = (draft: AppointmentFormState): Lead => {
    const householdName = buildHouseholdName(draft.leadName || 'Appointment Lead', draft.spouseName);
    const normalizedPhone = String(draft.leadPhone || '').replace(/\D/g, '');
    const market = String(draft.leadMarket || 'Appointment').trim() || 'Appointment';
    const state = String(draft.leadState || '').trim().toUpperCase();
    const slotLocal = buildLocalDateTime(draft.date || asDateInputValue(new Date()), draft.time || '08:00');
    return {
      id: String(draft.id || draft.leadId || `draft-${draft.date}-${draft.time}`),
      leadId: String(draft.leadId || draft.id || 'draft'),
      taalk_lead_id: String(draft.leadId || ''),
      name: householdName,
      phone: normalizedPhone,
      market,
      taalk_market: market,
      state,
      city: String(draft.leadCity || ''),
      status: 'scheduled',
      timestamp: slotLocal.toISOString(),
      call_status: 'pending',
      is_called: false,
      leadSource: 'appointment',
      daysUntilExpiration: 0,
      isAgedLead: false,
      appointment_date: slotLocal.toISOString(),
      rawWebhookData: {
        appointment_time: slotLocal.toISOString(),
        market,
        state,
      },
    };
  };

  const buildLeadDisplayState = (lead: Lead): DialerState => ({
    webRTCConferenceActive: false,
    powered: false,
    campaignActive: false,
    dialingStatus: 'idle',
    currentCall: null,
    callNotes: '',
    selectedDisposition: '',
    dispositionApplied: false,
    availableLeads: [lead],
    currentLeadIndex: 0,
    callStatus: 'idle',
    customerCallStatus: {
      hasCustomer: Boolean(lead.phone),
      hasPendingCall: false,
      status: 'idle',
    },
    vdpCallStatus: {
      hasVDPCall: false,
      vdpCall: null,
      countdownValue: 0,
      countdownActive: false,
    },
    callDuration: 0,
    viewedLead: lead,
    inboundCallInfo: null,
    inboundCallLead: null,
  });

  useEffect(() => {
    if (!dragOffset) return;
    const handleMove = (event: MouseEvent) => {
      setModalPosition({
        x: Math.max(12, event.clientX - dragOffset.x),
        y: Math.max(12, event.clientY - dragOffset.y),
      });
    };
    const handleUp = () => setDragOffset(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragOffset]);

  useEffect(() => {
    if (!formDragOffset) return;
    const handleMove = (event: MouseEvent) => {
      setFormModalPosition({
        x: Math.max(12, event.clientX - formDragOffset.x),
        y: Math.max(12, event.clientY - formDragOffset.y),
      });
    };
    const handleUp = () => setFormDragOffset(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [formDragOffset]);

  const renderTimeline = (appt: RawAppointment) => {
    const resolved = Boolean(appt.outcome && appt.outcome !== 'pending');
    const meetStarted = hasTrackingMarker(appt, 'meet_started_at') || hasTrackingMarker(appt, 'presentation_started_at') || resolved;
    const outcomeLabel =
      appt.outcome === 'sale'
        ? `Sale ${String((appt as any).outcome_notes || appt.notes || '').match(/ALP:\s*\$?([0-9.]+)/i)?.[1] ? `· $${String((appt as any).outcome_notes || appt.notes || '').match(/ALP:\s*\$?([0-9.]+)/i)?.[1]}` : ''}`
        : resolved
          ? (appt.outcome || '').replace(/_/g, ' ')
          : 'Resolution';
    const stages = [
      { key: 'appointment', label: 'Appointment', done: true, active: !meetStarted && !resolved },
      { key: 'meet', label: 'Meet', done: meetStarted || resolved, active: meetStarted && !resolved },
      { key: 'resolution', label: outcomeLabel, done: resolved, active: resolved },
    ];
    return (
      <div className="mt-2">
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1">
          {stages.map(stage => (
            <React.Fragment key={stage.key}>
              <div
                className={`truncate text-center text-[8px] font-black uppercase tracking-wide ${
                  stage.active
                    ? 'bg-gradient-to-r from-blue-700 via-violet-700 to-fuchsia-700 bg-clip-text text-transparent'
                    : stage.done
                      ? 'text-emerald-700'
                      : 'text-slate-500'
                }`}
              >
                {stage.label}
              </div>
              {stage.key !== 'resolution' && (
                <div className={`${stage.done ? 'text-emerald-700' : 'text-slate-400'} text-[9px]`}>→</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const renderAppointmentCard = (appt: RawAppointment, compact = false) => {
    const past = isPastAndPending(appt);
    const tone = getOutcomeTone(appt);
    const resolved = isResolvedOutcome(appt.outcome);
    const outcomeLabel = formatOutcomeLabel(appt.outcome);
    const alpAmount = appt.outcome === 'sale' ? getAlpAmount(appt) : 0;
    const clientName = getField(appt, 'lead_name', 'leadName') || 'Unnamed lead';
    const spouseName = getSpouseName(appt);
    const displayName = buildHouseholdName(clientName, spouseName);
    const market = getLeadMarket(appt) || 'Unknown';
    const sourceLabel = dispositionSourceLabel(getDispositionSourceValue(appt));
    return (
      <div
        key={appt.id}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('application/json', JSON.stringify({ id: appt.id, kind: 'appointment' }));
          event.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => setSelectedAppointment(appt)}
        className={`group relative flex min-h-[46px] cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-xl border px-3 py-2 text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:z-20 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(59,130,246,0.18)] ${
          tone === 'positive'
            ? 'border-emerald-300/60 bg-emerald-100/80'
            : tone === 'negative'
              ? 'border-red-300/60 bg-red-100/80'
            : past
              ? 'border-amber-300/60 bg-amber-100/80'
              : 'border-slate-300/80 bg-slate-100/90 hover:border-slate-400/80'
        }`}
      >
        <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-sky-200/60" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-black leading-tight text-slate-900">
            {displayName}
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <div className="truncate text-[10px] font-bold uppercase tracking-wide text-sky-700">{market}</div>
            {sourceLabel === 'Instant' && (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-blue-700 ring-1 ring-blue-200">
                Instant
              </span>
            )}
          </div>
          {resolved && (
            <div className="mt-1 rounded-md border border-emerald-300/70 bg-emerald-100/85 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">
              Resolved: {outcomeLabel}
              {appt.outcome === 'sale' && alpAmount > 0 ? ` · ALP $${alpAmount}` : ''}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {resolved ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void saveOutcome(appt, 'pending').catch((error: any) => {
                  alert(error?.message || 'Failed to undo resolution');
                });
              }}
              className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
              title="Undo resolution"
            >
              Undo
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleSaleOutcome(appt);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-base font-black text-emerald-700 transition hover:bg-emerald-200"
                title="Mark sale"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setNoSaleTarget(appt);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-red-300 bg-red-100 text-base font-black text-red-700 transition hover:bg-red-200"
                title="Mark no sale"
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderDayColumn = (day: string, index: number) => {
    const dayDate = buildLocalDateTime(day, '12:00');
    const dayAppointments = appointmentsForDay(day);
    return (
      <div key={day} className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-sky-200/60 bg-white/75">
        <div className="sticky top-0 z-10 rounded-t-2xl border-b border-sky-200/60 bg-white/90 px-3 py-2 backdrop-blur">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">
            {index === 0 ? "Today's Schedule" : getDayLabel(dayDate)}
          </div>
          <div className="text-sm font-black text-slate-900">{format(dayDate, 'EEE, MMM d')}</div>
          <div className="text-[10px] text-slate-600">{dayAppointments.length} booked</div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          {scheduleHours.map(hour => {
            const slotAppointments = appointmentsForSlot(day, hour);
            return (
              <div key={hour} className="grid min-h-[112px] grid-cols-[52px_1fr] gap-2 rounded-xl border border-sky-100/80 bg-white/70 p-2">
                <button
                  type="button"
                  onClick={() => openFormForSlot(day, hour)}
                  className="rounded-lg bg-sky-100/70 px-1 py-2 text-center text-[10px] font-black text-slate-700 hover:bg-sky-200 hover:text-sky-800"
                  title="Add appointment in this slot"
                >
                  {formatSlotHour(hour)}
                  <Plus className="mx-auto mt-1 h-3 w-3" />
                </button>
                <div className="space-y-2 overflow-visible">
                  {slotAppointments.length > 0 ? (
                    slotAppointments.map(appt => renderAppointmentCard(appt, true))
                  ) : (
                    <button
                      type="button"
                      onClick={() => openFormForSlot(day, hour)}
                      className="flex h-full min-h-[54px] w-full items-center justify-center rounded-lg border border-dashed border-sky-200/80 bg-white/70 text-[11px] font-semibold text-slate-600 hover:border-sky-400/60 hover:bg-sky-100 hover:text-sky-700"
                    >
                      Open slot
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderScheduleBoard = () => (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-sky-200/60 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-sky-200/60 bg-white/85 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, -1))}
          className="rounded-2xl bg-sky-100 p-2.5 text-sky-700 transition hover:bg-sky-200"
          title="Previous days"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-700">3-Day Board</div>
          <div className="text-sm font-black text-slate-900">
            {format(buildLocalDateTime(visibleDays[0], '12:00'), 'MMM d')} - {format(buildLocalDateTime(visibleDays[2], '12:00'), 'MMM d')}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, 1))}
          className="rounded-2xl bg-sky-100 p-2.5 text-sky-700 transition hover:bg-sky-200"
          title="Next days"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      </div>
      <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] border-b border-sky-200/60 bg-sky-50/80 text-slate-900">
        <div className="border-r border-sky-200/60 px-2 py-2 text-center text-[10px] font-black uppercase tracking-widest text-sky-700">
          Time
        </div>
        {visibleDays.map((day, index) => (
          <div key={day} className="border-r border-sky-200/60 px-3 py-2 last:border-r-0">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">
              {getDayHeaderLabel(day, index)}
            </div>
            <div className="text-sm font-black text-slate-900">{format(buildLocalDateTime(day, '12:00'), 'EEE, MMM d')}</div>
            {(() => {
              const stats = getDayStats(day);
              return (
                <div className="mt-2 grid grid-cols-4 gap-1">
                  <div className="rounded-lg bg-white px-1.5 py-1 text-center shadow-sm ring-1 ring-sky-100">
                    <div className="text-[9px] font-black text-slate-500">Booked</div>
                    <div className="text-xs font-black text-slate-900">{stats.booked}</div>
                  </div>
                  <div className="rounded-lg bg-white px-1.5 py-1 text-center shadow-sm ring-1 ring-sky-100">
                    <div className="text-[9px] font-black text-slate-500">Pres</div>
                    <div className="text-xs font-black text-blue-700">{stats.presentations}</div>
                  </div>
                  <div className="rounded-lg bg-white px-1.5 py-1 text-center shadow-sm ring-1 ring-sky-100">
                    <div className="text-[9px] font-black text-slate-500">Sales</div>
                    <div className="text-xs font-black text-emerald-700">{stats.sales}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-100 px-1.5 py-1 text-center shadow-sm ring-1 ring-emerald-200">
                    <div className="text-[9px] font-black text-emerald-700">ALP</div>
                    <div className="text-xs font-black text-emerald-800">${stats.alp.toLocaleString()}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {scheduleHours.map(hour => {
          const maxSlotCount = Math.max(1, ...visibleDays.map(day => appointmentsForSlot(day, hour).length));
          const rowMinHeight = Math.max(58, maxSlotCount * 54 + 10);
          return (
          <div
            key={hour}
            className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] border-b border-sky-100/80 last:border-b-0"
            style={{ minHeight: rowMinHeight }}
          >
            <button
              type="button"
              onClick={() => openFormForSlot(visibleDays[0], hour)}
              className="sticky left-0 z-10 flex min-h-full flex-col items-center justify-center border-r border-sky-100 bg-sky-50/70 text-[9px] font-black text-slate-600 hover:bg-sky-100 hover:text-sky-700"
              title="Add appointment in this hour"
            >
              {formatSlotHour(hour)}
              <Plus className="mt-0.5 h-2.5 w-2.5" />
            </button>

            {visibleDays.map(day => {
              const slotAppointments = appointmentsForSlot(day, hour);
              return (
                <div
                  key={`${day}-${hour}`}
                  className="min-h-full border-r border-sky-100 bg-white/70 p-1.5 last:border-r-0"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { void handleDropToSlot(event, day, hour); }}
                >
                  <div className="max-h-[52px] space-y-1.5 overflow-y-auto pr-1">
                    {slotAppointments.length > 0 ? (
                      slotAppointments.map(appt => renderAppointmentCard(appt, true))
                    ) : (
                      <button
                        type="button"
                        onClick={() => openFormForSlot(day, hour)}
                        className="flex h-full min-h-[42px] w-full items-center justify-center rounded-xl border border-dashed border-sky-200/80 bg-white/80 text-[10px] font-bold text-slate-500 hover:border-sky-300/70 hover:bg-sky-100/80 hover:text-sky-700"
                      >
                        Open slot
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          );
        })}
      </div>
    </div>
  );

  const renderMiniCalendar = () => {
    const monthStart = startOfMonth(buildLocalDateTime(selectedDate, '00:00'));
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days: Date[] = [];
    for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
      days.push(day);
    }
    const selected = buildLocalDateTime(selectedDate, '00:00');
    return (
      <div className="rounded-3xl border border-sky-200/70 bg-white/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-sky-700">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div className="mt-1 text-sm font-black text-slate-900">{format(monthStart, 'MMMM yyyy')}</div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(asDateInputValue(new Date()))}
            className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black uppercase text-slate-700 hover:bg-sky-200"
          >
            Today
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-slate-400">
          {['S', 'M', 'T', 'W', 'Th', 'F', 'S'].map((day, index) => <div key={`${day}-${index}`}>{day}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map(day => {
            const active = isSameDay(day, selected);
            const currentMonth = isSameMonth(day, monthStart);
            const hasAppt = appointments.some(appt => isSameDay(getStartTime(appt), day));
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDate(asDateInputValue(day))}
                className={`relative rounded-lg py-1.5 text-[11px] font-black transition ${
                  active
                    ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.45)]'
                    : currentMonth
                      ? 'bg-white text-slate-700 ring-1 ring-sky-100 hover:bg-sky-100 hover:text-sky-700'
                      : 'bg-transparent text-slate-600'
                }`}
              >
                {format(day, 'd')}
                {hasAppt && <span className="absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-300" />}
              </button>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSelectedDate(asDateInputValue(addDays(selected, -1)))} className="rounded-lg bg-sky-100 px-2 py-2 text-xs font-bold text-slate-700 hover:bg-sky-200">
            Prev
          </button>
          <button type="button" onClick={() => setSelectedDate(asDateInputValue(addDays(selected, 1)))} className="rounded-lg bg-sky-100 px-2 py-2 text-xs font-bold text-slate-700 hover:bg-sky-200">
            Next
          </button>
        </div>
      </div>
    );
  };

  const renderSchedulerSettingsPanel = () => {
    const google = schedulerSettings?.calendarConnections.find(connection => connection.provider === 'google');
    const outlook = schedulerSettings?.calendarConnections.find(connection => connection.provider === 'outlook');
    const bookingLink = `/book/${bookingSlug || schedulerSettings?.bookingPage?.slug || agentEmail.split('@')[0]}`;
    return (
      <div className="rounded-3xl border border-sky-200/70 bg-white/85 p-3 text-xs text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-sky-700">Scheduler</div>
            <div className="text-xs font-semibold text-slate-600">Calendly-style controls</div>
          </div>
          {schedulerSettingsLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-600" />}
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-sky-200/70 bg-white/90 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-black text-slate-900">Booking page</div>
              <button type="button" onClick={copyBookingLink} className="rounded-full bg-sky-100 p-1.5 text-sky-700 hover:bg-sky-200" title="Copy booking link">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Slug
              <input value={bookingSlug} onChange={event => setBookingSlug(event.target.value)} className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-sky-400/70" />
            </label>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="truncate text-[11px] font-semibold text-sky-700">{bookingLink}</div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-600">
                <input type="checkbox" checked={bookingActive} onChange={event => setBookingActive(event.target.checked)} />
                Live
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200/70 bg-white/90 p-3">
            <div className="mb-2 font-black text-slate-900">AOI Presentation</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Duration
                <input value={eventDuration} onChange={event => setEventDuration(event.target.value)} className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none" />
              </label>
              <label className="flex items-end gap-1.5 pb-1.5 text-[10px] font-black uppercase text-slate-600">
                <input type="checkbox" checked={eventPublic} onChange={event => setEventPublic(event.target.checked)} />
                Public
              </label>
            </div>
            <label className="mt-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Calendar timezone
              <select
                value={agentTimezone}
                onChange={event => setCalendarConfig(prev => ({ ...prev, timezone: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none"
              >
                {CALENDAR_TIMEZONE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Meeting link
              <input value={eventMeetingLink} onChange={event => setEventMeetingLink(event.target.value)} placeholder="https://zoom.us/j/..." className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none" />
            </label>
          </div>

          <div className="rounded-2xl border border-sky-200/70 bg-white/90 p-3">
            <div className="mb-2 font-black text-slate-900">Availability</div>
            <div className="grid grid-cols-7 gap-1">
              {['S', 'M', 'T', 'W', 'Th', 'F', 'S'].map((label, weekday) => (
                <button key={label} type="button" onClick={() => toggleAvailabilityDay(weekday)} className={`rounded-lg px-1 py-1 text-[10px] font-black ${availabilityDays.includes(weekday) ? 'bg-sky-500 text-white' : 'bg-sky-100 text-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input type="time" value={availabilityStart} onChange={event => setAvailabilityStart(event.target.value)} className="rounded-xl border border-sky-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none" />
              <input type="time" value={availabilityEnd} onChange={event => setAvailabilityEnd(event.target.value)} className="rounded-xl border border-sky-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              ['Google', google],
              ['Outlook', outlook],
            ].map(([label, connection]) => {
              const connected = Boolean(connection && typeof connection === 'object');
              return (
                <button
                  key={String(label)}
                  type="button"
                  className={`rounded-xl border p-2 text-left transition ${
                    connected
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                      : 'border-sky-200 bg-sky-50 text-slate-700 hover:border-sky-300 hover:bg-sky-100'
                  }`}
                  title={`${label} sync`}
                >
                  <div className="font-black">{String(label)}</div>
                  <div className="mt-0.5 text-[10px] font-semibold">
                    {connected ? 'Connected' : 'Connect'}
                  </div>
                </button>
              );
            })}
          </div>
          <button type="button" disabled={schedulerSaving} onClick={() => void saveSchedulerControls()} className="w-full rounded-2xl bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 px-3 py-2 text-xs font-black uppercase tracking-widest text-white shadow-[0_12px_30px_rgba(59,130,246,0.28)] disabled:opacity-60">
            {schedulerSaving ? 'Saving...' : 'Save Scheduler'}
          </button>
        </div>
      </div>
    );
  };

  const renderCallbacksPanel = () => {
    const dayKeys = Array.from(callbacksByDay.keys());
    return (
      <div className="rounded-3xl border border-sky-200/70 bg-white/90 p-3 text-xs text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-sky-700">Callbacks</div>
            <div className="text-xs font-semibold text-slate-600">{callbacksTodayCount}/5 today</div>
          </div>
          <button
            type="button"
            onClick={() => openFormForCallback()}
            disabled={callbacksTodayCount >= 5}
            className="rounded-full bg-sky-100 p-2 text-sky-700 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
            title={callbacksTodayCount >= 5 ? 'Daily callback limit reached (5)' : 'Add callback'}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
          {dayKeys.length === 0 && (
            <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 text-[11px] font-semibold text-slate-600">
              No callbacks yet.
            </div>
          )}
          {dayKeys.map(dayKey => (
            <div key={dayKey} className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-sky-700">{getReminderDayLabel(dayKey)}</div>
              {(callbacksByDay.get(dayKey) || []).map(cb => {
                const callbackStart = getStartTime(cb);
                const callbackTime = callbackStart.getTime();
                const nowTime = Date.now();
                const isOverdue = callbackTime < nowTime;
                const isToday = dayKey === getZonedDateKey(new Date(), agentTimezone);
                const toneClass = isOverdue
                  ? 'border-red-200 bg-red-50 hover:bg-red-100'
                  : isToday
                    ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                    : 'border-slate-200 bg-slate-50 hover:bg-sky-50';
                const timeClass = isOverdue ? 'text-red-700' : isToday ? 'text-amber-700' : 'text-sky-700';
                return (
                  <button
                    key={cb.id}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/json', JSON.stringify({ id: cb.id, kind: 'callback' }));
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={() => openFormForCallback(cb)}
                    className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${toneClass}`}
                    title="Drag to a slot or click to edit"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-[11px] font-black text-slate-900">{getField(cb, 'lead_name', 'leadName') || 'Callback'}</div>
                      {isOverdue && (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-700">
                          Overdue
                        </span>
                      )}
                    </div>
                    <div className={`text-[10px] font-bold ${timeClass}`}>
                      {formatInTimeZone(callbackStart, agentTimezone, 'h:mm a')}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* In-content My Calendar panel: leaves the app sidebar and top header visible. */}
      <div
        className={`fixed bottom-6 right-6 top-[92px] z-[9999] transform overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#7dd3fc] via-[#a5b4fc] to-[#f0abfc] p-[1.5px] text-slate-900 shadow-[0_26px_90px_rgba(15,23,42,0.25)] transition-all duration-300 max-lg:left-3 max-lg:right-3 ${
          open ? 'translate-x-0 opacity-100' : '-translate-x-8 pointer-events-none opacity-0'
        }`}
        style={{ left: 'clamp(248px, 18vw, 304px)' }}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(2rem-1px)] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.20),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(125,211,252,0.18),transparent_38%),linear-gradient(180deg,rgba(248,252,255,0.96),rgba(241,245,255,0.95))] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-sky-200/70" />
          {/* Header */}
          <div className="flex items-center justify-between border-b border-sky-200/70 bg-white/75 px-4 py-3 backdrop-blur-xl">
            <div />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openFormForSlot(selectedDate, 8)}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 px-4 py-2 text-xs font-black text-white shadow-lg shadow-blue-900/30 hover:brightness-110"
                title="Add appointment"
              >
                <Plus className="h-4 w-4" />
                Add Appointment
              </button>
              <button
                type="button"
                onClick={fetchAppointments}
                className="rounded-full bg-sky-100 p-2 text-slate-700 hover:bg-sky-200"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowConfig(prev => !prev)}
                className={`rounded-full p-2 ${showConfig ? 'bg-sky-200 text-sky-700 ring-1 ring-sky-300' : 'bg-sky-100 text-slate-700 hover:bg-sky-200'}`}
                title="Scheduler settings"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-red-500/80 p-2 text-white hover:bg-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-amber-300/60 bg-amber-100/90 px-4 py-2 text-center text-[11px] font-black uppercase tracking-wide text-amber-800">
            AOI: Meet is in beta - make sure you schedule your appointments normally as well as data can be lost
          </div>

          {/* Body */}
          <div className="grid min-h-0 flex-1 grid-cols-[250px_1fr] gap-3 overflow-hidden px-4 py-3">
            <aside className="flex min-h-0 flex-col gap-3">
              {renderMiniCalendar()}
              {showConfig && renderSchedulerSettingsPanel()}
              {renderCallbacksPanel()}
            </aside>

            <div className="min-h-0 overflow-y-auto pr-1">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              </div>
            )}

            {!loading && renderScheduleBoard()}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-sky-200/70 bg-white/75 px-4 py-3">
            <span className="text-xs font-semibold text-slate-600">{appointments.length} appointment{appointments.length !== 1 ? 's' : ''}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-sky-200"
            >
              <X className="h-3 w-3" />
              Close
            </button>
          </div>
        </div>
      </div>

      {showOutcome && outcomeTarget.length > 0 && (
        <AppointmentOutcomeModal
          isOpen={showOutcome}
          appointments={outcomeTarget as any}
          onClose={() => setShowOutcome(false)}
          onOutcomeSaved={() => { setShowOutcome(false); fetchAppointments(); }}
        />
      )}

      {selectedAppointment && (
        <div
          className="fixed z-[10001] max-h-[calc(100vh-24px)] w-[min(920px,calc(100vw-24px))] overflow-hidden rounded-3xl bg-gradient-to-br from-[#7dd3fc] via-[#a5b4fc] to-[#f0abfc] p-[1.5px] text-slate-900 shadow-[0_26px_90px_rgba(15,23,42,0.35)]"
          style={{ left: modalPosition.x, top: modalPosition.y }}
          onClick={event => event.stopPropagation()}
        >
          <div className="overflow-hidden rounded-[calc(1.5rem-1px)] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_34%),linear-gradient(180deg,rgba(248,252,255,0.98),rgba(241,245,255,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
          <div
            className="flex cursor-move items-center justify-between border-b border-sky-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl"
            onMouseDown={(event) => {
              setDragOffset({
                x: event.clientX - modalPosition.x,
                y: event.clientY - modalPosition.y,
              });
            }}
          >
            <div className="min-w-0">
              {(() => {
                const rawName = getField(selectedAppointment, 'lead_name', 'leadName') || 'Appointment';
                const spouse = getSpouseName(selectedAppointment);
                const household = buildHouseholdName(rawName, spouse);
                return (
              <div className="flex items-center gap-2">
                <div className="truncate bg-gradient-to-r from-sky-600 via-blue-600 to-violet-600 bg-clip-text text-sm font-black uppercase tracking-widest text-transparent">
                  {household}
                </div>
                <button
                  type="button"
                  onMouseDown={event => event.stopPropagation()}
                  onClick={() => openFormForAppointment(selectedAppointment)}
                  className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-sky-700 transition hover:bg-sky-200"
                  title="Edit appointment details"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              </div>
                );
              })()}
              <div className="text-xs text-slate-600">{formatApptTime(selectedAppointment, agentTimezone)}</div>
            </div>
            <button
              type="button"
              onMouseDown={event => event.stopPropagation()}
              onClick={() => setSelectedAppointment(null)}
              className="rounded-full bg-sky-100 p-2 text-slate-700 hover:bg-sky-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[calc(100vh-88px)] space-y-3 overflow-y-auto p-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-xs">
              <span className="rounded-full bg-white px-2.5 py-1 font-black text-slate-800 ring-1 ring-sky-100">{formatApptTime(selectedAppointment, agentTimezone)}</span>
              <span className="rounded-full bg-white px-2.5 py-1 font-bold text-sky-700 ring-1 ring-sky-100">
                {selectedAppointment.outcome && selectedAppointment.outcome !== 'pending'
                  ? selectedAppointment.outcome.replace(/_/g, ' ')
                  : getDispositionSourceValue(selectedAppointment) === 'instant_presentation'
                    ? 'Instant'
                  : hasTrackingMarker(selectedAppointment, 'meet_started_at') || hasTrackingMarker(selectedAppointment, 'presentation_started_at')
                    ? 'Meet'
                    : 'Appointment'}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 font-bold text-violet-700 ring-1 ring-violet-100">{getLeadMarket(selectedAppointment) || 'Unknown'}</span>
              <span className="rounded-full bg-white px-2.5 py-1 font-bold text-slate-700 ring-1 ring-slate-200">{getField(selectedAppointment, 'lead_state', 'leadState') || 'Unknown'}</span>
              {selectedAppointment.outcome === 'sale' && getAlpAmount(selectedAppointment) > 0 && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-black text-emerald-800 ring-1 ring-emerald-200">${getAlpAmount(selectedAppointment)} ALP</span>
              )}
            </div>

            <div className="max-h-[calc(100vh-260px)] min-h-[360px] overflow-y-auto rounded-xl border border-sky-200/70 bg-white/85 p-1">
              <LeadDisplay
                compact
                forceLead={appointmentToLead(selectedAppointment)}
                state={buildLeadDisplayState(appointmentToLead(selectedAppointment))}
                activeQueueTab="hotlead"
                displayLeadCount={1}
              />
            </div>

            {renderTimeline(selectedAppointment)}

            <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-200/70 bg-white/85 px-3 py-2">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => void handleStartPresentation(selectedAppointment)} className="text-violet-600 transition hover:text-violet-700" title="Start Presentation">
                  <Presentation className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => window.open('/dashboard/aoi-precheck', '_blank')} className="text-sky-600 transition hover:text-sky-700" title="Precheck">
                  <ShieldCheck className="h-5 w-5" />
                </button>
                <a href={getField(selectedAppointment, 'lead_phone', 'leadPhone') ? `tel:${getField(selectedAppointment, 'lead_phone', 'leadPhone')}` : undefined} className="text-emerald-600 transition hover:text-emerald-700" title="Call">
                  <Phone className="h-5 w-5" />
                </a>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed text-cyan-400/70"
                  title="Text (coming soon)"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => openFormForAppointment(selectedAppointment)} className="text-slate-600 transition hover:text-slate-800" title="Reschedule">
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                {isResolvedOutcome(selectedAppointment.outcome) && (
                  <button
                    type="button"
                    onClick={() => {
                      void saveOutcome(selectedAppointment, 'pending').catch((error: any) => {
                        alert(error?.message || 'Failed to undo resolution');
                      });
                    }}
                    className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
                    title="Undo resolution"
                  >
                    Undo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleSaleOutcome(selectedAppointment)}
                  className="text-xl font-black leading-none text-emerald-400 transition hover:text-emerald-300"
                  title="Sale"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => setNoSaleTarget(selectedAppointment)}
                  className="text-2xl font-black leading-none text-red-400 transition hover:text-red-300"
                  title="No Sale"
                >
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => openFormForAppointment(selectedAppointment)}
                  className="text-slate-600 transition hover:text-slate-800"
                  title="Reschedule"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleSendTextConfirmationAndReminders(selectedAppointment).catch((error: any) => {
                  alert(error?.message || 'Failed to send text confirmation');
                });
              }}
              disabled={String((selectedAppointment as any).confirmation_status || '').toLowerCase() === 'sent'}
              className="w-full rounded-xl border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-black text-sky-800 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
              title="Send Text Confirmation and reminders to client (Please make sure Zoom info is saved)"
            >
              {String((selectedAppointment as any).confirmation_status || '').toLowerCase() === 'sent'
                ? 'Text confirmation sent · reminders enabled'
                : 'Send Text Confirmation + reminders to client (Please make sure Zoom info is saved)'}
            </button>
          </div>
          </div>
        </div>
      )}

      {noSaleTarget && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-4 text-slate-900 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-slate-700">No Sale Resolution</div>
                <div className="text-xs text-slate-600">{getField(noSaleTarget, 'lead_name', 'leadName')}</div>
              </div>
              <button type="button" onClick={() => setNoSaleTarget(null)} className="rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {[
                ['no_sale', 'No Sale'],
                ['rescheduled', 'Reschedule'],
                ['no_show', 'No Show'],
                ['not_interested', 'Not Interested'],
                ['cannot_afford', 'Cannot Afford'],
                ['medically_uninsurable', 'Medically Uninsurable'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    void saveOutcome(noSaleTarget, key, label).then(() => {
                      setNoSaleTarget(null);
                      setSelectedAppointment(null);
                    });
                  }}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <>
          <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" />
          <div
            className="fixed z-[10000] max-h-[calc(100vh-24px)] w-[min(1120px,calc(100vw-24px))] overflow-hidden rounded-3xl bg-gradient-to-br from-[#7dd3fc] via-[#a5b4fc] to-[#f0abfc] p-[1.5px] text-slate-900 shadow-[0_26px_90px_rgba(15,23,42,0.35)]"
            style={{ left: formModalPosition.x, top: formModalPosition.y }}
            onClick={event => event.stopPropagation()}
          >
            <div className="overflow-hidden rounded-[calc(1.5rem-1px)] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_34%),linear-gradient(180deg,rgba(248,252,255,0.98),rgba(241,245,255,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <div
                className="flex cursor-move items-center justify-between border-b border-sky-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl"
                onMouseDown={(event) => {
                  setFormDragOffset({
                    x: event.clientX - formModalPosition.x,
                    y: event.clientY - formModalPosition.y,
                  });
                }}
              >
                <div className="min-w-0">
                  <div className="truncate bg-gradient-to-r from-sky-600 via-blue-600 to-violet-600 bg-clip-text text-sm font-black uppercase tracking-widest text-transparent">
                    {buildHouseholdName(form.leadName || (formMode === 'callback' ? 'Callback' : 'Appointment'), form.spouseName)}
                  </div>
                  <div className="text-xs text-slate-600">
                    {form.id
                      ? (formMode === 'callback' ? 'Edit Callback' : 'Reschedule Appointment')
                      : (formMode === 'callback' ? 'Schedule Callback' : 'Schedule Appointment')
                    } · {form.date} {form.time}
                    {formMode === 'appointment' && (
                      <span className="ml-1 font-bold text-violet-700">
                        · {formAppointmentType === 'recruit_group_overview' ? 'Recruit Group Overview' : formAppointmentType === 'recruit_interview' ? 'Recruit Interview' : 'Sales Presentation'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onMouseDown={event => event.stopPropagation()}
                  onClick={() => setShowForm(false)}
                  className="rounded-full bg-sky-100 p-2 text-slate-700 hover:bg-sky-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid max-h-[calc(100vh-92px)] grid-cols-[1fr_420px] gap-3 overflow-hidden p-3">
                <div className="min-h-0 space-y-3 overflow-y-auto">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-xs">
                    <span className="rounded-full bg-white px-2.5 py-1 font-black text-slate-800 ring-1 ring-sky-100">{form.date} {form.time}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 font-bold text-violet-700 ring-1 ring-violet-100">{form.leadMarket || 'Unknown'}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 font-bold text-slate-700 ring-1 ring-slate-200">{form.leadState || 'Unknown'}</span>
                  </div>

                  {formMode === 'appointment' && (
                    <div className="rounded-xl border border-sky-200/70 bg-white/85 px-3 py-2 text-xs">
                      <div className="font-black text-slate-800">Zoom Info (from agent profile)</div>
                      <div className="mt-1 break-all text-[11px] text-sky-700">{calendarConfig.zoomLink || 'No zoom link saved'}</div>
                      {normalizeZoomPassword(calendarConfig.zoomPassword) && (
                        <div className="mt-1 text-[11px] font-bold text-slate-700">
                          Passcode: {normalizeZoomPassword(calendarConfig.zoomPassword)}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="max-h-[calc(100vh-280px)] min-h-[360px] overflow-y-auto rounded-xl border border-sky-200/70 bg-white/85 p-1">
                    <LeadDisplay
                      compact
                      forceLead={formToLead(form)}
                      state={buildLeadDisplayState(formToLead(form))}
                      activeQueueTab="hotlead"
                      displayLeadCount={1}
                    />
                  </div>
                </div>

                <div className="min-h-0 space-y-3 overflow-y-auto rounded-xl border border-sky-200/70 bg-white/85 p-3">
                  {!form.id && (
                    <div className="rounded-xl border border-sky-200/70 bg-sky-50/80 p-3">
                      <label className="text-xs font-bold text-sky-700">
                        Search {leadSearchSource === 'recruit' ? 'masterleadrecruit' : 'masterlead'}
                        <div className="mt-1 flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2">
                          <Search className="h-4 w-4 text-sky-500" />
                          <input
                            value={leadSearchQuery}
                            onChange={e => setLeadSearchQuery(e.target.value)}
                            className="w-full bg-transparent text-sm text-slate-800 outline-none"
                            placeholder={leadSearchSource === 'recruit' ? 'Search recruit name, phone...' : 'Search name, phone, lead id...'}
                          />
                        </div>
                      </label>
                      {leadSearchLoading && <div className="mt-2 text-xs text-sky-700">Searching...</div>}
                      {leadSearchError && <div className="mt-2 text-xs text-red-500">{leadSearchError}</div>}
                      {leadSearchResults.length > 0 && (
                        <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                          {leadSearchResults.map((lead, idx) => {
                            const leadName =
                              lead.name ||
                              [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() ||
                              'Unknown';
                            const leadPhone = String(lead.phone || lead.lead_phone || '');
                            const leadMarket = String(lead.taalk_market || lead.market || 'Unknown');
                            const leadState = String(lead.taalk_state || lead.state || '');
                            return (
                              <button
                                key={`${lead.id || lead.taalk_lead_id || leadPhone}-${idx}`}
                                type="button"
                                onClick={() => selectLeadForAppointment(lead)}
                                className="w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-left hover:bg-sky-50"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-xs font-black text-slate-900">{leadName}</span>
                                  <span className="shrink-0 text-[10px] font-bold text-sky-700">{leadMarket}</span>
                                </div>
                                <div className="mt-0.5 text-[10px] text-slate-500">
                                  {[leadPhone, leadState].filter(Boolean).join(' · ')}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {formMode === 'appointment' && (
                      <label className="col-span-2 text-xs font-bold text-slate-600">
                        Appointment Type
                        <select
                          value={formAppointmentType}
                          onChange={(e) => {
                            const next = e.target.value as CalendarAppointmentType;
                            setFormAppointmentType(next);
                            setLeadSearchQuery('');
                            setLeadSearchResults([]);
                            setLeadSearchError(null);
                          }}
                          className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-900"
                        >
                          <option value="presentation">Sales Presentation</option>
                          <option value="recruit_interview">Recruit Interview</option>
                          <option value="recruit_group_overview">Recruit Group Overview</option>
                        </select>
                      </label>
                    )}
                    <label className="text-xs font-bold text-slate-600">
                      Date
                      <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Time
                      <input type="time" value={form.time} onChange={e => setForm(prev => ({ ...prev, time: e.target.value }))} className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-900" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Lead name
                      <input value={form.leadName} onChange={e => setForm(prev => ({ ...prev, leadName: e.target.value }))} className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-900" placeholder="Client name" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Spouse name
                      <input value={form.spouseName} onChange={e => setForm(prev => ({ ...prev, spouseName: e.target.value }))} className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-900" placeholder="Optional spouse name" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Phone
                      <input value={form.leadPhone} onChange={e => setForm(prev => ({ ...prev, leadPhone: e.target.value }))} className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-900" placeholder="+1..." />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      Market
                      <input value={form.leadMarket} onChange={e => setForm(prev => ({ ...prev, leadMarket: e.target.value }))} className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-900" placeholder="Veteran / Globe Market" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      State
                      <input value={form.leadState} onChange={e => setForm(prev => ({ ...prev, leadState: e.target.value.toUpperCase().slice(0, 2) }))} className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-900" placeholder="TX" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">
                      City
                      <input value={form.leadCity} onChange={e => setForm(prev => ({ ...prev, leadCity: e.target.value }))} className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-900" placeholder="City" />
                    </label>
                    <label className="col-span-2 text-xs font-bold text-slate-600">
                      Notes
                      <textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} className="mt-1 min-h-[88px] w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-900" placeholder="Optional notes" />
                    </label>
                  </div>

                  {formMode === 'appointment' && !isRecruitAppointmentType(formAppointmentType) && (
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-sky-300/30 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                      <input
                        type="checkbox"
                        checked={formSendTextConfirmation}
                        onChange={e => setFormSendTextConfirmation(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Send Text Confirmation and reminders to client
                        <span className="ml-1 text-sky-700">(Please make sure Zoom info is saved)</span>
                      </span>
                    </label>
                  )}

                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowForm(false)} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">Cancel</button>
                    <button type="button" disabled={savingForm} onClick={() => void handleSaveForm()} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white hover:bg-sky-600 disabled:opacity-60">
                      {savingForm ? 'Saving...' : (formMode === 'callback' ? 'Save Callback' : 'Save Appointment')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default AgentCalendarPanel;
