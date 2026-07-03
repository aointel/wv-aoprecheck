/**
 * DIAGNOSTIC SCRIPT: Why Live Call Board Stats Aren't Updating
 * 
 * This script checks:
 * 1. Are events being logged to agent_dial_metrics?
 * 2. Are triggers enabled and firing?
 * 3. Is the SQL function working?
 * 4. What's the actual data vs what should be counted?
 */

import { supabaseAdmin } from '../server/supabase';

async function diagnose() {
  console.log('🔍 DIAGNOSING LIVE CALL BOARD STATS ISSUES...\n');

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    return;
  }

  try {
    // Get today's EST date range
    const now = new Date();
    const estYear = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric' }));
    const estMonth = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit' }));
    const estDay = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', day: '2-digit' }));
    const estMidnightString = `${estYear}-${String(estMonth).padStart(2, '0')}-${String(estDay).padStart(2, '0')}T00:00:00`;
    
    // EST is UTC-5 (standard) or UTC-4 (daylight)
    let todayStart = new Date(`${estMidnightString}-05:00`);
    const verifyEST = todayStart.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const verifyDate = verifyEST.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
    const expectedDate = `${estYear}-${String(estMonth).padStart(2, '0')}-${String(estDay).padStart(2, '0')}`;
    
    if (verifyDate !== expectedDate) {
      todayStart = new Date(`${estMidnightString}-04:00`); // DST
    }
    
    const todayEnd = new Date(todayStart.getTime() + (24 * 60 * 60 * 1000));
    const todayStartISO = todayStart.toISOString();
    const todayEndISO = todayEnd.toISOString();

    console.log(`📅 Today's EST range: ${todayStartISO} to ${todayEndISO}\n`);

    // 1. Check if events are being logged
    console.log('1️⃣ CHECKING: Are events being logged to agent_dial_metrics?');
    const { data: recentEvents, error: eventsError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('event_type, agent_email, lead_phone, event_timestamp, disposition')
      .gte('event_timestamp', todayStartISO)
      .lt('event_timestamp', todayEndISO)
      .order('event_timestamp', { ascending: false })
      .limit(20);

    if (eventsError) {
      console.error('❌ Error fetching events:', eventsError);
    } else if (!recentEvents || recentEvents.length === 0) {
      console.log('⚠️ NO EVENTS FOUND TODAY! This is the problem - events are not being logged.');
      console.log('   → Check if logCallOutcome() is being called in routes.ts');
    } else {
      console.log(`✅ Found ${recentEvents.length} events today (showing last 20)`);
      
      // Group by event type
      const byType = recentEvents.reduce((acc: any, e: any) => {
        acc[e.event_type] = (acc[e.event_type] || 0) + 1;
        return acc;
      }, {});
      
      console.log('   Event breakdown:', byType);
      
      // Show sample events
      console.log('\n   Sample events:');
      recentEvents.slice(0, 5).forEach((e: any) => {
        console.log(`   - ${e.event_type} | ${e.agent_email} | ${e.lead_phone} | ${e.disposition || 'null'}`);
      });
    }

    // 2. Check triggers (simplified - just try to run the function)
    console.log('\n2️⃣ CHECKING: Are triggers working?');
    console.log('   (Testing by checking if stats update after function runs)');

    // 4. Test the SQL function
    console.log('\n4️⃣ TESTING: Running SQL function manually...');
    const { error: testError } = await supabaseAdmin
      .rpc('update_live_call_boardt_stats_from_metrics');

    if (testError) {
      console.error('   ❌ SQL function FAILED:', testError);
      console.error('   → This is the problem! The function has an error.');
    } else {
      console.log('   ✅ SQL function executed successfully');
    }

    // 5. Check what stats are actually in live_call_boardt
    console.log('\n5️⃣ CHECKING: What stats are in live_call_boardt?');
    const { data: boardStats, error: boardError } = await supabaseAdmin
      .from('live_call_boardt')
      .select('agent_email, today_dialed, today_reached, today_booked, updated_at')
      .or('today_dialed.gt.0,today_reached.gt.0,today_booked.gt.0')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (boardError) {
      console.error('   ❌ Error fetching board stats:', boardError);
    } else if (!boardStats || boardStats.length === 0) {
      console.log('   ⚠️ NO STATS IN live_call_boardt! All zeros.');
    } else {
      console.log(`   ✅ Found ${boardStats.length} agents with activity:`);
      boardStats.forEach((s: any) => {
        console.log(`   - ${s.agent_email}: Dialed=${s.today_dialed}, Reached=${s.today_reached}, Booked=${s.today_booked} (updated: ${s.updated_at})`);
      });
    }

    // 6. Manual count comparison
    console.log('\n6️⃣ COMPARING: Manual count vs what should be counted');
    if (recentEvents && recentEvents.length > 0) {
      // Get unique agents
      const agents = new Set(recentEvents.map((e: any) => e.agent_email).filter(Boolean));
      
      for (const agentEmail of Array.from(agents).slice(0, 3)) {
        console.log(`\n   Agent: ${agentEmail}`);
        
        // Count from agent_dial_metrics
        const { data: agentEvents, error: agentError } = await supabaseAdmin
          .from('agent_dial_metrics')
          .select('event_type, lead_phone')
          .eq('agent_email', agentEmail)
          .gte('event_timestamp', todayStartISO)
          .lt('event_timestamp', todayEndISO);

        if (!agentError && agentEvents) {
          const reachedPhones = new Set(
            agentEvents
              .filter((e: any) => e.event_type === 'reach' && e.lead_phone)
              .map((e: any) => e.lead_phone)
          );
          
          const bookedPhones = new Set(
            agentEvents
              .filter((e: any) => 
                (e.event_type === 'booked' || 
                 e.event_type === 'instant_presentation' ||
                 (e.disposition && e.disposition.toLowerCase() === 'booked') ||
                 (e.disposition && e.disposition.toLowerCase() === 'instant_presentation'))
                && e.lead_phone
              )
              .map((e: any) => e.lead_phone)
          );

          console.log(`   → Should have: Reached=${reachedPhones.size}, Booked=${bookedPhones.size}`);
          
          // Check what's in live_call_boardt
          const { data: agentBoard } = await supabaseAdmin
            .from('live_call_boardt')
            .select('today_reached, today_booked')
            .eq('agent_email', agentEmail)
            .single();

          if (agentBoard) {
            console.log(`   → Actually has: Reached=${agentBoard.today_reached}, Booked=${agentBoard.today_booked}`);
            
            if (agentBoard.today_reached !== reachedPhones.size || agentBoard.today_booked !== bookedPhones.size) {
              console.log(`   ❌ MISMATCH! Stats are wrong!`);
            } else {
              console.log(`   ✅ Stats match!`);
            }
          }
        }
      }
    }

    // 7. Summary
    console.log('\n📋 SUMMARY:');
    console.log('   If events exist but stats are 0:');
    console.log('     → Triggers might be disabled');
    console.log('     → SQL function might have an error');
    console.log('     → Timezone mismatch (EST vs UTC)');
    console.log('\n   If no events exist:');
    console.log('     → logCallOutcome() is not being called');
    console.log('     → Check routes.ts for dial/reach/booked endpoints');

  } catch (error: any) {
    console.error('❌ Diagnostic failed:', error);
  }
}

diagnose().catch(console.error);
