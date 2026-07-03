/**
 * Twilio TaskRouter service for AOI inbound transfer routing.
 * Full SID and API access: Workspace, Workflow, TaskQueues, Activities, Workers.
 * Backend computes eligibility/attributes; this module talks to Twilio REST only.
 */

import twilio from 'twilio';
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_TASKROUTER_WORKSPACE_SID,
  TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID,
  PRODUCTION_URL,
} from './hardcoded-config.js';

export type TaskRouterActivityName =
  | 'Offline'
  | 'AvailableInbound'
  | 'AvailableOutboundOnly'
  | 'Wrap'
  | 'BusyOnCall'
  | 'SoftUnavailable';

export interface WorkerAttributesInput {
  agent_id: string;
  agent_email?: string;
  email?: string;
  full_name?: string;
  contact_uri?: string;
  routing_target?: string;
  markets: string[];
  licensed_states: string[];
  inbound_enabled: boolean;
  fallback_enabled: boolean;
  credits_ok: boolean;
  rank_band?: string;
  dial_velocity_band?: string;
  priority_tier?: string;
  hog_penalty_band?: string;
  starvation_band?: string;
  presence_source?: string;
  team?: string;
  can_voice: boolean;
}

let _client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('TaskRouter: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required');
  }
  if (!_client) {
    // 20s HTTP timeout (value in ms) — some Railway deployments have high latency to taskrouter.twilio.com
    const Twilio = twilio as any;
    const opts = Twilio.RequestClient ? { httpClient: new Twilio.RequestClient({ timeout: 20000 }) } : {};
    _client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, opts);
  }
  return _client;
}

function getWorkspaceSid(): string {
  const sid = TWILIO_TASKROUTER_WORKSPACE_SID || process.env.TWILIO_TASKROUTER_WORKSPACE_SID;
  if (!sid) throw new Error('TaskRouter: TWILIO_TASKROUTER_WORKSPACE_SID not set. Run provisioning script first.');
  return sid;
}

/**
 * Workflow SID to use in <Enqueue workflowSid="..."> for inbound voice tasks.
 */
export function getWorkflowSidForEnqueue(): string {
  const sid = TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID || process.env.TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID;
  if (!sid) throw new Error('TaskRouter: TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID not set. Run provisioning script first.');
  return sid;
}

/**
 * Fetch workflow and return assignment callback URL (where Twilio POSTs when offering a task).
 * If this URL is wrong or unreachable, no reservations are stored and the app never sees inbound.
 */
export async function getWorkflowAssignmentCallbackUrl(): Promise<string | null> {
  const sid = getWorkflowSidForEnqueue();
  const wf = await workspace().workflows(sid).fetch();
  return (wf as any).assignmentCallbackUrl ?? (wf as any).assignment_callback_url ?? null;
}

/**
 * Whether TaskRouter is configured (workspace + workflow SIDs present).
 */
export function isTaskRouterConfigured(): boolean {
  const ws = TWILIO_TASKROUTER_WORKSPACE_SID || process.env.TWILIO_TASKROUTER_WORKSPACE_SID;
  const wf = TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID || process.env.TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID;
  return !!(ws && wf && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
}

const workspace = () => getClient().taskrouter.v1.workspaces(getWorkspaceSid());

/**
 * Fetch workspace (for health check or display).
 */
export async function fetchWorkspace(): Promise<{ sid: string; friendlyName: string }> {
  const ws = await workspace().fetch();
  return { sid: ws.sid, friendlyName: ws.friendlyName };
}

/**
 * List all activities in the workspace (e.g. to map names to SIDs).
 */
export async function listActivities(): Promise<Array<{ sid: string; friendlyName: string; available: boolean }>> {
  const list = await workspace().activities.list({ limit: 100 });
  return list.map((a) => ({ sid: a.sid, friendlyName: a.friendlyName, available: a.available }));
}

/**
 * Find activity SID by friendly name.
 */
export async function getActivitySidByName(friendlyName: TaskRouterActivityName): Promise<string | null> {
  const list = await workspace().activities.list({ friendlyName, limit: 1 });
  return list[0]?.sid ?? null;
}

/**
 * List all workers in the workspace (so you can see every agent TaskRouter knows about).
 * Only includes workers that have been created/synced via syncWorker.
 * Optionally filter by activity (e.g. AvailableInbound = "online for inbound").
 */
export async function listWorkers(options?: {
  activityName?: TaskRouterActivityName;
  availableOnly?: boolean;
  limit?: number;
}): Promise<Array<{
  workerSid: string;
  friendlyName: string;
  activitySid: string;
  activityName: string;
  available: boolean;
  attributes: string;
}>> {
  const listOpts: { limit?: number; activityName?: string; available?: string } = { limit: options?.limit ?? 1000 };
  if (options?.activityName) listOpts.activityName = options.activityName;
  if (options?.availableOnly === true) listOpts.available = 'true';
  const list = await workspace().workers.list(listOpts);
  return list.map((w) => ({
    workerSid: w.sid,
    friendlyName: w.friendlyName,
    activitySid: w.activitySid,
    activityName: w.activityName,
    available: w.available,
    attributes: w.attributes,
  }));
}

/** Single worker by email (friendlyName) — one Twilio list page, not thousands of workers. */
export async function getWorkerByEmail(agentEmail: string): Promise<{
  workerSid: string;
  friendlyName: string;
  activitySid: string;
  activityName: string;
  available: boolean;
} | null> {
  const email = agentEmail.trim().toLowerCase();
  if (!email) return null;
  const list = await workspace().workers.list({ friendlyName: email, limit: 1 });
  if (!list.length) return null;
  const w = list[0];
  return {
    workerSid: w.sid,
    friendlyName: w.friendlyName,
    activitySid: w.activitySid,
    activityName: w.activityName,
    available: w.available,
  };
}

/**
 * Create or update a Worker. Identity for lookup: use agent_id or email as friendlyName.
 * attributes are passed as JSON; activitySid sets current activity (e.g. AvailableInbound, Offline).
 */
export async function syncWorker(params: {
  friendlyName: string;
  attributes: WorkerAttributesInput;
  activitySid: string;
}): Promise<{ workerSid: string }> {
  const { friendlyName, attributes, activitySid } = params;
  const attributesJson = JSON.stringify(attributes);
  const list = await workspace().workers.list({ friendlyName, limit: 1 });
  if (list.length > 0) {
    const w = list[0];
    await workspace().workers(w.sid).update({ attributes: attributesJson, activitySid });
    return { workerSid: w.sid };
  }
  const worker = await workspace().workers.create({
    friendlyName,
    attributes: attributesJson,
    activitySid,
  });
  return { workerSid: worker.sid };
}

/**
 * Update only worker activity (e.g. Offline, AvailableInbound, BusyOnCall).
 */
export async function setWorkerActivity(workerSid: string, activitySid: string): Promise<void> {
  await workspace().workers(workerSid).update({ activitySid });
}

/**
 * Find worker SID by friendlyName (typically agent email). Returns null if not found.
 */
export async function getWorkerSidByFriendlyName(friendlyName: string): Promise<string | null> {
  const list = await workspace().workers.list({ friendlyName: friendlyName.trim(), limit: 1 });
  return list[0]?.sid ?? null;
}

/**
 * How market/state are used to find a worker:
 * - TASK: market/state come from the incoming call → masterlead lookup by caller phone (routes.ts handleIncomingCall).
 *   We pass leadMarket, leadState into buildTaskAttributesFor609Inbound → normalizeMarket/normalizeState → Enqueue <Task> JSON.
 *   Twilio stores that as task.market, task.state for the workflow.
 * - WORKER: markets/licensed_states come from the agent's customers row when they go voice-online (routes.ts voice-online).
 *   buildWorkerAttributesForVoice(customer) uses parseMarketFromCustomer/parseStatesFromCustomer → same normalizers.
 * - TaskRouter workflow target expression: (task.market IN worker.markets) AND (task.state == "XX" OR task.state IN worker.licensed_states).
 * So task and worker must use the same canonical strings (same normalizers) or no match.
 */

/** Single canonical normalization for market. Use when building task attributes and when syncing worker attributes. */
export function normalizeMarket(s: string | null | undefined): string {
  if (s == null || typeof s !== 'string') return 'Unknown';
  const t = s.trim();
  if (!t) return 'Unknown';
  // Canonical: "Globe" -> "Globe Market" so task and worker match in TaskRouter filter.
  if (t.toLowerCase() === 'globe') return 'Globe Market';
  return t;
}

/** US state full name → 2-letter abbreviation. Used so masterlead "Washington" becomes task.state "WA" and matches worker.licensed_states. */
const STATE_NAME_TO_ABBREV: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC', dc: 'DC',
};

/** Single canonical normalization for state: two-letter uppercase. Use when building task and syncing worker. Full state names (e.g. Washington) → WA. */
export function normalizeState(s: string | null | undefined): string {
  if (s == null || typeof s !== 'string') return 'XX';
  const t = s.trim();
  if (!t) return 'XX';
  if (t.length === 2) return t.toUpperCase();
  const abbrev = STATE_NAME_TO_ABBREV[t.toLowerCase()];
  return abbrev ?? 'XX';
}

/** Collect and dedupe normalized market strings from a single value (string, or array, or comma-separated string). */
function collectMarkets(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((x) => normalizeMarket(String(x)));
  if (typeof value === 'string') {
    const parts = value.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
    return parts.map((p) => normalizeMarket(p));
  }
  return [];
}

/**
 * Parse market from customer row (array or string). Uses normalizeMarket for each value so task and worker match.
 * Reads: market, markets, taalk_market so we never miss data due to column name differences.
 */
export function parseMarketFromCustomer(c: { market?: unknown; taalk_market?: unknown; markets?: unknown } | null): string[] {
  if (!c) return [];
  const a = collectMarkets(c.market);
  const b = collectMarkets((c as any).markets);
  const c_ = collectMarkets((c as any).taalk_market ?? (c as any).MARKET);
  const combined = [...a, ...b, ...c_];
  const seen = new Set<string>();
  return combined.filter((m) => {
    const key = m.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const oneState = (x: string): string | null => { const v = normalizeState(x); return v !== 'XX' ? v : null; };

/** Collect valid 2-letter state codes from a single value (string, array, or comma-separated string). */
function collectStates(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((x) => oneState(String(x))).filter((v): v is string => v != null);
  if (typeof value === 'string') {
    const parts = value.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
    return parts.map((p) => oneState(p)).filter((v): v is string => v != null);
  }
  try {
    if (typeof value === 'object' && value !== null && typeof (value as any).forEach === 'function') {
      const out: string[] = [];
      (value as any).forEach((x: any) => { const v = oneState(String(x)); if (v) out.push(v); });
      return out;
    }
  } catch (_) {}
  return [];
}

/**
 * Parse states from customer row. Uses normalizeState; returns only valid 2-letter codes (no XX).
 * Reads: states, taalk_state, licensed_states, license_states so we never miss data.
 */
export function parseStatesFromCustomer(c: { states?: unknown; taalk_state?: unknown } | null): string[] {
  if (!c) return [];
  const a = collectStates(c.states);
  const b = collectStates((c as any).taalk_state);
  const c_ = collectStates((c as any).licensed_states ?? (c as any).license_states);
  const combined = [...a, ...b, ...c_];
  const seen = new Set<string>();
  return combined.filter((s) => {
    const key = s.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build Worker attributes for TaskRouter (contact_uri is required for routing calls to this worker).
 * Call when Voice device.registered fires: create/update Worker and set activity to AvailableInbound.
 */
export function buildWorkerAttributesForVoice(agentEmail: string, customer?: {
  market?: unknown;
  states?: unknown;
  associate_id?: unknown;
  first_name?: string | null;
  last_name?: string | null;
} | null): WorkerAttributesInput {
  const email = agentEmail.trim().toLowerCase();
  const markets = parseMarketFromCustomer(customer ?? null);
  const states = parseStatesFromCustomer(customer ?? null);
  const agentId = (customer?.associate_id != null ? String(customer.associate_id) : '') || email;
  const fullName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || email;
  const attrs: WorkerAttributesInput = {
    agent_id: agentId,
    agent_email: email,
    email,
    full_name: fullName,
    contact_uri: `client:${email}`,
    markets: markets.length ? markets : ['Unknown'],
    licensed_states: states.length ? states : [],
    inbound_enabled: true,
    fallback_enabled: true,
    credits_ok: true,
    can_voice: true,
    routing_target: 'inbound609',
  };
  return attrs;
}

// Hardcoded activity SIDs — avoids API lookup on every online toggle
const HARDCODED_ACTIVITY_SIDS: Record<string, string> = {
  AvailableInbound: 'WAc2513cd4c7ec03511690c328ff2a49cd',
  Offline: 'WA8a9d5126e72e627f1c08b6e89c73aba4',
  BusyOnCall: 'WA5306bcbb57fd389e964b4190ceaf71cc',
  Wrap: 'WA7cbb8457461d3e22fd83473d7186a3d5',
};

/**
 * Native-fetch version of TaskRouter worker update — bypasses Twilio SDK HTTP client
 * which can hang on certain Railway deployments. Uses AbortController for 12s timeout.
 */
async function setWorkerActivityViaFetch(workerSid: string, activityName: keyof typeof HARDCODED_ACTIVITY_SIDS): Promise<void> {
  const activitySid = HARDCODED_ACTIVITY_SIDS[activityName];
  if (!activitySid) throw new Error(`No hardcoded SID for activity ${activityName}`);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  try {
    const url = `https://taskrouter.twilio.com/v1/Workspaces/${TWILIO_TASKROUTER_WORKSPACE_SID}/Workers/${workerSid}`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `ActivitySid=${activitySid}`,
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`Twilio responded ${r.status}: ${await r.text()}`);
  } finally {
    clearTimeout(t);
  }
}

async function upsertWorkerViaFetch(friendlyName: string, attributesJson: string, activitySid: string): Promise<string> {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const wsBase = `https://taskrouter.twilio.com/v1/Workspaces/${TWILIO_TASKROUTER_WORKSPACE_SID}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  try {
    // Find existing worker
    const listUrl = `${wsBase}/Workers?FriendlyName=${encodeURIComponent(friendlyName)}&PageSize=1`;
    const listRes = await fetch(listUrl, { headers: { 'Authorization': `Basic ${auth}` }, signal: controller.signal });
    if (!listRes.ok) throw new Error(`Worker list failed: ${listRes.status}`);
    const listData = await listRes.json() as any;
    const existing = listData?.workers?.[0];
    if (existing) {
      // Preserve current activity if worker is BusyOnCall or Wrap — voice-online must not overwrite status
      const preserveActivitySids = [HARDCODED_ACTIVITY_SIDS.BusyOnCall, HARDCODED_ACTIVITY_SIDS.Wrap];
      const currentActivitySid = existing.activity_sid as string | undefined;
      const onlyUpdateAttributes = currentActivitySid && preserveActivitySids.includes(currentActivitySid);
      const body = onlyUpdateAttributes
        ? `Attributes=${encodeURIComponent(attributesJson)}`
        : `Attributes=${encodeURIComponent(attributesJson)}&ActivitySid=${activitySid}`;
      const updateRes = await fetch(`${wsBase}/Workers/${existing.sid}`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      if (!updateRes.ok) throw new Error(`Worker update failed: ${updateRes.status}`);
      return existing.sid;
    }
    // Create new worker
    const createRes = await fetch(`${wsBase}/Workers`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `FriendlyName=${encodeURIComponent(friendlyName)}&Attributes=${encodeURIComponent(attributesJson)}&ActivitySid=${activitySid}`,
      signal: controller.signal,
    });
    if (!createRes.ok) throw new Error(`Worker create failed: ${createRes.status}`);
    const created = await createRes.json() as any;
    return created.sid;
  } finally {
    clearTimeout(t);
  }
}

/**
 * List all workers via native fetch (for schedulers; avoids SDK timeout).
 * Returns workerSid, friendlyName, activitySid for each worker.
 */
export async function listWorkersViaFetch(): Promise<Array<{ workerSid: string; friendlyName: string; activitySid: string }>> {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const wsBase = `https://taskrouter.twilio.com/v1/Workspaces/${TWILIO_TASKROUTER_WORKSPACE_SID}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);
  try {
    const out: Array<{ workerSid: string; friendlyName: string; activitySid: string }> = [];
    let pageUrl: string | null = `${wsBase}/Workers?PageSize=1000`;
    while (pageUrl) {
      const res = await fetch(pageUrl, { headers: { 'Authorization': `Basic ${auth}` }, signal: controller.signal });
      if (!res.ok) throw new Error(`Workers list failed: ${res.status}`);
      const data = await res.json() as any;
      const workers = data?.workers ?? [];
      for (const w of workers) {
        if (w.sid && w.friendly_name != null && w.activity_sid) {
          out.push({ workerSid: w.sid, friendlyName: String(w.friendly_name), activitySid: w.activity_sid });
        }
      }
      pageUrl = data?.meta?.next_page_url ?? null;
    }
    return out;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Update an existing worker's attributes and preserve their current activity (for sync/backfill).
 */
export async function updateWorkerAttributesPreservingActivity(
  workerSid: string,
  attributesJson: string,
  activitySid: string
): Promise<void> {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const url = `https://taskrouter.twilio.com/v1/Workspaces/${TWILIO_TASKROUTER_WORKSPACE_SID}/Workers/${workerSid}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `Attributes=${encodeURIComponent(attributesJson)}&ActivitySid=${encodeURIComponent(activitySid)}`,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Worker update failed: ${res.status}`);
  } finally {
    clearTimeout(t);
  }
}

/**
 * Called when Voice device.registered fires: create or update the TaskRouter Worker and set activity to AvailableInbound.
 * Worker attributes (contact_uri, markets, etc.) are updated; Twilio then knows this agent is available for tasks.
 * CRITICAL: We must set voice channel capacity to 1 or TaskRouter will NEVER offer this worker voice tasks (calls sit in queue).
 */
export async function setWorkerAvailableForVoice(
  agentEmail: string,
  customer?: { market?: unknown; states?: unknown; associate_id?: unknown; first_name?: string | null; last_name?: string | null } | null
): Promise<{ workerSid: string }> {
  const email = agentEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Invalid agent email');
  const availableSid = HARDCODED_ACTIVITY_SIDS.AvailableInbound;
  const attributes = buildWorkerAttributesForVoice(email, customer);
  const attributesJson = JSON.stringify(attributes);
  // Use native fetch (bypasses Twilio SDK HTTP client which can hang on certain Railway deployments)
  const workerSid = await upsertWorkerViaFetch(email, attributesJson, availableSid);
  // Without voice capacity >= 1, TaskRouter never offers this worker voice tasks — fix it every time we set them online
  try {
    await setWorkerVoiceCapacity(workerSid, 1);
    console.log('voice-online: worker', workerSid, 'AvailableInbound + voice capacity 1', email);
  } catch (e) {
    console.warn('taskrouter setWorkerVoiceCapacity failed for', email, (e as Error).message);
  }
  return { workerSid };
}

/**
 * Set worker activity to Offline (call when Voice device unregisters / power off / logout).
 */
export async function setWorkerOffline(agentEmail: string): Promise<void> {
  const email = agentEmail.trim().toLowerCase();
  const workerSid = await getWorkerSidByFriendlyName(email);
  if (!workerSid) return;
  const offlineSid = await getActivitySidByName('Offline');
  if (!offlineSid) return;
  await setWorkerActivity(workerSid, offlineSid);
}

/**
 * Set worker activity to BusyOnCall (call when agent has an active live call).
 */
export async function setWorkerBusy(agentEmail: string): Promise<void> {
  const email = agentEmail.trim().toLowerCase();
  const workerSid = await getWorkerSidByFriendlyName(email);
  if (!workerSid) return;
  const busySid = await getActivitySidByName('BusyOnCall');
  if (!busySid) return;
  await setWorkerActivity(workerSid, busySid);
}

/**
 * Set worker activity to Wrap (call when an inbound call ends and the agent is in post-call work).
 */
export async function setWorkerWrap(agentEmail: string): Promise<void> {
  const email = agentEmail.trim().toLowerCase();
  const workerSid = await getWorkerSidByFriendlyName(email);
  if (!workerSid) return;
  const wrapSid = await getActivitySidByName('Wrap');
  if (!wrapSid) return;
  await setWorkerActivity(workerSid, wrapSid);
}

/**
 * Set worker activity to AvailableInbound only (release from BusyOnCall/Wrap). Does not change attributes.
 * Call from call-status webhook when a call ends so agents are not stuck "on call" if client never POSTs voice-online.
 */
export async function setWorkerActivityToAvailableInbound(agentEmail: string): Promise<void> {
  const email = agentEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) return;
  const workerSid = await getWorkerSidByFriendlyName(email);
  if (!workerSid) return;
  const availableSid = HARDCODED_ACTIVITY_SIDS.AvailableInbound;
  if (!availableSid) return;
  await setWorkerActivity(workerSid, availableSid);
}

/**
 * Get a worker's voice channel capacity (0 if no voice channel or not found).
 */
export async function getWorkerVoiceCapacity(workerSid: string): Promise<number> {
  const channels = await workspace().workers(workerSid).workerChannels.list();
  const voice = channels.find(
    (c) => (c as any).taskChannelUniqueName?.toLowerCase() === 'voice' || (c as any).task_channel_unique_name === 'voice' || c.sid?.includes('voice')
  );
  return voice ? ((voice as any).configuredCapacity ?? (voice as any).configured_capacity ?? 0) : 0;
}

/**
 * Set worker channel capacity for voice (capacity 1). Worker must have a 'voice' channel.
 * Uses case-insensitive match for taskChannelUniqueName (Twilio may return "Voice").
 */
export async function setWorkerVoiceCapacity(workerSid: string, capacity: number = 1): Promise<void> {
  const channels = await workspace().workers(workerSid).workerChannels.list();
  const voice = channels.find(
    (c) => (c as any).taskChannelUniqueName?.toLowerCase() === 'voice' || (c as any).task_channel_unique_name === 'voice' || c.sid?.includes('voice')
  );
  if (voice) {
    await workspace().workers(workerSid).workerChannels(voice.sid).update({ capacity });
  } else {
    console.warn('taskrouter: worker', workerSid, 'has no voice channel — capacity not set; TaskRouter may not offer voice tasks');
  }
}

/** Get voice task channel SID so tasks we create match voice Enqueue behavior. */
export async function getVoiceTaskChannelSid(): Promise<string | null> {
  const list = await workspace().taskChannels.list();
  const voice = list.find((c) => (c as any).uniqueName?.toLowerCase() === 'voice' || (c as any).task_channel_unique_name?.toLowerCase() === 'voice');
  return voice?.sid ?? null;
}

/**
 * Create a task in the workspace (same as when a call is enqueued via TwiML).
 * TaskRouter will run the workflow and call the assignment callback when offering to workers.
 * Use for testing routing without a real phone call. Uses voice channel so it matches Enqueue.
 */
export async function createTask(attributesJson: string): Promise<{ taskSid: string }> {
  const workflowSid = getWorkflowSidForEnqueue();
  const opts: Record<string, string> = {
    workflowSid,
    attributes: attributesJson,
    taskChannel: 'voice',
  };
  const task = await workspace().tasks.create(opts as any);
  return { taskSid: task.sid };
}

/**
 * Fetch task by SID (e.g. from assignment callback).
 */
export async function fetchTask(taskSid: string): Promise<{ sid: string; attributes: string; status: string; dateCreated?: string }> {
  const task = await workspace().tasks(taskSid).fetch();
  return {
    sid: task.sid,
    attributes: task.attributes,
    status: task.status,
    dateCreated: (task as any).dateCreated ?? (task as any).date_created,
  };
}

/**
 * List recent tasks in the workspace (for diagnostics: find task by call_sid).
 */
export async function listRecentTasks(options?: { limit?: number }): Promise<
  Array<{ sid: string; attributes: string; status: string; dateCreated?: string }>
> {
  const list = await workspace().tasks.list({ limit: options?.limit ?? 50 });
  return list.map((t) => ({
    sid: t.sid,
    attributes: t.attributes,
    status: t.status,
    dateCreated: (t as any).dateCreated ?? (t as any).date_created,
  }));
}

/**
 * Compute time-to-answer in seconds: from task creation (enqueue) to now.
 * Use after accepting a reservation to record how long the call waited.
 */
export function timeToAnswerSeconds(taskDateCreated: string | undefined): number | null {
  if (!taskDateCreated) return null;
  const created = new Date(taskDateCreated).getTime();
  if (Number.isNaN(created)) return null;
  return (Date.now() - created) / 1000;
}

/**
 * Accept a reservation (after assignment callback). Call when agent clicks Accept in UI.
 * Requires taskSid and reservationSid from the assignment callback.
 * For voice tasks from Enqueue, use acceptReservationWithDequeue so the caller is connected to the agent.
 */
export async function acceptReservation(taskSid: string, reservationSid: string): Promise<void> {
  await workspace().tasks(taskSid).reservations(reservationSid).update({ reservationStatus: 'accepted' });
}

/**
 * Update a reservation via native fetch (bypasses Twilio SDK HTTP client which can hang on certain Railway deployments).
 * Same semantics as workspace().tasks(taskSid).reservations(reservationSid).update(payload).
 * params keys must be PascalCase as required by Twilio (ReservationStatus, Instruction, DequeueFrom, etc.).
 */
async function updateReservationViaFetch(
  taskSid: string,
  reservationSid: string,
  params: Record<string, string | number | undefined | string[]>
): Promise<void> {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const ws = getWorkspaceSid();
  const url = `https://taskrouter.twilio.com/v1/Workspaces/${ws}/Tasks/${taskSid}/Reservations/${reservationSid}`;
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) pairs.push(`${key}=${encodeURIComponent(String(v))}`);
    } else {
      pairs.push(`${key}=${encodeURIComponent(String(value))}`);
    }
  }
  const body = pairs.join('&');
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Reservation update failed: ${res.status} ${text}`);
    }
  } finally {
    clearTimeout(t);
  }
}

/**
 * Accept and dequeue: connect the queued call to the worker (client:email).
 * dequeueFrom = caller ID shown to agent; dequeueTo = worker contact_uri (e.g. client:agent@example.com).
 * timeout = seconds the worker's phone can ring before no-answer (default Twilio 60s); we use 90 so agent has time to click Accept.
 * Uses native fetch to avoid Twilio SDK HTTP client hanging on Railway.
 */
export async function acceptReservationWithDequeue(
  taskSid: string,
  reservationSid: string,
  dequeueFrom: string,
  dequeueTo: string
): Promise<void> {
  const dequeueStatusUrl = PRODUCTION_URL ? `${PRODUCTION_URL}/api/twilio/taskrouter/dequeue-status` : undefined;
  // NOTE: DequeueRecord:'record-from-answer' is silently ignored for WebRTC client: destinations.
  // Recording is started via REST API in the dequeue-status 'answered/in-progress' callback instead.
  const params: Record<string, string | number | undefined | string[]> = {
    ReservationStatus: 'accepted',
    Instruction: 'dequeue',
    DequeueFrom: dequeueFrom || undefined,
    DequeueTo: dequeueTo || undefined,
    DequeueTimeout: 90,
    DequeueStatusCallbackUrl: dequeueStatusUrl,
    DequeueStatusCallbackEvent: ['answered', 'completed'],
  };
  try {
    const wrapSid = await getActivitySidByName('Wrap');
    if (wrapSid) params.DequeuePostWorkActivitySid = wrapSid;
  } catch (_) {}
  await updateReservationViaFetch(taskSid, reservationSid, params);
}

/**
 * Reject a reservation (e.g. agent declined or timeout). TaskRouter will offer to next worker.
 */
export async function rejectReservation(taskSid: string, reservationSid: string): Promise<void> {
  await workspace().tasks(taskSid).reservations(reservationSid).update({ reservationStatus: 'rejected' });
}

// --- Task attributes when enqueueing (call side) ---
// Source: your backend. Market/state from lead lookup (e.g. masterlead by caller phone); priority from your rules.

export interface EnqueueTaskAttributesInput {
  call_sid: string;
  lead_id?: string;
  source: 'ai_transfer' | 'direct_inbound';
  market: string;
  state: string;
  phone_number: string;
  lead_name?: string;
  first_name?: string;
  last_name?: string;
  taalk_lead_id?: string;
  lead_email?: string;
  priority_class?: string;
  transfer_confidence?: number;
  estimated_value_band?: string;
  prior_agent_id?: string;
  workflow_variant?: string;
  fallback_stage?: number;
  created_at?: string;
  /** For 609 inbound: queue/routing target so UI and filters can use it. */
  routing_target?: string;
}

/**
 * Canonical 609 task payload: only keys used by TaskRouter expressions and UI.
 * Every 609 task must include routing_target "inbound609", market (canonical), state (2-letter upper), Unknown/XX when no lead.
 */
export function buildTaskAttributesFor609Inbound(params: {
  call_sid: string;
  phone_number: string;
  market: string;
  state: string;
  lead_id?: string;
  lead_name?: string;
  first_name?: string;
  last_name?: string;
  lead_email?: string;
  taalk_lead_id?: string;
  city?: string;
  connection_type?: 'gold' | 'diamond' | 'recruit';
  charge?: number;
  // Taalk transfer-start fields for lead card
  address?: string;
  secret_key?: string;
  group_code?: string;
  referred_by?: string;
  relationship?: string;
  sponsor_org?: string;
  beneficiary?: string;
  associate_id?: string;
}): string {
  let market = normalizeMarket(params.market);
  if (market === 'Unknown') market = 'aorecruit';
  const state = normalizeState(params.state);
  const attrs = {
    call_sid: params.call_sid,
    phone_number: params.phone_number,
    market,
    state,
    routing_target: 'inbound609',
    lead_id: params.lead_id ?? '',
    lead_name: params.lead_name ?? ([params.first_name, params.last_name].filter(Boolean).join(' ').trim() || 'Unknown'),
    first_name: params.first_name,
    last_name: params.last_name,
    lead_email: params.lead_email,
    taalk_lead_id: params.taalk_lead_id,
    city: params.city ?? '',
    connection_type: params.connection_type ?? 'diamond',
    charge: params.charge ?? 8,
    address: params.address ?? '',
    secret_key: params.secret_key ?? '',
    group_code: params.group_code ?? '',
    referred_by: params.referred_by ?? '',
    relationship: params.relationship ?? '',
    sponsor_org: params.sponsor_org ?? '',
    beneficiary: params.beneficiary ?? '',
    associate_id: params.associate_id ?? '',
  };
  return JSON.stringify(attrs);
}

/**
 * Build the task attributes JSON string to pass in <Enqueue><Task>...</Task></Enqueue>.
 * Uses normalizeMarket/normalizeState. For 609-only flow use buildTaskAttributesFor609Inbound.
 */
export function buildTaskAttributesForEnqueue(input: EnqueueTaskAttributesInput): string {
  const market = normalizeMarket(input.market);
  const state = normalizeState(input.state);
  const attrs = {
    call_sid: input.call_sid,
    lead_id: input.lead_id ?? '',
    source: input.source,
    market,
    state,
    phone_number: input.phone_number,
    lead_name: input.lead_name ?? ([input.first_name, input.last_name].filter(Boolean).join(' ').trim() || 'Unknown'),
    first_name: input.first_name,
    last_name: input.last_name,
    taalk_lead_id: input.taalk_lead_id,
    lead_email: input.lead_email,
    priority_class: input.priority_class ?? 'core',
    fallback_stage: input.fallback_stage ?? 0,
    created_at: input.created_at ?? new Date().toISOString(),
    ...(input.routing_target != null && { routing_target: input.routing_target }),
  };
  return JSON.stringify(attrs);
}

/**
 * Build TwiML that enqueues the current call into TaskRouter with the given task attributes.
 * Twilio expects <Task> body to be the JSON attributes (not a self-closing <Task attributes="..."/>).
 * workflowSid from getWorkflowSidForEnqueue(); taskAttributesJson is raw JSON string.
 * waitUrl: optional hold music URL (default Twilio classical if omitted).
 * actionUrl: optional URL Twilio calls when the call leaves the queue (hangup, bridged disconnect). Ensures task cleanup.
 */
export function buildEnqueueTwiML(
  workflowSid: string,
  taskAttributesJson: string,
  waitUrl?: string,
  actionUrl?: string
): string {
  const wait = waitUrl ? ` waitUrl="${escapeXml(waitUrl)}"` : '';
  const action = actionUrl ? ` action="${escapeXml(actionUrl)}" method="POST"` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Enqueue workflowSid="${escapeXml(workflowSid)}"${wait}${action}>
    <Task>${escapeXml(taskAttributesJson)}</Task>
  </Enqueue>
</Response>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
