/**
 * Backfill twilio_call_logs local Neon table directly from Twilio REST API.
 * Pulls today's calls and upserts into local DB with owner_email from client: identity.
 */
import { pool } from './db.js';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './hardcoded-config.js';

const TWILIO_BASE = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;
const AUTH = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

async function twilioGet(url: string): Promise<any> {
  const res = await fetch(url.startsWith('http') ? url : TWILIO_BASE + url, {
    headers: { Authorization: AUTH },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  return res.json();
}

function ownerEmailFromCall(call: any): string | null {
  // WebRTC client identity can appear on either leg endpoint depending on call direction.
  if (typeof call.to === 'string' && call.to.startsWith('client:')) {
    return call.to.replace('client:', '').toLowerCase().trim();
  }
  if (typeof call.from === 'string' && call.from.startsWith('client:')) {
    return call.from.replace('client:', '').toLowerCase().trim();
  }
  return null;
}

async function upsertCallLog(call: any, ownerEmail: string | null) {
  const duration = parseInt(call.duration) || 0;
  await pool.query(`
    INSERT INTO twilio_call_logs (
      twilio_call_sid, owner_email, agent_identity, from_number, to_number,
      call_direction, call_status, call_duration, call_started_at, call_ended_at,
      parent_call_sid, call_source, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
    ON CONFLICT (twilio_call_sid) DO UPDATE SET
      call_status = EXCLUDED.call_status,
      call_duration = GREATEST(twilio_call_logs.call_duration, EXCLUDED.call_duration),
      call_ended_at = COALESCE(twilio_call_logs.call_ended_at, EXCLUDED.call_ended_at),
      owner_email = COALESCE(twilio_call_logs.owner_email, EXCLUDED.owner_email),
      updated_at = NOW()
  `, [
    call.sid,
    ownerEmail,
    call.to?.startsWith('client:') ? call.to : null,
    call.from,
    call.to,
    call.direction,
    call.status,
    duration,
    call.start_time ? new Date(call.start_time).toISOString() : null,
    call.end_time ? new Date(call.end_time).toISOString() : null,
    call.parent_call_sid || null,
    'twilio-api-backfill',
  ]);
}

async function ensureTwilioCallLogsIdSequence(): Promise<void> {
  const seqRes = await pool.query<{ seq: string | null }>(
    `SELECT pg_get_serial_sequence('twilio_call_logs', 'id') AS seq`,
  );
  const seqName = String(seqRes.rows[0]?.seq || '').trim();
  if (!seqName) return;

  const maxRes = await pool.query<{ max_id: number }>(
    `SELECT COALESCE(MAX(id), 0)::int AS max_id FROM twilio_call_logs`,
  );
  const maxId = Number(maxRes.rows[0]?.max_id || 0);
  await pool.query(`SELECT setval($1::regclass, $2, true)`, [seqName, maxId + 1]);
}

async function loadExistingOutboundSids(startIso: string): Promise<Set<string>> {
  const existing = new Set<string>();
  const pageSize = 10000;
  for (let offset = 0; ; offset += pageSize) {
    const { rows } = await pool.query<{ twilio_call_sid: string }>(
      `
        SELECT twilio_call_sid
        FROM twilio_call_logs
        WHERE call_started_at >= $1::date
          AND LOWER(COALESCE(call_direction, '')) LIKE 'outbound%'
        ORDER BY id ASC
        LIMIT $2 OFFSET $3
      `,
      [startIso, pageSize, offset],
    );
    for (const row of rows) {
      const sid = String(row.twilio_call_sid || '').trim();
      if (sid) existing.add(sid);
    }
    if (rows.length < pageSize) break;
  }
  return existing;
}

export async function backfillTwilioCallsToLocal(
  daysBack = 1,
): Promise<{ upserted: number; errors: number; skipped_existing: number }> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  // Use PST day start
  const ptDay = startDate.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const startIso = ptDay; // YYYY-MM-DD — Twilio accepts this

  console.log(`[TwilioBackfill] Fetching calls from ${startIso} via Twilio API...`);
  await ensureTwilioCallLogsIdSequence();
  const existingSids = await loadExistingOutboundSids(startIso);
  console.log(`[TwilioBackfill] Existing outbound SIDs since ${startIso}: ${existingSids.size}`);

  let upserted = 0;
  let errors = 0;
  let skippedExisting = 0;
  // Track parent→child for owner_email resolution
  const parentToOwner = new Map<string, string>();

  // Pass 0: inbound client legs (parent calls for many outbound-dial calls)
  // Build a stable parent SID -> owner map first.
  let pageUrl = `${TWILIO_BASE}/Calls.json?StartTime>=${startIso}&Direction=inbound&PageSize=1000`;
  while (pageUrl) {
    const data = await twilioGet(pageUrl);
    for (const call of data.calls || []) {
      const sid = String(call.sid || '').trim();
      if (!sid) continue;
      const owner = ownerEmailFromCall(call);
      if (owner) parentToOwner.set(sid, owner);
      const shouldUpsertExisting = existingSids.has(sid) && !!owner;
      if (existingSids.has(sid) && !shouldUpsertExisting) {
        skippedExisting++;
        continue;
      }
      try {
        await upsertCallLog(call, owner);
        upserted++;
        existingSids.add(sid);
      } catch (e: any) {
        console.error(`Upsert error ${sid}:`, e.message);
        errors++;
      }
    }
    pageUrl = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : '';
    console.log(`[TwilioBackfill] inbound-client-pass: inserted_missing=${upserted}, skipped_existing=${skippedExisting}, parentOwnerMap=${parentToOwner.size}...`);
  }

  // First pass: child legs (outbound-dial) have client: identity in To
  pageUrl = `${TWILIO_BASE}/Calls.json?StartTime>=${startIso}&Direction=outbound-dial&PageSize=1000`;
  while (pageUrl) {
    const data = await twilioGet(pageUrl);
    for (const call of data.calls || []) {
      const sid = String(call.sid || '').trim();
      if (!sid) continue;
      const owner = ownerEmailFromCall(call) || (call.parent_call_sid ? parentToOwner.get(String(call.parent_call_sid).trim()) || null : null);
      if (owner && call.parent_call_sid) parentToOwner.set(call.parent_call_sid, owner);
      // Existing rows still need occasional upsert so ownership fields can be refreshed.
      const shouldUpsertExisting = existingSids.has(sid) && !!owner;
      if (existingSids.has(sid) && !shouldUpsertExisting) {
        skippedExisting++;
        continue;
      }
      try {
        await upsertCallLog(call, owner);
        upserted++;
        existingSids.add(sid);
      } catch (e: any) {
        console.error(`Upsert error ${sid}:`, e.message);
        errors++;
      }
    }
    pageUrl = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : "";
    console.log(`[TwilioBackfill] outbound-dial: inserted_missing=${upserted}, skipped_existing=${skippedExisting}...`);
  }

  // Second pass: parent legs (outbound-api) — use parentToOwner map
  pageUrl = `${TWILIO_BASE}/Calls.json?StartTime>=${startIso}&Direction=outbound-api&PageSize=1000`;
  while (pageUrl) {
    const data = await twilioGet(pageUrl);
    for (const call of data.calls || []) {
      const sid = String(call.sid || '').trim();
      if (!sid) continue;
      const owner = parentToOwner.get(call.sid) || null;
      // For parent legs, upsert existing rows when we can now resolve owner from child legs.
      const shouldUpsertExisting = existingSids.has(sid) && !!owner;
      if (existingSids.has(sid) && !shouldUpsertExisting) {
        skippedExisting++;
        continue;
      }
      try {
        await upsertCallLog(call, owner);
        upserted++;
        existingSids.add(sid);
      } catch (e: any) {
        console.error(`Upsert error ${sid}:`, e.message);
        errors++;
      }
    }
    pageUrl = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : '';
    console.log(`[TwilioBackfill] outbound-api: inserted_missing=${upserted}, skipped_existing=${skippedExisting}...`);
  }

  console.log(`[TwilioBackfill] Done: inserted_missing=${upserted}, skipped_existing=${skippedExisting}, errors=${errors}`);
  return { upserted, errors, skipped_existing: skippedExisting };
}
