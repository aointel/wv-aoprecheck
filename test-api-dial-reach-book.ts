/**
 * Test the /api/outbound-dialer/daily-stats endpoint
 * Replicates exact API call to see what data exists
 */

import { supabaseAdmin } from './server/supabase';
import { getDateRangeForTimePeriod } from './server/scripts/calculate-dial-reach-booked-realtime';

async function testAPIEndpoint() {
  console.log('🧪 Testing /api/outbound-dialer/daily-stats endpoint logic...\n');
  
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  // Test with a real agent email - check what agents have calls today
  const { start: dateStart, end: dateEnd } = getDateRangeForTimePeriod('realtime');
  console.log(`📅 Date range (EST): ${dateStart.toISOString()} to ${dateEnd.toISOString()}\n`);

  // 1. Check twilio_call_logs for today
  console.log('📞 Checking twilio_call_logs for today...');
  const { data: twilioCalls, error: twilioError } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('owner_email, to_number, call_duration, call_status, call_started_at')
    .eq('call_direction', 'outbound')
    .gte('call_started_at', dateStart.toISOString())
    .lt('call_started_at', dateEnd.toISOString())
    .not('to_number', 'is', null)
    .neq('to_number', '')
    .limit(100);

  if (twilioError) {
    console.error('❌ Error fetching twilio_call_logs:', twilioError);
  } else {
    console.log(`✅ Found ${twilioCalls?.length || 0} calls in twilio_call_logs today`);
    
    if (twilioCalls && twilioCalls.length > 0) {
      // Group by agent
      const byAgent = new Map<string, number>();
      twilioCalls.forEach(call => {
        const email = call.owner_email || 'unknown';
        byAgent.set(email, (byAgent.get(email) || 0) + 1);
      });
      
      console.log(`\n📊 Calls by agent:`);
      Array.from(byAgent.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([email, count]) => {
          console.log(`   ${email}: ${count} calls`);
        });
      
      // Test with first agent
      const testAgent = Array.from(byAgent.keys())[0];
      if (testAgent && testAgent !== 'unknown') {
        console.log(`\n🔍 Testing stats calculation for: ${testAgent}`);
        await testAgentStats(testAgent, dateStart, dateEnd);
      }
    } else {
      console.log('⚠️ NO CALLS FOUND in twilio_call_logs for today!');
    }
  }

  // 2. Check agent_dial_metrics for today
  console.log(`\n📊 Checking agent_dial_metrics for today...`);
  const { data: metrics, error: metricsError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('agent_email, event_type, lead_phone, event_timestamp')
    .gte('event_timestamp', dateStart.toISOString())
    .lt('event_timestamp', dateEnd.toISOString())
    .limit(100);

  if (metricsError) {
    console.error('❌ Error fetching agent_dial_metrics:', metricsError);
  } else {
    console.log(`✅ Found ${metrics?.length || 0} events in agent_dial_metrics today`);
    
    if (metrics && metrics.length > 0) {
      const byType = new Map<string, number>();
      metrics.forEach(m => {
        const type = m.event_type || 'unknown';
        byType.set(type, (byType.get(type) || 0) + 1);
      });
      
      console.log(`\n📊 Events by type:`);
      Array.from(byType.entries()).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} events`);
      });
      
      const byAgent = new Map<string, number>();
      metrics.forEach(m => {
        const email = m.agent_email || 'unknown';
        byAgent.set(email, (byAgent.get(email) || 0) + 1);
      });
      
      console.log(`\n📊 Events by agent:`);
      Array.from(byAgent.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([email, count]) => {
          console.log(`   ${email}: ${count} events`);
        });
    } else {
      console.log('⚠️ NO EVENTS FOUND in agent_dial_metrics for today!');
      console.log('\n❌ THIS IS THE PROBLEM: Calls exist in twilio_call_logs but NOT in agent_dial_metrics!');
      console.log('   This means logCallOutcome() is not being called or is failing silently.');
    }
  }
}

async function testAgentStats(agentEmail: string, dateStart: Date, dateEnd: Date) {
  console.log(`\n📊 Calculating stats for ${agentEmail}...`);
  
  // 1. Count dialed from twilio_call_logs
  const { data: twilioCallsData } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('to_number, call_duration, call_status')
    .eq('owner_email', agentEmail)
    .eq('call_direction', 'outbound')
    .gte('call_started_at', dateStart.toISOString())
    .lt('call_started_at', dateEnd.toISOString())
    .not('to_number', 'is', null)
    .neq('to_number', '');

  const dialedPhones = new Set<string>();
  (twilioCallsData || []).forEach((row: any) => {
    if (row.to_number) {
      const phone = String(row.to_number).trim();
      const status = String(row.call_status || '').toLowerCase();
      const duration = Number(row.call_duration) || 0;
      const isAnswered = status === 'answered' || status === 'completed';
      const isExcluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !isAnswered;
      const shouldCountAsDial = (duration >= 1) || isAnswered;
      
      if (!isExcluded && shouldCountAsDial) {
        dialedPhones.add(phone);
      }
    }
  });
  
  const dialed = dialedPhones.size;
  console.log(`   ✅ Dialed: ${dialed} (from twilio_call_logs)`);

  // 2. Count reached/booked from agent_dial_metrics
  const { data: dialMetricsData } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('event_type, lead_phone')
    .eq('agent_email', agentEmail)
    .in('event_type', ['reach', 'booked'])
    .gte('event_timestamp', dateStart.toISOString())
    .lt('event_timestamp', dateEnd.toISOString())
    .not('lead_phone', 'is', null)
    .neq('lead_phone', '');

  const reachedPhones = new Set<string>();
  const bookedPhones = new Set<string>();
  
  (dialMetricsData || []).forEach((row: any) => {
    if (row.lead_phone) {
      const phone = String(row.lead_phone).trim();
      const eventType = String(row.event_type || '').toLowerCase();
      
      if (eventType === 'reach') {
        reachedPhones.add(phone);
      } else if (eventType === 'booked') {
        bookedPhones.add(phone);
      }
    }
  });
  
  const reached = reachedPhones.size;
  const booked = bookedPhones.size;
  console.log(`   ✅ Reached: ${reached} (from agent_dial_metrics)`);
  console.log(`   ✅ Booked: ${booked} (from agent_dial_metrics)`);
  
  console.log(`\n📊 FINAL STATS for ${agentEmail}:`);
  console.log(`   Dialed: ${dialed}`);
  console.log(`   Reached: ${reached}`);
  console.log(`   Booked: ${booked}`);
}

testAPIEndpoint()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
