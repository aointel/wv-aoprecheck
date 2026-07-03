/**
 * Backfill stuck taskrouter_inbound rows in twilio_call_logs: set call_status, call_duration, call_ended_at (and owner_email when from child).
 * Stuck = call_source = 'taskrouter_inbound' and (call_status = 'in-progress' or call_ended_at is null).
 * Uses: (1) Twilio API for the inbound call SID to get status/duration/end, (2) child rows (agent leg) in twilio_call_logs when Twilio is missing or we need owner_email.
 * Run: npx tsx server/scripts/backfill-taskrouter-inbound-call-logs.ts [days=7] [limit=100] [dryRun=0]
 */
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';
import { supabaseAdmin } from '../supabase';

const DEFAULT_DAYS = 7;
const DEFAULT_LIMIT = 100;

async function main() {
  const days = parseInt(process.argv[2] || String(DEFAULT_DAYS), 10);
  const limit = parseInt(process.argv[3] || String(DEFAULT_LIMIT), 10);
  const dryRun = process.argv[4] === '1' || process.argv[4] === 'true';

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured');
    process.exit(1);
  }
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio credentials not configured');
    process.exit(1);
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: stuck, error: fetchErr } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, twilio_call_sid, call_started_at, call_status, call_duration, call_ended_at, owner_email')
    .eq('call_source', 'taskrouter_inbound')
    .or('call_status.eq.in-progress,call_ended_at.is.null')
    .gte('call_started_at', since.toISOString())
    .order('call_started_at', { ascending: false })
    .limit(limit);

  if (fetchErr) {
    console.error('❌ Fetch stuck rows:', fetchErr.message);
    process.exit(1);
  }
  if (!stuck?.length) {
    console.log('✅ No stuck taskrouter_inbound rows in the last', days, 'days');
    process.exit(0);
  }

  console.log(`📋 Found ${stuck.length} stuck taskrouter_inbound rows (last ${days} days, limit ${limit}). Dry run: ${dryRun}\n`);

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of stuck as any[]) {
    const sid = row.twilio_call_sid;
    if (!sid) {
      skipped++;
      continue;
    }

    let status: string | null = null;
    let duration: number | null = null;
    let callEndedAt: string | null = null;
    let ownerEmail: string | null = row.owner_email || null;

    // 1) Try Twilio API for this call (inbound leg)
    try {
      const call = await client.calls(sid).fetch();
      const raw = call as any;
      const s = (raw.status || call.status || '').toLowerCase();
      if (['completed', 'failed', 'canceled', 'busy', 'no-answer'].includes(s)) {
        status = s;
        duration = (raw.duration ?? call.duration) != null ? parseInt(String(raw.duration ?? call.duration), 10) : null;
        const endTime = raw.endTime ?? raw.end_time ?? call.endTime;
        const dateUpdated = raw.dateUpdated ?? raw.date_updated ?? call.dateUpdated;
        if (endTime) {
          callEndedAt = typeof endTime === 'string' ? endTime : (endTime as Date).toISOString?.() ?? null;
        }
        if (!callEndedAt && dateUpdated) {
          callEndedAt = typeof dateUpdated === 'string' ? dateUpdated : (dateUpdated as Date).toISOString?.() ?? null;
        }
      }
    } catch (e: any) {
      if (e?.code === 20404) {
        // Not found in Twilio (expired) – fall back to child rows
      } else {
        console.warn(`  ⚠️ Twilio fetch ${sid}:`, e?.message ?? e);
        errors++;
      }
    }

    // 2) If still missing end state, use child row (agent leg) from our DB
    if ((!status || !callEndedAt) && supabaseAdmin) {
      const { data: children } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('call_status, call_duration, call_ended_at, owner_email')
        .eq('parent_call_sid', sid)
        .not('call_ended_at', 'is', null)
        .order('call_ended_at', { ascending: false })
        .limit(1);
      const child = (children as any[])?.[0];
      if (child) {
        if (!status) status = (child.call_status || '').toLowerCase();
        if (duration == null && child.call_duration != null) duration = parseInt(String(child.call_duration), 10);
        if (!callEndedAt && child.call_ended_at) callEndedAt = child.call_ended_at;
        if (!ownerEmail && child.owner_email) ownerEmail = child.owner_email;
      }
    }

    if (!status || !callEndedAt) {
      skipped++;
      if (updated + skipped + errors <= 20) {
        console.log(`  ⏭️ ${sid}: no end state from Twilio or child (status=${status ?? '—'}, call_ended_at=${callEndedAt ?? '—'})`);
      }
      continue;
    }

    const payload: Record<string, unknown> = {
      call_status: status,
      call_ended_at: callEndedAt,
      updated_at: new Date().toISOString(),
    };
    if (duration != null) payload.call_duration = duration;
    if (ownerEmail) payload.owner_email = ownerEmail;

    if (!dryRun) {
      const { error: upErr } = await supabaseAdmin
        .from('twilio_call_logs')
        .update(payload)
        .eq('twilio_call_sid', sid);
      if (upErr) {
        console.warn(`  ❌ Update ${sid}:`, upErr.message);
        errors++;
        continue;
      }
    }
    updated++;
    if (updated <= 15) {
      console.log(`  ✅ ${sid} → status=${status}, duration=${duration ?? '—'}, ended=${callEndedAt?.slice(0, 19)}${dryRun ? ' (dry run)' : ''}`);
    }
  }

  console.log(`\n✅ Done. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}${dryRun ? ' (dry run – no DB writes)' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
