/**
 * Support Ticket System — persisted to Supabase, served from in-memory cache.
 * Pulls SMS from Twilio, stores in support_tickets + support_messages tables.
 * Cache is refreshed in the background so the API is always instant.
 * Uses plain fetch against Supabase REST API (no @supabase/supabase-js needed).
 */

const TWILIO_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_TOKEN = '974557c999ed53ada16c4a784af2a7d3';
const SUPPORT_NUMBER = '+19142289324';
const TWILIO_AUTH = 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const SB_HEADERS: Record<string, string> = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function sbGet(table: string, qs: string): Promise<any[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: SB_HEADERS });
    if (!r.ok) return [];
    return r.json();
  } catch { return []; }
}

async function sbPost(table: string, body: Record<string, any>, returning?: true): Promise<any> {
  const headers = returning ? { ...SB_HEADERS, Prefer: 'return=representation' } : SB_HEADERS;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  if (!r.ok || !returning) return null;
  const rows = await r.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function sbPatch(table: string, qs: string, body: Record<string, any>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: 'PATCH', headers: SB_HEADERS, body: JSON.stringify(body),
  }).catch(() => {});
}

// ── In-memory cache — served instantly, refreshed in background ──
let _ticketCache: SupportTicket[] = [];
let _cacheRefreshing = false;
let _lastCacheRefresh = 0;
const CACHE_TTL_MS = 30_000; // 30s

export interface SupportMessage {
  id: string;
  ticketId: string | null;
  phone: string;
  twilioSid: string;
  direction: 'inbound' | 'outbound';
  body: string;
  hasMedia: boolean;
  sentAt: string;
}

export interface SupportTicket {
  id: string;
  phone: string;
  agentEmail: string | null;
  agentName: string | null;
  callerName: string | null;
  status: 'open' | 'replied' | 'resolved' | 'closed';
  priority: string;
  category: string | null;
  subject: string | null;
  notes: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  firstResponseAt: string | null;
  messages: SupportMessage[];
  waitTime: number;
}

// ── Caller name lookup (agent_profiles + customers) ──
async function lookupCallerName(phone: string): Promise<string | null> {
  try {
    const last10 = phone.replace(/\D/g, '').slice(-10);
    if (last10.length < 7) return null;

    const agents = await sbGet('agent_profiles', `phone=ilike.%25${last10}%25&select=first_name,last_name,email&limit=1`);
    if (agents[0]) {
      const name = [agents[0].first_name, agents[0].last_name].filter(Boolean).join(' ');
      if (name) return name;
      if (agents[0].email) return agents[0].email.split('@')[0];
    }

    const customers = await sbGet('customers', `phone=ilike.%25${last10}%25&select=first_name,last_name&limit=1`);
    if (customers[0]) {
      const name = [customers[0].first_name, customers[0].last_name].filter(Boolean).join(' ');
      if (name && !name.includes('555-0000')) return name;
    }

    return null;
  } catch {
    return null;
  }
}

/** Sync Twilio SMS into Supabase, create/update tickets */
export async function syncTwilioMessages(): Promise<void> {
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [inRes, outRes] = await Promise.all([
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json?To=${encodeURIComponent(SUPPORT_NUMBER)}&DateSent%3E=${since}&PageSize=200`, { headers: { Authorization: TWILIO_AUTH } }),
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json?From=${encodeURIComponent(SUPPORT_NUMBER)}&DateSent%3E=${since}&PageSize=200`, { headers: { Authorization: TWILIO_AUTH } }),
    ]);

    if (!inRes.ok || !outRes.ok) return;
    const inData: any = await inRes.json();
    const outData: any = await outRes.json();

    for (const m of inData.messages ?? []) {
      await ensureTicket(m.from, 'inbound');
      await upsertMessage(m.from, m.sid, 'inbound', m.body || '', parseInt(m.num_media || '0') > 0, m.date_sent);
    }

    for (const m of outData.messages ?? []) {
      await ensureTicket(m.to, 'outbound'); // won't create/reopen — outbound only updates existing ticket
      await upsertMessage(m.to, m.sid, 'outbound', m.body || '', parseInt(m.num_media || '0') > 0, m.date_sent);
    }

    console.log(`[Support] Synced ${(inData.messages?.length ?? 0) + (outData.messages?.length ?? 0)} messages`);
    _refreshCache().catch(() => {});
  } catch (err) {
    console.error('[Support] Sync error:', err);
  }
}

async function ensureTicket(phone: string, direction?: string) {
  // First: check for existing open/replied ticket
  const rows = await sbGet('support_tickets', `phone=eq.${encodeURIComponent(phone)}&status=not.in.(resolved,closed)&select=id&limit=1`);
  if (rows.length > 0) return; // already have an open ticket

  // Only create/reopen tickets for INBOUND messages — not our own outbound replies
  if (direction === 'outbound') return;

  // For inbound: check for recently resolved ticket (last 24h) — reopen instead of creating new
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = await sbGet('support_tickets', `phone=eq.${encodeURIComponent(phone)}&status=in.(resolved)&updated_at=gte.${since}&select=id&order=updated_at.desc&limit=1`);
  if (recent.length > 0) {
    await sbPatch('support_tickets', `id=eq.${recent[0].id}`, { status: 'open', updated_at: new Date().toISOString() });
    return;
  }

  // Otherwise create new ticket
  const callerName = await lookupCallerName(phone);
  await sbPost('support_tickets', { phone, caller_name: callerName ?? null });
}

async function upsertMessage(phone: string, twilioSid: string, direction: string, body: string, hasMedia: boolean, sentAt: string) {
  const existing = await sbGet('support_messages', `twilio_sid=eq.${encodeURIComponent(twilioSid)}&select=id&limit=1`);
  if (existing.length > 0) return;

  const ticket = await sbGet('support_tickets', `phone=eq.${encodeURIComponent(phone)}&status=not.in.(resolved,closed)&select=id&order=created_at.desc&limit=1`);
  const ticketId = ticket[0]?.id ?? null;

  await sbPost('support_messages', { ticket_id: ticketId, phone, twilio_sid: twilioSid, direction, body, has_media: hasMedia, sent_at: sentAt });

  if (direction === 'outbound' && ticketId) {
    await sbPatch('support_tickets', `id=eq.${ticketId}&first_response_at=is.null`, { first_response_at: sentAt });
  }
}

// ── Fast 2-query load — tickets + all messages ──
async function _loadTicketsFromDB(): Promise<SupportTicket[]> {
  const tickets = await sbGet('support_tickets', 'status=in.(open,replied)&order=updated_at.desc&limit=500');
  if (tickets.length === 0) return [];

  const phones = [...new Set(tickets.map((t: any) => t.phone as string))];
  const inList = phones.map(p => encodeURIComponent(p)).join(',');
  const messages = await sbGet('support_messages', `phone=in.(${inList})&order=sent_at.asc&limit=10000`);

  const msgByPhone = new Map<string, any[]>();
  for (const m of messages) {
    const arr = msgByPhone.get(m.phone) ?? [];
    arr.push(m);
    msgByPhone.set(m.phone, arr);
  }

  const statusOrder: Record<string, number> = { open: 0, replied: 1, resolved: 2 };

  return tickets
    .sort((a: any, b: any) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
    .map((t: any) => {
      const msgs = msgByPhone.get(t.phone) ?? [];
      const lastInbound  = [...msgs].reverse().find((m: any) => m.direction === 'inbound');
      const lastOutbound = [...msgs].reverse().find((m: any) => m.direction === 'outbound');
      let waitTime = 0;
      if (lastInbound && (!lastOutbound || new Date(lastInbound.sent_at) > new Date(lastOutbound.sent_at))) {
        waitTime = Date.now() - new Date(lastInbound.sent_at).getTime();
      }
      return {
        id: t.id,
        phone: t.phone,
        agentEmail: t.agent_email,
        agentName: t.agent_name,
        callerName: t.caller_name ?? null,
        status: t.status,
        priority: t.priority || 'normal',
        category: t.category,
        subject: t.subject,
        notes: t.notes,
        assignedTo: t.assigned_to,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        resolvedAt: t.resolved_at,
        firstResponseAt: t.first_response_at,
        messages: msgs.map((m: any) => ({
          id: m.id,
          ticketId: m.ticket_id,
          phone: m.phone,
          twilioSid: m.twilio_sid,
          direction: m.direction,
          body: m.body || '',
          hasMedia: m.has_media,
          sentAt: m.sent_at,
        })),
        waitTime,
      } as SupportTicket;
    });
}

async function _refreshCache() {
  if (_cacheRefreshing) return;
  _cacheRefreshing = true;
  try {
    _ticketCache = await _loadTicketsFromDB();
    _lastCacheRefresh = Date.now();
  } catch (err) {
    console.error('[Support] Cache refresh error:', err);
  } finally {
    _cacheRefreshing = false;
  }
}

/** Get all active tickets — instant from cache, refreshes in background if stale */
export async function getTickets(): Promise<SupportTicket[]> {
  const stale = Date.now() - _lastCacheRefresh > CACHE_TTL_MS;
  if (stale) {
    _refreshCache().catch(() => {});
    if (_lastCacheRefresh === 0) await _refreshCache();
  }
  return _ticketCache;
}

/** Send SMS reply */
export async function sendReply(to: string, body: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: 'POST',
        headers: { Authorization: TWILIO_AUTH, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: SUPPORT_NUMBER, To: to, Body: body }).toString(),
      }
    );
    if (!res.ok) return false;
    const data: any = await res.json();
    await upsertMessage(to, data.sid, 'outbound', body, false, new Date().toISOString());
    const now = new Date().toISOString();
    await sbPatch('support_tickets', `phone=eq.${encodeURIComponent(to)}&status=eq.open`, { status: 'replied', updated_at: now });
    await sbPatch('support_tickets', `phone=eq.${encodeURIComponent(to)}&first_response_at=is.null&status=not.in.(closed)`, { first_response_at: now });
    _refreshCache().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Update ticket metadata */
export async function updateTicket(ticketId: string, updates: Partial<{ status: string; priority: string; category: string; subject: string; notes: string; assignedTo: string; agentEmail: string; agentName: string }>): Promise<boolean> {
  try {
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.status)     patch.status      = updates.status;
    if (updates.priority)   patch.priority    = updates.priority;
    if (updates.category)   patch.category    = updates.category;
    if (updates.subject)    patch.subject     = updates.subject;
    if (updates.notes)      patch.notes       = updates.notes;
    if (updates.assignedTo) patch.assigned_to = updates.assignedTo;
    if (updates.agentEmail) patch.agent_email = updates.agentEmail;
    if (updates.agentName)  patch.agent_name  = updates.agentName;
    if (updates.status === 'resolved') patch.resolved_at = new Date().toISOString();

    await sbPatch('support_tickets', `id=eq.${ticketId}`, patch);
    _refreshCache().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Handle incoming SMS webhook */
export async function syncIncomingMessage(phone: string, twilioSid: string, body: string, hasMedia: boolean): Promise<void> {
  await ensureTicket(phone, 'inbound');
  await upsertMessage(phone, twilioSid, 'inbound', body, hasMedia, new Date().toISOString());
  await sbPatch('support_tickets', `phone=eq.${encodeURIComponent(phone)}&status=neq.closed`, { status: 'open', updated_at: new Date().toISOString() });
  await _refreshCache();

  // Fire CS bot asynchronously — don't block the webhook response
  if (CS_BOT_ENABLED) {
    setImmediate(async () => {
      try {
        const tickets = await getTickets();
        const ticket = tickets.find(t => t.phone === phone && t.status !== 'closed');
        if (ticket) await runCsBot(ticket);
      } catch (err) {
        console.error('[CSBot] Error on incoming message:', err);
      }
    });
  }
}

/** Create ticket from form / API */
export async function createTicketFromForm(phone: string, email: string, name: string, message: string, category: string): Promise<string> {
  const normalPhone = phone || `form-${Date.now()}`;
  const ticket = await sbPost('support_tickets', {
    phone: normalPhone, agent_email: email || null, agent_name: name || null,
    category, subject: message.slice(0, 100), status: 'open',
  }, true);
  const ticketId = ticket?.id;
  await sbPost('support_messages', {
    ticket_id: ticketId, phone: normalPhone, twilio_sid: `form-${Date.now()}`,
    direction: 'inbound', body: message, has_media: false, sent_at: new Date().toISOString(),
  });
  _refreshCache().catch(() => {});
  return ticketId;
}

// ── Auto-categorization rules ──
const THANKS_EXACT = new Set(['thanks', 'thank you', 'ty', 'thx', 'ok', 'okay', 'k', 'great', 'perfect', 'awesome', 'got it', 'nvm', '👍', '✅', '🎉', 'yes', 'ok!', 'great!', '!!!', '?', 'hello', 'hi', 'sure', 'sounds good', 'will do', 'no worries', 'np']);
const THANKS_CONTAINS = ['thank you', 'thanks!', 'it works now', 'it worked', 'working now', 'works now', 'it came back', 'came back up', 'all good', 'problem solved', 'issue resolved', 'never mind', 'nvm', 'good to go', 'up and running', 'got it working', 'figured it out', 'ok thanks', 'okay thanks', 'got in', 'got back in', 'finally works', 'it is working', 'its working', "it's working"];
const REFUND_CONTAINS  = ['refund', 'cancel my subscription', 'cancellation', 'money back', 'cancel subscription', 'want to cancel', 'wants to cancel', 'need to cancel', 'credit back'];
const BILLING_CONTAINS = ['credit', 'charged', 'charge me', 'billing', 'subscription', 'invoice', 'paused', '-24', 'add credits', 'purchase', 'payment', 'pay for', 'paying for', 'i paid', 'paid for'];
const STATES_CONTAINS  = ['associate_id', 'associate id', 'no valid', 'vdp cannot', 'states', 'state license', 'add state', 'state coverage', 'missing state'];
const LOGIN_CONTAINS   = ['password', 'log in', 'login', 'log-in', 'sign in', 'sign-in', 'sign in', 'can\'t get in', 'cannot get in', 'locked out', 'reset my', 'reset pass', 'username', 'can\'t access', 'cannot access', 'no access', 'account access', 'get into my account', 'get in my account', 'won\'t let me in', 'won\'t let me log'];
const CONN_CONTAINS    = ['slow', 'not loading', 'not working', 'won\'t load', 'won\'t work', 'wont load', 'wont work', 'error', 'connection', 'latency', 'dialer', 'diagnostics', 'spinning', 'crash', 'crashed', 'stuck', 'dead', 'freeze', 'frozen', 'download', 'install', 'reinstall', 'app issue', 'application error', 'not responding', 'keeps', 'running slow', 'very slow', 'takes forever', 'not connecting', 'disconnected', 'dropped'];

function detectCategory(body: string): string | null {
  const lower = body.toLowerCase().trim().replace(/[.!?,]+$/, '').trim();
  if (THANKS_EXACT.has(lower)) return 'thanks';
  if (THANKS_CONTAINS.some(p => lower.includes(p))) return 'thanks';
  if (REFUND_CONTAINS.some(p => lower.includes(p))) return 'refund';
  if (BILLING_CONTAINS.some(p => lower.includes(p))) return 'billing';
  if (STATES_CONTAINS.some(p => lower.includes(p))) return 'states';
  if (LOGIN_CONTAINS.some(p => lower.includes(p))) return 'login';
  if (CONN_CONTAINS.some(p => lower.includes(p))) return 'technical';
  return null;
}

export interface AutoCategorizeResult {
  closed: number;
  categorized: Record<string, number>;
  uncategorized: number;
}

/** Auto-categorize all open tickets based on last inbound message */
export async function autoCategorizeTickets(): Promise<AutoCategorizeResult> {
  const result: AutoCategorizeResult = { closed: 0, categorized: {}, uncategorized: 0 };

  // Get all non-closed tickets without a category
  const tickets = await sbGet('support_tickets', 'status=not.in.(closed)&category=is.null&select=id,phone,status&limit=1000');
  if (tickets.length === 0) return result;

  // Get last inbound message per ticket phone (bulk)
  const phones = [...new Set(tickets.map((t: any) => t.phone as string))];
  const inList = phones.map(p => encodeURIComponent(p)).join(',');
  const messages = await sbGet('support_messages', `phone=in.(${inList})&direction=eq.inbound&order=sent_at.desc&limit=5000`);

  // Index: phone → last inbound body
  const lastMsg = new Map<string, string>();
  for (const m of messages) {
    if (!lastMsg.has(m.phone)) lastMsg.set(m.phone, m.body || '');
  }

  const now = new Date().toISOString();
  for (const t of tickets) {
    const body = lastMsg.get(t.phone) || '';
    const cat = body ? detectCategory(body) : null;

    if (cat === 'thanks') {
      await sbPatch('support_tickets', `id=eq.${t.id}`, { status: 'resolved', category: 'thanks', resolved_at: now, updated_at: now });
      result.closed++;
    } else if (cat) {
      await sbPatch('support_tickets', `id=eq.${t.id}`, { category: cat, updated_at: now });
      result.categorized[cat] = (result.categorized[cat] ?? 0) + 1;
    } else {
      result.uncategorized++;
    }
  }

  _refreshCache().catch(() => {});
  console.log(`[Support] Auto-categorized: closed=${result.closed} categorized=${JSON.stringify(result.categorized)} uncategorized=${result.uncategorized}`);
  return result;
}

// ── CS Bot ──
const OPENAI_KEY = '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';

let CS_BOT_ENABLED = true;

export function setCsBotEnabled(v: boolean) { CS_BOT_ENABLED = v; }
export function getCsBotEnabled() { return CS_BOT_ENABLED; }

const BOT_SYSTEM_PROMPT = `You are a support agent for AO Intel (AOI), an insurance agent platform built for producing insurance agents licensed through Planet Altig / Symmetry Financial Group.

The platform helps agents:
- Make outbound insurance sales calls via a power dialer
- Track leads, submitted applications, and ALP (Annual Life Premium)
- Manage state licenses and associate IDs
- Handle billing/credits for dialer access

You are responding to inbound SMS messages from agents or users texting our support number. Keep replies SHORT (under 160 chars when possible), warm but professional, and actionable. Always sign off with "- AO Support".

Common issue categories and how to handle them:
- states / associate_id: "No valid associate_id" error = their licensed states haven't been configured. Ask for associate ID + which states.
- login: Trouble logging in → go to planetaltig.com, click "Forgot Password". If phone doesn't match, ask for their account email.
- technical: Dialer/connection issues → clear browser cache, use Chrome or Edge, go to planetaltig.com/ao-intel and click the wrench icon.
- billing/credits: Credits or charge questions → ask for account email and specific issue.
- refund/cancel: Want to cancel → ask what prompted it, try to retain first.
- thanks/resolved: They're saying thanks or problem is solved → respond warmly and close out.
- unknown/other: Unclear → ask a brief clarifying question.

Always use their first name if you know it. Never make up information. Do not promise things outside your control.`;

async function generateBotReply(ticket: SupportTicket, lastInboundBody: string, category: string | null): Promise<string | null> {
  try {
    const firstName = (ticket.callerName || ticket.agentName || '').split(' ')[0];
    const userPrompt = `Agent's message: "${lastInboundBody}"
Category detected: ${category || 'unknown'}
Agent name: ${firstName || 'unknown'}
Prior messages in this ticket: ${ticket.messages.length}

Write a brief SMS reply.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: BOT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.4,
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Run the CS bot on a single ticket. Returns true if a reply was sent. */
export async function runCsBot(ticket: SupportTicket): Promise<boolean> {
  if (!CS_BOT_ENABLED) return false;
  if (ticket.status === 'closed' || ticket.status === 'resolved') return false;

  // Don't reply if last message was already outbound (already responded)
  const lastMsg = ticket.messages[ticket.messages.length - 1];
  if (!lastMsg || lastMsg.direction === 'outbound') return false;

  // Don't re-bot if bot already replied within last 10 min
  const outbounds = ticket.messages.filter(m => m.direction === 'outbound');
  if (outbounds.length > 0) {
    const lastOut = outbounds[outbounds.length - 1];
    if (Date.now() - new Date(lastOut.sentAt).getTime() < 10 * 60_000) return false;
  }

  const lastInboundBody = lastMsg.body?.trim() || '';
  const cat = lastInboundBody ? detectCategory(lastInboundBody) : null;

  // "Thanks" type — just close the ticket, no reply needed
  if (cat === 'thanks') {
    const now = new Date().toISOString();
    await sbPatch('support_tickets', `id=eq.${ticket.id}`, { status: 'resolved', category: 'thanks', resolved_at: now, updated_at: now });
    console.log(`[CSBot] Auto-resolved thanks ticket ${ticket.id}`);
    _refreshCache().catch(() => {});
    return true;
  }

  // Generate AI reply
  const effectiveCat = cat || ticket.category;
  const reply = await generateBotReply(ticket, lastInboundBody, effectiveCat);
  if (!reply) return false;

  // Send reply
  const sent = await sendReply(ticket.phone, reply);
  if (sent) {
    const now = new Date().toISOString();
    if (effectiveCat && !ticket.category) {
      await sbPatch('support_tickets', `id=eq.${ticket.id}`, { category: effectiveCat, updated_at: now });
    }
    console.log(`[CSBot] Replied to ${ticket.phone} (${effectiveCat || 'unknown'}): ${reply.slice(0, 80)}...`);
  }
  return sent;
}

export interface BotRunResult {
  processed: number;
  replied: number;
  resolved: number;
  skipped: number;
}

/** Run CS bot on all open tickets that need a reply */
export async function runCsBotOnAll(): Promise<BotRunResult> {
  const result: BotRunResult = { processed: 0, replied: 0, resolved: 0, skipped: 0 };
  const tickets = await getTickets();
  const needsReply = tickets.filter(t => {
    if (t.status === 'closed' || t.status === 'resolved') return false;
    const last = t.messages[t.messages.length - 1];
    return last && last.direction === 'inbound';
  });

  console.log(`[CSBot] Running on ${needsReply.length} open tickets...`);
  for (const ticket of needsReply) {
    result.processed++;
    const lastInboundBody = ticket.messages[ticket.messages.length - 1]?.body?.trim() || '';
    const cat = detectCategory(lastInboundBody);
    if (cat === 'thanks') {
      const now = new Date().toISOString();
      await sbPatch('support_tickets', `id=eq.${ticket.id}`, { status: 'resolved', category: 'thanks', resolved_at: now, updated_at: now });
      result.resolved++;
    } else {
      const sent = await runCsBot(ticket);
      if (sent) result.replied++;
      else result.skipped++;
    }
    // Rate limit: 3/sec max
    await new Promise(r => setTimeout(r, 350));
  }
  _refreshCache().catch(() => {});
  console.log(`[CSBot] Done: replied=${result.replied} resolved=${result.resolved} skipped=${result.skipped}`);
  return result;
}

/** Backfill caller_name for tickets that don't have one yet — runs in background on startup */
export async function backfillCallerNames(): Promise<void> {
  try {
    const tickets = await sbGet('support_tickets', 'caller_name=is.null&phone=not.like.form-%25&select=id,phone&limit=200');
    if (tickets.length === 0) return;
    console.log(`[Support] Backfilling caller names for ${tickets.length} tickets...`);
    let filled = 0;
    for (const t of tickets) {
      const name = await lookupCallerName(t.phone);
      if (name) {
        await sbPatch('support_tickets', `id=eq.${t.id}`, { caller_name: name });
        filled++;
      }
    }
    console.log(`[Support] Backfilled ${filled}/${tickets.length} caller names`);
    if (filled > 0) _refreshCache().catch(() => {});
  } catch (err) {
    console.error('[Support] Backfill error:', err);
  }
}
