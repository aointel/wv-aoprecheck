/**
 * Export every 609 INBOUND CALL from Twilio (with SID) + the AGENT LEG that completed it
 * (who had it, how long) + from Twilio whether the call was accepted/completed.
 * One row per call. Writes to server/scripts/output/.
 *
 * Run: npx tsx server/scripts/export-inbound-calls-609-with-legs-csv.ts [hours=96]
 */
import * as fs from 'fs';
import * as path from 'path';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import { supabaseAdmin } from '../supabase.js';

const INBOUND_609 = '+16096048379';
const BATCH_SIZE = 1000;
const DEFAULT_HOURS = 96;

function csvEscape(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type TwilioCall = { sid: string; from: string; to: string; status: string; duration: number | null; startTime: string; endTime: string | null };
type ParentRow = { twilio_call_sid: string; owner_email: string | null; call_duration: number | null; call_status: string | null };
type ChildRow = { parent_call_sid: string; owner_email: string | null; call_duration: number | null; call_status: string | null; call_ended_at: string | null };

async function main() {
  const hours = parseInt(process.argv[2] || String(DEFAULT_HOURS), 10) || DEFAULT_HOURS;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio not configured.');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const after = new Date(Date.now() - hours * 60 * 60 * 1000);
  const startTimeAfter = after.toISOString().slice(0, 19) + 'Z';

  console.log(`\n📞 Fetching ALL inbound CALLS (with SIDs) TO ${INBOUND_609} (last ${hours}h)...\n`);

  const allCalls: TwilioCall[] = [];
  let endTimeBefore: string | null = null;

  while (true) {
    const opts: Record<string, unknown> = { to: INBOUND_609, startTimeAfter, limit: BATCH_SIZE };
    if (endTimeBefore) opts.endTimeBefore = endTimeBefore;
    const batch = await client.calls.list(opts as any);
    for (const c of batch) {
      const from = (c.from || '').trim();
      if (!from) continue;
      allCalls.push({
        sid: c.sid,
        from,
        to: (c.to || '').trim(),
        status: (c.status || '').toLowerCase(),
        duration: c.duration != null ? parseInt(String(c.duration), 10) : null,
        startTime: c.startTime ? new Date(c.startTime).toISOString() : '',
        endTime: c.endTime ? new Date(c.endTime).toISOString() : null,
      });
    }
    console.log(`   Twilio batch: ${batch.length} (total calls: ${allCalls.length})`);
    if (batch.length < BATCH_SIZE) break;
    const oldest = batch[batch.length - 1];
    const oldestStart = oldest.startTime ? new Date(oldest.startTime) : null;
    if (!oldestStart) break;
    endTimeBefore = oldestStart.toISOString().slice(0, 19) + 'Z';
  }

  const sids = allCalls.map((c) => c.sid);
  console.log(`   Total calls: ${allCalls.length}\n`);

  const parentBySid = new Map<string, ParentRow>();
  const childrenByParentSid = new Map<string, ChildRow[]>();

  if (supabaseAdmin) {
    console.log('   Loading twilio_call_logs: parent rows (inbound SIDs)...');
    for (let i = 0; i < sids.length; i += 200) {
      const chunk = sids.slice(i, i + 200);
      const { data: rows } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, owner_email, call_duration, call_status')
        .in('twilio_call_sid', chunk);
      for (const r of (rows || []) as ParentRow[]) {
        if (r.twilio_call_sid) parentBySid.set(r.twilio_call_sid, r);
      }
    }
    console.log(`   Parent rows: ${parentBySid.size}`);

    console.log('   Loading twilio_call_logs: agent legs (child rows by parent_call_sid)...');
    for (let i = 0; i < sids.length; i += 200) {
      const chunk = sids.slice(i, i + 200);
      const { data: rows } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('parent_call_sid, owner_email, call_duration, call_status, call_ended_at')
        .in('parent_call_sid', chunk)
        .not('parent_call_sid', 'is', null);
      for (const r of (rows || []) as ChildRow[]) {
        if (!r.parent_call_sid) continue;
        const list = childrenByParentSid.get(r.parent_call_sid) || [];
        list.push(r);
        childrenByParentSid.set(r.parent_call_sid, list);
      }
    }
    const totalChildren = [...childrenByParentSid.values()].reduce((a, arr) => a + arr.length, 0);
    console.log(`   Agent leg rows: ${totalChildren}\n`);
  }

  const outDir = path.join(process.cwd(), 'server', 'scripts', 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(outDir, `inbound-calls-609-with-legs-${timestamp}.csv`);

  const headers = [
    'caller_phone', 'call_sid', 'twilio_status', 'twilio_duration_sec', 'twilio_start_time', 'twilio_end_time',
    'twilio_accepted', 'accepted_by_agent', 'agent_email', 'agent_leg_duration_sec', 'agent_leg_status', 'all_agent_emails',
  ];
  const lines = [headers.join(',')];

  for (const c of allCalls) {
    const parent = parentBySid.get(c.sid);
    const children = childrenByParentSid.get(c.sid) || [];
    const twilioAccepted = c.status === 'completed' && (c.duration ?? 0) > 0;
    const agentEmail = (parent?.owner_email || children[0]?.owner_email || '').trim();
    const acceptedByAgent = !!agentEmail && agentEmail.includes('@');
    const agentDuration = parent?.call_duration ?? children[0]?.call_duration ?? null;
    const agentStatus = parent?.call_status ?? children[0]?.call_status ?? '';
    const allAgents = [...new Set([parent?.owner_email, ...children.map((x) => x.owner_email)].filter(Boolean) as string[])].join('; ');

    const row = [
      csvEscape(c.from),
      csvEscape(c.sid),
      csvEscape(c.status),
      csvEscape(c.duration),
      csvEscape(c.startTime.slice(0, 19)),
      csvEscape(c.endTime?.slice(0, 19)),
      csvEscape(twilioAccepted ? 'Y' : 'N'),
      csvEscape(acceptedByAgent ? 'Y' : 'N'),
      csvEscape(agentEmail || ''),
      csvEscape(agentDuration),
      csvEscape(agentStatus),
      csvEscape(allAgents),
    ];
    lines.push(row.join(','));
  }

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`✅ CSV written: ${outPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
