/**
 * Inbound solution: when we have an inbound call in twilio_call_logs, look it up in Taalk
 * by phone + time, pull persona + recording (and other call info), update our row and
 * store recording in Supabase (same as verification calls).
 *
 * Run as scheduler (e.g. every 10 min) or one-off script.
 * Usage: npx tsx server/inbound-enrich-from-taalk.ts [days=1] [limit=50]
 */
import { supabaseAdmin } from './supabase.js';

const TAALK_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
const BASIC_AUTH = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
const TAALK_BASE = 'https://api.taalk.ai/api/calls';
const DB = 'michaelmandella';
const BUCKET = 'verify_agent_screenshot';
const SIGNED_EXPIRY_SEC = 63072000;
const TIME_SLACK_MS = 30 * 60 * 1000; // ±30 min match

function normalizePhone(p: string | null | undefined): string {
  return String(p || '').replace(/\D/g, '').slice(-10);
}

async function taalkFetch(path: string, opts: { json?: boolean } = {}): Promise<any> {
  const url = path.startsWith('http')
    ? path
    : `${TAALK_BASE}${path}${path.includes('?') ? '&' : '?'}db=${DB}`;
  let res = await fetch(url, { headers: { Authorization: `Bearer ${TAALK_API_KEY}` } });
  if (!res.ok) res = await fetch(url, { headers: { Authorization: `Basic ${BASIC_AUTH}` } });
  if (!res.ok) return null;
  return opts.json !== false ? res.json().catch(() => null) : res;
}

async function taalkListCalls(limit: number): Promise<any[]> {
  const data = await taalkFetch(`?limit=${limit}`);
  if (!data) return [];
  return Array.isArray(data) ? data : data.calls || data.payload || [];
}

async function taalkCallDetails(callId: string): Promise<{ persona?: string; duration?: number } | null> {
  const data = await taalkFetch(`/${callId}`);
  if (!data) return null;
  const info = data.payload || data;
  const persona = info.persona || info.Persona || (info.params && (info.params.Persona || info.params.persona));
  return { persona: persona ? String(persona) : undefined, duration: info.duration };
}

async function downloadTaalkToSupabase(taalkCallId: string): Promise<string | null> {
  const url = `${TAALK_BASE}/${taalkCallId}/recording?db=${DB}`;
  let res = await fetch(url, { headers: { Authorization: `Bearer ${TAALK_API_KEY}`, Accept: 'audio/mpeg' } });
  if (!res.ok) res = await fetch(url, { headers: { Authorization: `Basic ${BASIC_AUTH}`, Accept: 'audio/mpeg' } });
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) return null;
  const fileName = `recordings/inbound-taalk-${taalkCallId}.mp3`;
  const { error: upErr } = await supabaseAdmin!.storage.from(BUCKET).upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: true });
  if (upErr) return null;
  const { data: signed } = await supabaseAdmin!.storage.from(BUCKET).createSignedUrl(fileName, SIGNED_EXPIRY_SEC);
  return signed?.signedUrl || null;
}

/** One run: find recent inbounds, match to Taalk by phone+time, set call_source + recording_url (Supabase). */
export async function runInboundEnrichFromTaalk(days: number, limit: number): Promise<{ updated: number; skipped: number; errors: number }> {
  if (!supabaseAdmin) return { updated: 0, skipped: 0, errors: 0 };

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  // Only rows that need enrichment: no recording yet, or still have Taalk URL (we replace with Supabase)
  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, from_number, to_number, call_started_at, call_source, recording_url')
    .eq('call_direction', 'inbound')
    .gte('call_started_at', since)
    .or('recording_url.is.null,recording_url.ilike.%api.taalk.ai%')
    .order('call_started_at', { ascending: false })
    .limit(limit);

  if (error || !rows?.length) return { updated: 0, skipped: 0, errors: error ? 1 : 0 };

  const taalkCalls = await taalkListCalls(800);
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows as any[]) {
    const phone = normalizePhone(row.from_number || row.to_number);
    if (phone.length < 10) {
      skipped++;
      continue;
    }
    const callAt = new Date(row.call_started_at).getTime();
    const matching = taalkCalls.filter((c: any) => {
      const cPhone = normalizePhone(c.phone || c.from || c.to);
      if (cPhone !== phone) return false;
      const cTime = new Date(c.created_at || c.createdAt || c.date || 0).getTime();
      return Math.abs(cTime - callAt) <= TIME_SLACK_MS;
    });
    if (matching.length === 0) {
      skipped++;
      continue;
    }
    matching.sort((a: any, b: any) => {
      const ta = new Date(a.created_at || a.createdAt || 0).getTime();
      const tb = new Date(b.created_at || b.createdAt || 0).getTime();
      return Math.abs(tb - callAt) - Math.abs(ta - callAt);
    });
    const best = matching[0];
    const taalkId = best.id || best._id;
    if (!taalkId) {
      skipped++;
      continue;
    }

    const details = await taalkCallDetails(taalkId);
    const persona = details?.persona || best.persona || best.Persona || (best.params && best.params.Persona) || 'taalk_inbound';
    const signedUrl = await downloadTaalkToSupabase(taalkId);

    const { error: upErr } = await supabaseAdmin
      .from('twilio_call_logs')
      .update({
        call_source: persona,
        ...(signedUrl ? { recording_url: signedUrl } : {}),
      })
      .eq('id', row.id);

    if (upErr) {
      errors++;
      continue;
    }
    updated++;
  }

  return { updated, skipped, errors };
}

async function main() {
  const days = parseInt(process.argv[2] || '1', 10);
  const limit = parseInt(process.argv[3] || '50', 10);
  console.log('\n📞 Inbound enrich from Taalk (phone+time match → persona + Supabase recording)\n');
  const result = await runInboundEnrichFromTaalk(days, limit);
  console.log('Updated:', result.updated, 'Skipped:', result.skipped, 'Errors:', result.errors, '\n');
}

if (process.argv[1]?.includes('inbound-enrich-from-taalk')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
