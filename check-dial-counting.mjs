/**
 * Check why dials might not be counting correctly
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const agentEmail = 'stevenpenawhalen@aoglobelife.com';

async function checkDialCounting() {
  try {
    console.log(`🔍 Checking dial counting for: ${agentEmail}\n`);

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

    // Check all twilio_call_logs for this agent today
    console.log('📞 All twilio_call_logs today:');
    const { data: allCalls } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('to_number, call_duration, call_status, call_direction, call_started_at')
      .eq('owner_email', agentEmail)
      .gte('call_started_at', todayStart)
      .lt('call_started_at', todayEnd)
      .order('call_started_at', { ascending: false });

    let distinctPhonesCount = 0;
    
    if (allCalls) {
      console.log(`   Total calls: ${allCalls.length}`);
      
      const outboundCalls = allCalls.filter(c => c.call_direction === 'outbound');
      console.log(`   Outbound calls: ${outboundCalls.length}`);
      
      const withDuration = outboundCalls.filter(c => c.call_duration !== null && c.call_duration >= 15);
      console.log(`   With duration >= 15s: ${withDuration.length}`);
      
      const validStatus = withDuration.filter(c => {
        const status = (c.call_status || '').toLowerCase();
        return !['failed', 'busy', 'no-answer', 'canceled'].includes(status);
      });
      console.log(`   With valid status: ${validStatus.length}`);
      
      const distinctPhones = new Set(validStatus
        .filter(c => c.to_number && c.to_number.trim() !== '')
        .map(c => c.to_number));
      distinctPhonesCount = distinctPhones.size;
      console.log(`   Distinct phone numbers (with valid to_number): ${distinctPhonesCount}\n`);
      
      console.log('📋 Valid calls (should be counted as dials):');
      validStatus.forEach(call => {
        const hasValidNumber = call.to_number && call.to_number.trim() !== '';
        console.log(`   - ${call.to_number || '(no number)'} | duration: ${call.call_duration}s | status: ${call.call_status || 'null'} ${hasValidNumber ? '✅' : '❌ (excluded - no number)'}`);
      });
    }

    // Check what the SQL function would count
    console.log('\n🔍 Checking live_call_boardt stats...');
    const { data: boardStats } = await supabaseAdmin
      .from('live_call_boardt')
      .select('*')
      .eq('agent_email', agentEmail)
      .maybeSingle();

    if (boardStats) {
      console.log(`   SQL function result: ${boardStats.today_dialed} dialed`);
      console.log(`   Reached: ${boardStats.today_reached}`);
      console.log(`   Booked: ${boardStats.today_booked}`);
      console.log(`   Updated at: ${boardStats.updated_at}`);
      
      console.log(`\n   Expected dialed (distinct phones): ${distinctPhonesCount}`);
      console.log(`   Actual dialed (from live_call_boardt): ${boardStats.today_dialed}`);
      console.log(`   Match: ${boardStats.today_dialed === distinctPhonesCount ? '✅ YES' : '❌ NO - MISMATCH!'}`);
      
      if (boardStats.today_dialed !== distinctPhonesCount) {
        console.log('\n⚠️ MISMATCH DETECTED!');
        console.log('   The SQL function may not be counting correctly, or stats need to be refreshed.');
        console.log('   Run: node run-fix-and-update-stats.mjs');
      } else {
        console.log('\n✅ Stats are correct!');
        console.log('   If you\'re seeing 0 dials in the UI, it might be:');
        console.log('   1. Frontend cache - refresh the page');
        console.log('   2. Filter applied (MGA/RGA filter might be excluding this agent)');
        console.log('   3. Different timezone calculation');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkDialCounting();
