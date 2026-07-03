/**
 * Backfill Zapier webhook (associate_id + taalk_lead_id / lead_id) for the last 15 days.
 * Processes in batches, no pagination cap — runs until all unsent rows are sent.
 * Can take a long time; run with: npx tsx server/scripts/backfill-zapier-webhook-15-days.ts
 */
import { supabaseAdmin } from '../supabase.js';

const ZAPIER_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';
const DAYS = 15;
const BATCH_SIZE = 100;
const DELAY_MS = 150;
const BATCH_DELAY_MS = 2000;

const fifteenDaysAgo = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function backfillBookedLeads(): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0,
    skipped = 0,
    failed = 0;

  console.log(`\n📤 Booked leads (last ${DAYS} days, batch ${BATCH_SIZE}) — no pagination cap\n`);

  while (true) {
    const { data: rows, error } = await supabaseAdmin!
      .from('masterlead')
      .select('id, taalk_lead_id, cn_email, previous_cn_email, first_name, last_name, phone, resolved_at, updated_at, created_at')
      .eq('cnresolution', 'booked')
      .is('webhook_sent_at', null)
      .or(`resolved_at.gte.${fifteenDaysAgo},resolved_at.is.null`)
      .order('resolved_at', { ascending: false })
      .limit(BATCH_SIZE);

    if (error) {
      console.error('❌ Booked leads fetch error:', error.message);
      break;
    }
    if (!rows || rows.length === 0) break;

    for (const lead of rows as any[]) {
      if (!lead.cn_email) {
        skipped++;
        continue;
      }
      const leadDate = lead.resolved_at ?? lead.updated_at ?? lead.created_at;
      if (lead.resolved_at == null && leadDate != null && String(leadDate) < fifteenDaysAgo) {
        skipped++;
        continue;
      }
      const { data: agent } = await supabaseAdmin!
        .from('customers')
        .select('associate_id')
        .eq('company_email', String(lead.cn_email).toLowerCase().trim())
        .maybeSingle();
      if (!agent?.associate_id) {
        skipped++;
        continue;
      }
      if (!lead.taalk_lead_id) {
        skipped++;
        continue;
      }
      const payload = { lead_id: String(lead.taalk_lead_id), associate_id: agent.associate_id };
      try {
        const res = await fetch(ZAPIER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await supabaseAdmin!
            .from('masterlead')
            .update({ webhook_sent_at: new Date().toISOString() })
            .eq('id', lead.id);
          sent++;
          if (sent <= 20) console.log(`   ✅ Booked lead ${lead.taalk_lead_id} → Zapier`);
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
      await delay(DELAY_MS);
    }

    console.log(`   Booked batch: ${rows.length} rows → sent ${sent} total so far, skipped ${skipped}, failed ${failed}`);
    if (rows.length < BATCH_SIZE) break;
    await delay(BATCH_DELAY_MS);
  }

  return { sent, skipped, failed };
}

async function backfillLongCalls(): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0,
    skipped = 0,
    failed = 0;

  console.log(`\n📞 Long calls (≥60s, last ${DAYS} days, batch ${BATCH_SIZE}) — no pagination cap\n`);

  while (true) {
    const { data: rows, error } = await supabaseAdmin!
      .from('call_connector_tracker')
      .select('id, lead_id, agent_email, duration, created_at')
      .gte('created_at', fifteenDaysAgo)
      .gte('duration', 60)
      .is('webhook_sent_at', null)
      .order('created_at', { ascending: false })
      .limit(BATCH_SIZE);

    if (error) {
      console.error('❌ Long calls fetch error:', error.message);
      break;
    }
    if (!rows || rows.length === 0) break;

    for (const call of rows as any[]) {
      const { data: lead } = await supabaseAdmin!
        .from('masterlead')
        .select('taalk_lead_id, cn_email')
        .eq('id', call.lead_id)
        .maybeSingle();
      if (!lead?.taalk_lead_id) {
        skipped++;
        continue;
      }
      const email = (call.agent_email || (lead as any).cn_email)?.toLowerCase?.()?.trim();
      const { data: agent } = await supabaseAdmin!
        .from('customers')
        .select('associate_id')
        .eq('company_email', email)
        .maybeSingle();
      if (!agent?.associate_id) {
        skipped++;
        continue;
      }
      const payload = { lead_id: String((lead as any).taalk_lead_id), associate_id: agent.associate_id };
      try {
        const res = await fetch(ZAPIER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await supabaseAdmin!
            .from('call_connector_tracker')
            .update({ webhook_sent_at: new Date().toISOString() })
            .eq('id', call.id);
          sent++;
          if (sent <= 20) console.log(`   ✅ Long call lead ${(lead as any).taalk_lead_id} duration=${call.duration}s → Zapier`);
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
      await delay(DELAY_MS);
    }

    console.log(`   Long-calls batch: ${rows.length} rows → sent ${sent} total so far, skipped ${skipped}, failed ${failed}`);
    if (rows.length < BATCH_SIZE) break;
    await delay(BATCH_DELAY_MS);
  }

  return { sent, skipped, failed };
}

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not configured.');
    process.exit(1);
  }

  console.log(`\n🔄 Backfill Zapier webhook (associate_id + lead_id) — last ${DAYS} days, batches of ${BATCH_SIZE}, no pagination cap\n`);

  const booked = await backfillBookedLeads();
  const longCalls = await backfillLongCalls();

  console.log('\n--- Summary ---');
  console.log(`Booked leads:  sent=${booked.sent} skipped=${booked.skipped} failed=${booked.failed}`);
  console.log(`Long calls:    sent=${longCalls.sent} skipped=${longCalls.skipped} failed=${longCalls.failed}`);
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
