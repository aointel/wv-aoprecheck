/**
 * Twilio TaskRouter client — polls worker status for outbound WebRTC calls.
 *
 * Workers are CC Pro agents making outbound calls via WebRTC.
 * We poll every 15s (same cadence as Taalk RTS) to detect who's actively calling.
 */

const ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const AUTH_TOKEN = '974557c999ed53ada16c4a784af2a7d3';
const WORKSPACE_SID = 'WS6a978202496f59f6cd478c1310f5c2eb';

const BASE_URL = `https://taskrouter.twilio.com/v1/Workspaces/${WORKSPACE_SID}`;
const AUTH_HEADER = 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');

export interface TwilioWorker {
  sid: string;
  friendlyName: string;       // email address (e.g. nicholasscordos@aoglobelife.com)
  activityName: string;       // e.g. "Offline", "AvailableInbound", "On A Call", etc.
  dateStatusChanged: string;  // ISO timestamp
  attributes: Record<string, any>; // markets, states, ccpro, distribution_priority, etc.
}

export type WebRTCStatus = 'dialing' | 'ringing' | 'on_call' | 'wrap' | 'idle' | 'offline';

/**
 * Map Twilio activityName to our WebRTC outbound status.
 *
 * Activity name mapping (case-insensitive):
 *   "Dialing"              → dialing   (agent initiated call, waiting for pickup)
 *   "Ringing"              → ringing   (call is ringing on the other end)
 *   "BusyOnCall"           → on_call   (live conversation)
 *   "Wrap"                 → wrap      (post-call wrap up)
 *   "AvailableInbound"     → idle
 *   "AvailableOutboundOnly"→ idle
 *   "Available"            → idle
 *   "SoftUnavailable"      → idle
 *   "Offline"/"Unavailable"→ offline
 */
export function mapActivityToStatus(activityName: string): WebRTCStatus {
  // Exact match first (case-insensitive) for the known activity names
  const nameMap: Record<string, WebRTCStatus> = {
    'dialing':              'dialing',
    'ringing':              'ringing',
    'busyoncall':           'on_call',  // Agent is on a live call; stale cleaner moves them to idle after 5min if stuck
    'wrap':                 'wrap',
    'availableinbound':     'idle',
    'availableoutboundonly': 'idle',
    'available':            'idle',
    'softunavailable':      'idle',
    'offline':              'offline',
    'unavailable':          'offline',
  };

  const key = activityName.toLowerCase().replace(/[\s_-]/g, '');
  if (nameMap[key] !== undefined) return nameMap[key];

  // Fallback heuristics for unexpected activity names
  const lower = activityName.toLowerCase();
  if (lower.includes('call') || lower.includes('busy') || lower.includes('reserved')) return 'idle';
  if (lower.includes('wrap') || lower.includes('break')) return 'wrap';
  if (lower.includes('offline') || lower.includes('unavailable')) return 'offline';

  // Default: if they're on the system but we don't recognise the activity, assume idle
  return 'idle';
}

/**
 * Fetch all workers from Twilio TaskRouter.
 * Returns ALL workers (we filter downstream).
 */
export async function fetchAllWorkers(): Promise<TwilioWorker[]> {
  const allWorkers: TwilioWorker[] = [];
  let url: string | null = `${BASE_URL}/Workers?PageSize=200`;

  while (url) {
    const res = await fetch(url, {
      headers: { 'Authorization': AUTH_HEADER },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Twilio ${res.status} ${res.statusText}: ${text}`);
    }

    const data: any = await res.json();
    const workers = data.workers ?? [];

    for (const w of workers) {
      let attrs: Record<string, any> = {};
      try {
        attrs = typeof w.attributes === 'string' ? JSON.parse(w.attributes) : (w.attributes ?? {});
      } catch { /* ignore parse errors */ }

      allWorkers.push({
        sid: w.sid,
        friendlyName: w.friendly_name ?? '',
        activityName: w.activity_name ?? 'Offline',
        dateStatusChanged: w.date_status_changed ?? '',
        attributes: attrs,
      });
    }

    // Handle pagination
    url = (data as any).meta?.next_page_url ?? null;
  }

  return allWorkers;
}

/**
 * Get only active (non-Offline) workers — these are agents on outbound.
 */
export async function getActiveWorkers(): Promise<TwilioWorker[]> {
  const all = await fetchAllWorkers();
  return all.filter(w => mapActivityToStatus(w.activityName) !== 'offline');
}

// ── Auto-clean stale BusyOnCall workers ──
const AVAILABLE_INBOUND_SID = 'WAc2513cd4c7ec03511690c328ff2a49cd';

export async function cleanStaleBusyWorkers(thresholdMs: number = 5 * 60 * 1000): Promise<number> {
  const STALE_THRESHOLD_MS = thresholdMs;
  let cleaned = 0;
  try {
    const res = await fetch(
      `${BASE_URL}/Workers?ActivityName=BusyOnCall&PageSize=200`,
      { headers: { Authorization: AUTH_HEADER } }
    );
    if (!res.ok) return 0;
    const data: any = await res.json();
    const workers = data.workers ?? [];
    const now = Date.now();

    for (const w of workers) {
      const since = new Date(w.date_status_changed).getTime();
      if (now - since > STALE_THRESHOLD_MS) {
        await fetch(
          `${BASE_URL}/Workers/${w.sid}`,
          {
            method: 'POST',
            headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `ActivitySid=${AVAILABLE_INBOUND_SID}`,
          }
        );
        console.log(`[Twilio] Cleaned stale BusyOnCall: ${w.friendly_name} (stuck ${Math.round((now - since) / 60000)}min)`);
        cleaned++;
      }
    }
  } catch (err) {
    console.error('[Twilio] cleanStaleBusyWorkers error:', err);
  }
  return cleaned;
}

// ── Poll active Twilio calls for real-time on-call status ──
const CALLS_URL = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json`;

export async function fetchActiveCalls(): Promise<{ email: string; direction: string; to: string; from: string; sid: string }[]> {
  try {
    const res = await fetch(
      `${CALLS_URL}?Status=in-progress&PageSize=50`,
      { headers: { Authorization: AUTH_HEADER } }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    const calls: { email: string; direction: string; to: string; from: string; sid: string }[] = [];
    for (const c of data.calls ?? []) {
      // Extract email from client: prefix
      let email = '';
      if (c.from?.startsWith('client:')) email = c.from.replace('client:', '');
      else if (c.to?.startsWith('client:')) email = c.to.replace('client:', '');
      calls.push({ email: email.toLowerCase(), direction: c.direction, to: c.to || '', from: c.from || '', sid: c.sid });
    }
    return calls;
  } catch {
    return [];
  }
}
