/**
 * Update live_call_boardt stats from source tables
 * Pure Node.js solution - no SQL triggers needed
 */

import { supabaseAdmin } from './supabase';

export async function updateLeaderboardStatsForAgent(agentEmail: string): Promise<void> {
  if (!agentEmail || !agentEmail.trim()) {
    return;
  }

  try {
    // Get today's date range in EST timezone
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

    const email = agentEmail.toLowerCase().trim();

    // 1. Count DIALED from twilio_call_logs
    const { data: twilioCalls } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('to_number, call_duration, call_status')
      .eq('owner_email', email)
      .gte('call_started_at', todayStart)
      .lt('call_started_at', todayEnd)
      .eq('call_direction', 'outbound')
      .not('to_number', 'is', null)
      .neq('to_number', '');

    const dialedPhones = new Set<string>();
    if (twilioCalls) {
      for (const call of twilioCalls) {
        const status = (call.call_status || '').toLowerCase();
        const duration = call.call_duration || 0;
        const isAnswered = status === 'answered' || status === 'completed';
        const isExcluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !isAnswered;
        const shouldCountAsDial = (duration >= 1) || isAnswered;
        
        if (!isExcluded && shouldCountAsDial) {
          const phone = call.to_number?.replace(/\D/g, '');
          if (phone) {
            dialedPhones.add(phone);
          }
        }
      }
    }
    const dialed = dialedPhones.size;

    // 2. Count REACHED from agent_dial_metrics
    const { data: reachEvents } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('lead_phone, call_duration')
      .eq('agent_email', email)
      .eq('event_type', 'reach')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('lead_phone', 'is', null);

    const reachedPhones = new Set<string>();
    if (reachEvents) {
      for (const event of reachEvents) {
        if (event.call_duration && event.call_duration > 0) {
          const phone = event.lead_phone?.replace(/\D/g, '');
          if (phone) {
            reachedPhones.add(phone);
          }
        }
      }
    }
    const reached = reachedPhones.size;

    // 3. Count BOOKED from agent_dial_metrics
    const { data: bookedEvents } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('lead_phone, call_duration')
      .eq('agent_email', email)
      .eq('event_type', 'booked')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('lead_phone', 'is', null);

    const bookedPhones = new Set<string>();
    if (bookedEvents) {
      for (const event of bookedEvents) {
        if (event.call_duration && event.call_duration > 0) {
          const phone = event.lead_phone?.replace(/\D/g, '');
          if (phone) {
            bookedPhones.add(phone);
          }
        }
      }
    }
    const booked = bookedPhones.size;

    // 4. Count INSTANT_PRESENTATION from agent_dial_metrics
    const { data: instantPresEvents } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('lead_phone, call_duration')
      .eq('agent_email', email)
      .eq('event_type', 'instant_presentation')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('lead_phone', 'is', null);

    const instantPresPhones = new Set<string>();
    if (instantPresEvents) {
      for (const event of instantPresEvents) {
        if (event.call_duration && event.call_duration > 0) {
          const phone = event.lead_phone?.replace(/\D/g, '');
          if (phone) {
            instantPresPhones.add(phone);
          }
        }
      }
    }
    const instantPres = instantPresPhones.size;

    // REMOVED: live_call_boardt doesn't exist - stats are calculated in real-time from agent_dial_metrics
    // No need to update anything - stats are calculated on-demand

  } catch (error) {
    console.error(`❌ Error updating leaderboard stats for ${agentEmail}:`, error);
    // Don't throw - we don't want to break call logging if stats update fails
  }
}

/**
 * Update stats for all agents (run periodically)
 */
export async function updateAllLeaderboardStats(): Promise<void> {
  try {
    console.log('🔄 Updating all leaderboard stats...');

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

    // Get all unique agent emails from today's activity
    const { data: twilioAgents } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email')
      .gte('call_started_at', todayStart)
      .lt('call_started_at', todayEnd)
      .not('owner_email', 'is', null)
      .neq('owner_email', '');

    const { data: metricsAgents } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('agent_email', 'is', null)
      .neq('agent_email', '');

    const allAgents = new Set<string>();
    (twilioAgents || []).forEach(row => {
      if (row.owner_email) allAgents.add(row.owner_email.toLowerCase().trim());
    });
    (metricsAgents || []).forEach(row => {
      if (row.agent_email) allAgents.add(row.agent_email.toLowerCase().trim());
    });

    console.log(`📊 Updating stats for ${allAgents.size} agents...`);

    // Update each agent
    for (const email of allAgents) {
      await updateLeaderboardStatsForAgent(email);
    }

    console.log('✅ Leaderboard stats updated');

  } catch (error) {
    console.error('❌ Error updating all leaderboard stats:', error);
  }
}
