/**
 * appointment-sms.ts
 * SMS notifications for appointment confirmations and reminders.
 * Uses Twilio via sms-service. Formats times in the client's state timezone.
 */
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from './hardcoded-config';
import twilio from 'twilio';

// ─── State → timezone map ──────────────────────────────────────────────────
const STATE_TIMEZONE: Record<string, string> = {
  TX: 'America/Chicago',
  CA: 'America/Los_Angeles',
  FL: 'America/New_York',
  NY: 'America/New_York',
  IL: 'America/Chicago',
  OH: 'America/New_York',
  GA: 'America/New_York',
  NC: 'America/New_York',
  MI: 'America/New_York',
  PA: 'America/New_York',
  AZ: 'America/Denver',
  WA: 'America/Los_Angeles',
  OR: 'America/Los_Angeles',
  CO: 'America/Denver',
  MN: 'America/Chicago',
  WI: 'America/Chicago',
  MO: 'America/Chicago',
  TN: 'America/Chicago',
  AL: 'America/Chicago',
  LA: 'America/Chicago',
  MS: 'America/Chicago',
  AR: 'America/Chicago',
  IA: 'America/Chicago',
  KS: 'America/Chicago',
  NE: 'America/Chicago',
  OK: 'America/Chicago',
  SD: 'America/Chicago',
  ND: 'America/Chicago',
  NM: 'America/Denver',
  UT: 'America/Denver',
  MT: 'America/Denver',
  ID: 'America/Denver',
  WY: 'America/Denver',
  NV: 'America/Los_Angeles',
  AK: 'America/Anchorage',
  HI: 'America/Los_Angeles',
  // Default for any other state: Eastern
};

const TZ_ABBREV: Record<string, string> = {
  'America/New_York':   'ET',
  'America/Chicago':    'CT',
  'America/Denver':     'MT',
  'America/Los_Angeles':'PT',
  'America/Anchorage':  'AKT',
};

export function getStateTimezone(state: string): string {
  return STATE_TIMEZONE[state?.toUpperCase()] ?? '';
}

// Keep internal alias for backward compat
function getTimezoneForState(state: string): string {
  return getStateTimezone(state);
}

function formatAppointmentTime(utcTime: string | Date, ianaTimezone: string): string {
  const date = typeof utcTime === 'string' ? new Date(utcTime) : utcTime;
  const abbrev = TZ_ABBREV[ianaTimezone] ?? ianaTimezone;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';

  return `${get('weekday')}, ${get('month')} ${get('day')} at ${get('hour')}:${get('minute')} ${get('dayPeriod')} ${abbrev}`;
}

function formatToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+1${digits}`;
}

// ─── Twilio client ─────────────────────────────────────────────────────────
let _twilioClient: twilio.Twilio | null = null;
function getTwilioClient(): twilio.Twilio | null {
  if (_twilioClient) return _twilioClient;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    _twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return _twilioClient;
}

async function sendSMS(to: string, body: string): Promise<boolean> {
  const client = getTwilioClient();
  if (!client || !TWILIO_PHONE_NUMBER) {
    console.warn('⚠️ appointment-sms: Twilio not configured, skipping SMS');
    return false;
  }
  try {
    const result = await client.messages.create({ body, from: TWILIO_PHONE_NUMBER, to: formatToE164(to) });
    console.log('📱 appointment-sms: sent', result.sid);
    return true;
  } catch (err: any) {
    console.error('❌ appointment-sms: send failed', err?.message);
    return false;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface AppointmentSMSData {
  leadName: string;
  leadPhone: string;
  leadState?: string | null;
  leadTimezone?: string | null;
  agentName: string;
  startTime: string | Date; // UTC
  zoomLink?: string | null;
  zoomPassword?: string | null;
}

function normalizeZoomPassword(password?: string | null): string {
  const raw = String(password || '').trim();
  if (!raw || raw === '1') return '';
  return raw;
}

/**
 * Send appointment confirmation SMS to the lead.
 */
export async function sendAppointmentConfirmation(appt: AppointmentSMSData): Promise<boolean> {
  const explicitLeadTimezone = String(appt.leadTimezone || '').trim();
  const stateTz = getTimezoneForState(appt.leadState ?? '');
  const tz = explicitLeadTimezone || stateTz;
  const timeStr = tz
    ? formatAppointmentTime(appt.startTime, tz)
    : [
        formatAppointmentTime(appt.startTime, 'America/New_York'),
        formatAppointmentTime(appt.startTime, 'America/Chicago'),
        formatAppointmentTime(appt.startTime, 'America/Los_Angeles'),
      ].join(' | ');
  const zoomPassword = normalizeZoomPassword(appt.zoomPassword);
  const joinPart = appt.zoomLink
    ? ` Join: ${appt.zoomLink}.${zoomPassword ? ` Passcode: ${zoomPassword}.` : ''}`
    : '';
  const body = `Hi ${appt.leadName}, your appointment with ${appt.agentName} is confirmed for ${timeStr}.${joinPart} Reply STOP to opt out.`;
  console.log(`📅 Sending appointment confirmation SMS to ${appt.leadPhone}`);
  return sendSMS(appt.leadPhone, body);
}

/**
 * Send appointment reminder SMS to the lead.
 * @param hoursUntil approximate hours until appointment (e.g. 24 or 1)
 */
export async function sendAppointmentReminder(appt: AppointmentSMSData, hoursUntil: number): Promise<boolean> {
  const explicitLeadTimezone = String(appt.leadTimezone || '').trim();
  const stateTz = getTimezoneForState(appt.leadState ?? '');
  const tz = explicitLeadTimezone || stateTz;
  const timeStr = tz
    ? formatAppointmentTime(appt.startTime, tz)
    : [
        formatAppointmentTime(appt.startTime, 'America/New_York'),
        formatAppointmentTime(appt.startTime, 'America/Chicago'),
        formatAppointmentTime(appt.startTime, 'America/Los_Angeles'),
      ].join(' | ');
  const zoomPassword = normalizeZoomPassword(appt.zoomPassword);
  const joinPart = appt.zoomLink
    ? ` Join: ${appt.zoomLink}.${zoomPassword ? ` Passcode: ${zoomPassword}.` : ''}`
    : '';
  const body = `Reminder: Hi ${appt.leadName}, your appointment with ${appt.agentName} is in ~${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''} — ${timeStr}.${joinPart} Reply STOP to opt out.`;
  console.log(`🔔 Sending appointment reminder SMS to ${appt.leadPhone} (${hoursUntil}h)`);
  return sendSMS(appt.leadPhone, body);
}

/**
 * Send appointment reminder SMS to the agent.
 * @param minutesUntil approximate minutes until appointment (e.g. 60 or 15)
 */
export async function sendAgentAppointmentReminder(
  agentPhone: string,
  leadName: string,
  minutesUntil: number,
  zoomLink?: string | null,
): Promise<boolean> {
  if (!agentPhone) return false;
  const joinPart = zoomLink ? ` ${zoomLink}` : '';
  const body = `Heads up! Your appointment with ${leadName} is in ${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}.${joinPart}`;
  console.log(`🔔 Sending agent reminder SMS to ${agentPhone} (${minutesUntil}min)`);
  return sendSMS(agentPhone, body);
}
