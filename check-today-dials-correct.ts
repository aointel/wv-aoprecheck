/**
 * Check today's dial count using CORRECT method (agent_dial_metrics)
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkTodayDials() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not available');
    process.exit(1);
  }

  const { start, end } = getTodayEST();
  console.log('📅 Today (EST):');
  console.log(`   Start: ${start.toISOString()}`);
  console.log(`   End: ${end.toISOString()}\n`);

  // Count dials from agent_dial_metrics (CORRECT METHOD)
  console.log('📊 Counting dials from agent_dial_metrics (event_type = "dial")...');
  
  let totalDials = 0;
  let offset = 0;
  const batchSize = 5000;
  const dialedPhones = new Set<string>();

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('lead_phone, agent_email')
      .eq('event_type', 'dial')
      .gte('event_timestamp', start.toISOString())
      .lt('event_timestamp', end.toISOString())
      .not('lead_phone', 'is', null)
      .neq('lead_phone', '')
      .not('agent_email', 'is', null)
      .neq('agent_email', '')
      .order('event_timestamp', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Error:', error);
      break;
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      const phone = String(row.lead_phone || '').trim().replace(/\D/g, '').slice(-10);
      if (phone && phone.length >= 10) {
        dialedPhones.add(phone);
      }
    }

    offset += data.length;
    if (data.length < batchSize) break;
  }

  totalDials = dialedPhones.size;

  console.log(`\n✅ CORRECT Dial Count (agent_dial_metrics, event_type='dial'):`);
  console.log(`   Total DISTINCT phones dialed: ${totalDials}`);
  console.log(`   Total dial events: ${offset}`);

  // Also check by agent
  console.log('\n📊 Dials by agent (top 10):');
  const { data: agentDials } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('agent_email, lead_phone')
    .eq('event_type', 'dial')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .not('lead_phone', 'is', null)
    .neq('lead_phone', '')
    .not('agent_email', 'is', null)
    .neq('agent_email', '');

  const agentMap = new Map<string, Set<string>>();
  (agentDials || []).forEach(row => {
    const email = (row.agent_email || '').toLowerCase().trim();
    const phone = String(row.lead_phone || '').trim().replace(/\D/g, '').slice(-10);
    if (email && phone && phone.length >= 10) {
      if (!agentMap.has(email)) {
        agentMap.set(email, new Set());
      }
      agentMap.get(email)!.add(phone);
    }
  });

  const agentStats = Array.from(agentMap.entries())
    .map(([email, phones]) => ({ email, count: phones.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  agentStats.forEach(({ email, count }) => {
    console.log(`   ${email}: ${count}`);
  });
}

checkTodayDials().catch(console.error);
