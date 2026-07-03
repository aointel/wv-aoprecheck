/**
 * Report: connects in a 6am–9pm PST window on a given date.
 * Sources: billing_transactions (connect) + vdp_calls END.
 * Run: npm run report-todays-connects
 *      npm run report-todays-connects -- --date=2026-01-29
 */

import { supabaseAdmin } from '../supabase';

const PST = '-08:00'; // PST offset (use -07:00 for PDT if you add summer dates)

function get6am9pmPst(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T06:00:00${PST}`);
  const end = new Date(`${dateStr}T21:00:00${PST}`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error(`Invalid date: ${dateStr}. Use YYYY-MM-DD.`);
  }
  return { start, end };
}

function parseArgs(): string {
  const arg = process.argv.find((a) => a.startsWith('--date='));
  if (arg) return arg.slice('--date='.length).trim();
  return '2026-01-29';
}

async function main() {
  if (!supabaseAdmin) {
    console.error('Supabase not initialized');
    process.exit(1);
  }

  const dateStr = parseArgs();
  const { start: dateStart, end: dateEnd } = get6am9pmPst(dateStr);
  console.log(`Window: 6:00 AM – 9:00 PM PST on ${dateStr}\n`);

  // Billing: connect
  const { data: billingRows, error: billingErr } = await supabaseAdmin
    .from('billing_transactions')
    .select('agent_email, transaction_date')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', dateStart.toISOString())
    .lt('transaction_date', dateEnd.toISOString())
    .not('agent_email', 'is', null)
    .neq('agent_email', '')
    .limit(100000);

  if (billingErr) {
    console.error('billing_transactions error:', billingErr);
    throw billingErr;
  }

  const byAgentBilling = new Map<string, number>();
  (billingRows ?? []).forEach((r: any) => {
    const e = (r.agent_email ?? '').toLowerCase().trim();
    if (e) byAgentBilling.set(e, (byAgentBilling.get(e) ?? 0) + 1);
  });
  const totalBilling = Array.from(byAgentBilling.values()).reduce((a, b) => a + b, 0);

  // VDP: END
  const { data: vdpRows, error: vdpErr } = await supabaseAdmin
    .from('vdp_calls')
    .select('company_email, updated_at')
    .or('event.eq.END,event.eq.end')
    .gte('updated_at', dateStart.toISOString())
    .lt('updated_at', dateEnd.toISOString())
    .limit(100000);

  if (vdpErr) {
    console.error('vdp_calls error:', vdpErr);
    throw vdpErr;
  }

  const byAgentVdp = new Map<string, number>();
  (vdpRows ?? []).forEach((r: any) => {
    const e = (r.company_email ?? '').toLowerCase().trim();
    if (e) byAgentVdp.set(e, (byAgentVdp.get(e) ?? 0) + 1);
  });
  const totalVdp = Array.from(byAgentVdp.values()).reduce((a, b) => a + b, 0);

  // Combined (billing || vdp per agent, like LCB)
  const allEmails = new Set([...byAgentBilling.keys(), ...byAgentVdp.keys()]);
  const combined: { email: string; billing: number; vdp: number; combined: number }[] = [];
  allEmails.forEach((email) => {
    const b = byAgentBilling.get(email) ?? 0;
    const v = byAgentVdp.get(email) ?? 0;
    combined.push({ email, billing: b, vdp: v, combined: b || v });
  });
  combined.sort((a, b) => b.combined - a.combined);
  const totalCombined = combined.reduce((s, x) => s + x.combined, 0);

  console.log('--- CONNECTS (6am–9pm PST) ---\n');
  console.log(`Billing (connect):     ${totalBilling} total, ${byAgentBilling.size} agents`);
  console.log(`VDP (END):             ${totalVdp} total, ${byAgentVdp.size} agents`);
  console.log(`Combined (billing||vdp): ${totalCombined} total, ${allEmails.size} agents\n`);
  console.log('Top 30 by connects:');
  console.log('email | billing | vdp | combined');
  combined.slice(0, 30).forEach((r) => {
    console.log(`${r.email} | ${r.billing} | ${r.vdp} | ${r.combined}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
