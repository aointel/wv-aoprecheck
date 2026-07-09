/**
 * Ghost Tracker
 *
 * - Persists ghost status in Supabase (agent_ghost_status table)
 * - Sends a one-time SMS when an agent enters ghost status
 * - Exposes ghost set for UI rendering
 *
 * Ghost SMS (sent once, never repeat until they recover + re-ghost):
 *   "Hey [name] — you've reached Ghost status on ConnectNow. Your transfers will
 *    go to other agents first. Stay online and answer quickly to move back up."
 */

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

// Twilio creds — reuse same account as AOIrail
const TWILIO_SID   = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_TOKEN = 'b275d646252457344ff62528e3538ea9';
const TWILIO_FROM  = '+16123459649'; // ConnectNow SMS number

// In-memory set of emails that have already received their ghost SMS this session.
// Supabase is the persistent store — this just prevents duplicate sends across cycles.
const smsSentThisSession = new Set<string>();

async function supaPost(table: string, body: object): Promise<void> {
  try {
    await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(body),
    });
  } catch { /* non-critical */ }
}

async function supaGet(table: string, params: string): Promise<any[]> {
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    if (!res.ok) return [];
    const d = await res.json();
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}

async function sendSMS(to: string, body: string): Promise<void> {
  try {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
    });
  } catch { /* non-critical */ }
}

export interface GhostRecord {
  email: string;
  ghostSince: string;
  smsSent: boolean;
  recovered: boolean;
}

/**
 * Process ghost transitions for agents that newly entered ghost status.
 * Writes to Supabase and sends SMS.
 */
export async function processGhostTransitions(
  newlyGhostEmails: string[], // emails that just crossed into ghost this cycle
  agentNames: Map<string, string>, // email → full name
  agentPhones: Map<string, string>, // email → mobile phone
): Promise<void> {
  if (newlyGhostEmails.length === 0) return;

  // Check which ones have already had SMS sent (from DB)
  const emailList = newlyGhostEmails.map(e => `"${e}"`).join(',');
  const existing = await supaGet('agent_ghost_status',
    `email=in.(${emailList})&select=email,sms_sent`
  );
  const alreadySent = new Set(existing.filter(r => r.sms_sent).map(r => r.email));

  for (const email of newlyGhostEmails) {
    if (smsSentThisSession.has(email) || alreadySent.has(email)) continue;

    const name = (agentNames.get(email) || 'Agent').split(' ')[0];
    const phone = agentPhones.get(email);

    // Upsert ghost record
    await supaPost('agent_ghost_status', {
      email,
      ghost_since: new Date().toISOString(),
      sms_sent: !!phone,
      recovered: false,
    });

    // Send SMS if we have a number
    if (phone) {
      const msg = `Hey ${name} — you've reached Ghost status on ConnectNow. ` +
        `Your transfers will go to other agents first. ` +
        `Stay online and answer quickly to move back up. 👻`;
      await sendSMS(phone, msg);
      smsSentThisSession.add(email);
      console.log(`👻 Ghost SMS sent to ${name} (${email})`);
    } else {
      smsSentThisSession.add(email);
      console.log(`👻 ${name} (${email}) is ghost — no phone on file, SMS skipped`);
    }
  }
}

/**
 * Mark an agent as recovered from ghost status.
 * Called when their pick rate crosses GHOST_RECOVER_PICK.
 */
export async function markGhostRecovered(email: string): Promise<void> {
  try {
    await fetch(`${SUPA_URL}/rest/v1/agent_ghost_status?email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recovered: true, recovered_at: new Date().toISOString() }),
    });
    smsSentThisSession.delete(email); // allow future ghost SMS if they re-ghost
  } catch { /* non-critical */ }
}

/**
 * Get current ghost set from Supabase (for UI).
 */
export async function getActiveGhosts(): Promise<GhostRecord[]> {
  const rows = await supaGet('agent_ghost_status', 'recovered=eq.false&select=email,ghost_since,sms_sent,recovered');
  return rows.map(r => ({
    email: r.email,
    ghostSince: r.ghost_since,
    smsSent: r.sms_sent,
    recovered: r.recovered,
  }));
}
