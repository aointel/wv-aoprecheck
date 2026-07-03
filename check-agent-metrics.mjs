/**
 * Check agent_dial_metrics and twilio_call_logs for a specific agent
 */

import { createClient } from '@supabase/supabase-js';

// Hardcoded values from server/hardcoded-config.ts
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const agentEmail = 'stevenpenawhalen@aoglobelife.com';

async function checkAgentMetrics() {
  try {
    console.log(`🔍 Checking metrics for: ${agentEmail}\n`);

    // Get today's date range in EST
    const now = new Date();
    const estYear = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric' }));
    const estMonth = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit' }));
    const estDay = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', day: '2-digit' }));
    const estMidnightString = `${estYear}-${String(estMonth).padStart(2, '0')}-${String(estDay).padStart(2, '0')}T00:00:00`;
    let utcTodayStart = new Date(`${estMidnightString}-05:00`);
    const verifyEST = utcTodayStart.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
    const verifyDate = verifyEST.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
    const expectedDate = `${estYear}-${String(estMonth).padStart(2, '0')}-${String(estDay).padStart(2, '0')}`;
    if (verifyDate !== expectedDate) {
      utcTodayStart = new Date(`${estMidnightString}-04:00`);
    }
    const utcTodayEnd = new Date(utcTodayStart.getTime() + (24 * 60 * 60 * 1000));
    const todayStart = utcTodayStart.toISOString();
    const todayEnd = utcTodayEnd.toISOString();

    console.log(`📅 Today's range: ${todayStart} to ${todayEnd}\n`);

    // Check agent_dial_metrics
    console.log('📊 Checking agent_dial_metrics...');
    const { data: metrics, error: metricsError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('*')
      .eq('agent_email', agentEmail)
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .order('event_timestamp', { ascending: false });

    if (metricsError) {
      console.error('❌ Error fetching metrics:', metricsError);
    } else {
      console.log(`✅ Found ${metrics?.length || 0} records in agent_dial_metrics today\n`);
      
      if (metrics && metrics.length > 0) {
        const byType = {};
        metrics.forEach(m => {
          const type = m.event_type || 'unknown';
          if (!byType[type]) byType[type] = [];
          byType[type].push(m);
        });

        console.log('📋 Events by type:');
        Object.keys(byType).forEach(type => {
          console.log(`   ${type}: ${byType[type].length} events`);
          byType[type].slice(0, 3).forEach(event => {
            console.log(`      - ${event.lead_phone} | duration: ${event.call_duration || 'null'} | disposition: ${event.disposition || 'null'}`);
          });
        });
      }
    }

    // Check twilio_call_logs
    console.log('\n📞 Checking twilio_call_logs...');
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('*')
      .eq('owner_email', agentEmail)
      .gte('call_started_at', todayStart)
      .lt('call_started_at', todayEnd)
      .eq('call_direction', 'outbound')
      .order('call_started_at', { ascending: false });

    if (callsError) {
      console.error('❌ Error fetching calls:', callsError);
    } else {
      console.log(`✅ Found ${calls?.length || 0} outbound calls in twilio_call_logs today\n`);
      
      if (calls && calls.length > 0) {
        const validCalls = calls.filter(c => 
          c.call_duration !== null && 
          c.call_duration >= 15 &&
          c.to_number &&
          !['failed', 'busy', 'no-answer', 'canceled'].includes((c.call_status || '').toLowerCase())
        );
        
        console.log(`   Total calls: ${calls.length}`);
        console.log(`   Valid calls (duration >= 15s, not failed/busy): ${validCalls.length}`);
        
        const distinctPhones = new Set(validCalls.map(c => c.to_number).filter(Boolean));
        console.log(`   Distinct phone numbers: ${distinctPhones.size}`);
        
        calls.slice(0, 5).forEach(call => {
          console.log(`      - ${call.to_number} | duration: ${call.call_duration || 'null'} | status: ${call.call_status || 'null'}`);
        });
      }
    }

    // Check live_call_boardt
    console.log('\n📊 Checking live_call_boardt...');
    const { data: boardStats, error: boardError } = await supabaseAdmin
      .from('live_call_boardt')
      .select('*')
      .eq('agent_email', agentEmail)
      .maybeSingle();

    if (boardError) {
      console.error('❌ Error fetching board stats:', boardError);
    } else if (boardStats) {
      console.log('✅ Live call board stats:');
      console.log(`   Dialed: ${boardStats.today_dialed || 0}`);
      console.log(`   Reached: ${boardStats.today_reached || 0}`);
      console.log(`   Booked: ${boardStats.today_booked || 0}`);
      console.log(`   Instant Pres: ${boardStats.today_instant_presentation || 0}`);
      console.log(`   Updated at: ${boardStats.updated_at || 'null'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run it
checkAgentMetrics();
