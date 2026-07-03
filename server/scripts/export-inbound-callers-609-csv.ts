/**
 * Export ALL 609 inbound callers from Twilio (batched) + any data we have (masterlead, call logs) to CSV.
 * No prompts — writes CSV to server/scripts/output/.
 *
 * Run: npx tsx server/scripts/export-inbound-callers-609-csv.ts [hours=96]
 */
import * as fs from 'fs';
import * as path from 'path';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';
import { supabaseAdmin } from '../supabase.js';

const INBOUND_609 = '+16096048379';
const BATCH_SIZE = 1000;
const DEFAULT_HOURS = 96;

function normalize10(phone: string | null | undefined): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function csvEscape(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const hours = parseInt(process.argv[2] || String(DEFAULT_HOURS), 10) || DEFAULT_HOURS;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio not configured.');
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const after = new Date(Date.now() - hours * 60 * 60 * 1000);
  const startTimeAfter = after.toISOString().slice(0, 19) + 'Z';

  console.log(`\n📞 Fetching ALL callers TO ${INBOUND_609} (last ${hours}h) from Twilio...\n`);

  const callers = new Map<string, { count: number; lastStatus: string; lastStart: string }>();
  let endTimeBefore: string | null = null;

  while (true) {
    const opts: Record<string, unknown> = { to: INBOUND_609, startTimeAfter, limit: BATCH_SIZE };
    if (endTimeBefore) opts.endTimeBefore = endTimeBefore;
    const batch = await client.calls.list(opts as any);
    for (const c of batch) {
      const from = (c.from || '').trim();
      if (!from) continue;
      const start = c.startTime ? new Date(c.startTime).toISOString() : '';
      const status = (c.status || '').toLowerCase();
      const existing = callers.get(from);
      if (!existing) callers.set(from, { count: 1, lastStatus: status, lastStart: start });
      else {
        existing.count += 1;
        existing.lastStatus = status;
        existing.lastStart = start;
      }
    }
    console.log(`   Twilio batch: ${batch.length}`);
    if (batch.length < BATCH_SIZE) break;
    const oldest = batch[batch.length - 1];
    const oldestStart = oldest.startTime ? new Date(oldest.startTime) : null;
    if (!oldestStart) break;
    endTimeBefore = oldestStart.toISOString().slice(0, 19) + 'Z';
  }

  const phones = [...callers.keys()];
  console.log(`   Total unique callers: ${phones.length}\n`);

  const leadByPhone = new Map<string, { id: number; taalk_lead_id: string | null; first_name: string | null; last_name: string | null; email: string | null; state: string | null; city: string | null; market: string | null }>();
  if (supabaseAdmin) {
    console.log('   Loading masterlead by phone...');
    let offset = 0;
    const pageSize = 2000;
    while (true) {
      const { data: rows } = await supabaseAdmin
        .from('masterlead')
        .select('id, taalk_lead_id, first_name, last_name, email, phone, phone_number, state, city, taalk_market, market')
        .range(offset, offset + pageSize - 1);
      const list = (rows || []) as any[];
      for (const r of list) {
        const p10 = normalize10(r.phone || r.phone_number);
        if (p10.length >= 10 && !leadByPhone.has(p10)) {
          leadByPhone.set(p10, {
            id: r.id,
            taalk_lead_id: r.taalk_lead_id ?? null,
            first_name: r.first_name ?? null,
            last_name: r.last_name ?? null,
            email: r.email ?? null,
            state: r.state ?? null,
            city: r.city ?? null,
            market: r.taalk_market ?? r.market ?? null,
          });
        }
      }
      if (list.length < pageSize) break;
      offset += pageSize;
    }
    console.log(`   Masterlead rows (by last10): ${leadByPhone.size}`);
  }

  const logByPhone = new Map<string, { owner_emails: string; lead_ids: string }>();
  if (supabaseAdmin && phones.length > 0) {
    console.log('   Loading twilio_call_logs (inbound by from_number)...');
    const chunk = 200;
    for (let i = 0; i < phones.length; i += chunk) {
      const batch = phones.slice(i, i + chunk);
      const { data: rows } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('from_number, owner_email, metadata, lead_id, taalk_lead_id')
        .eq('call_direction', 'inbound')
        .in('from_number', batch);
      for (const r of (rows || []) as any[]) {
        const from = (r.from_number || '').trim();
        if (!from) continue;
        const meta = (r.metadata && typeof r.metadata === 'object') ? r.metadata : {};
        const leadId = r.lead_id || meta.lead_id || meta.leadId || '';
        const taalk = r.taalk_lead_id || meta.taalk_lead_id || meta.taalkLeadId || '';
        const owner = (r.owner_email || '').trim();
        const cur = logByPhone.get(from);
        if (!cur) {
          logByPhone.set(from, {
            owner_emails: owner ? owner : '',
            lead_ids: leadId || taalk ? [leadId, taalk].filter(Boolean).join(';') : '',
          });
        } else {
          if (owner && !cur.owner_emails.includes(owner)) cur.owner_emails = [cur.owner_emails, owner].filter(Boolean).join('; ');
          if ((leadId || taalk) && !cur.lead_ids.includes(leadId || taalk)) cur.lead_ids = [cur.lead_ids, leadId, taalk].filter(Boolean).join(';');
        }
      }
    }
    console.log(`   Call log rows: ${logByPhone.size}\n`);
  }

  const outDir = path.join(process.cwd(), 'server', 'scripts', 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(outDir, `inbound-callers-609-${timestamp}.csv`);

  const headers = [
    'phone', 'call_count', 'last_status', 'last_call_utc',
    'lead_id', 'taalk_lead_id', 'first_name', 'last_name', 'email', 'market', 'state', 'city',
    'owner_emails', 'lead_ids_from_logs',
  ];
  const lines = [headers.join(',')];

  const sorted = [...callers.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [phone, info] of sorted) {
    const p10 = normalize10(phone);
    const lead = leadByPhone.get(p10);
    const log = logByPhone.get(phone);
    const row = [
      csvEscape(phone),
      csvEscape(info.count),
      csvEscape(info.lastStatus),
      csvEscape(info.lastStart.slice(0, 19)),
      csvEscape(lead?.id),
      csvEscape(lead?.taalk_lead_id),
      csvEscape(lead?.first_name),
      csvEscape(lead?.last_name),
      csvEscape(lead?.email),
      csvEscape(lead?.market),
      csvEscape(lead?.state),
      csvEscape(lead?.city),
      csvEscape(log?.owner_emails),
      csvEscape(log?.lead_ids),
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
