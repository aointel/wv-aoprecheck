/**
 * Fix reached and booked metrics to reflect proper disposition requirements
 * 
 * Requirements:
 * - "reached": call_status IN ('answered', 'completed') AND call_duration >= 30 seconds
 * - "booked": call_status IN ('answered', 'completed') AND call_duration >= 120 seconds (2 minutes)
 * - "callback": call_status IN ('answered', 'completed') AND call_duration >= 45 seconds
 * 
 * This script:
 * 1. Identifies invalid "reached" metrics (duration < 30s or wrong status)
 * 2. Identifies invalid "booked" metrics (duration < 120s or wrong status)
 * 3. Identifies invalid "callback" metrics (duration < 45s or wrong status)
 * 4. Removes invalid entries from agent_dial_metrics
 * 5. Provides summary of fixes
 */

import { supabaseAdmin } from '../supabase';

const REACHED_MIN_DURATION = 30; // 30 seconds
const BOOKED_MIN_DURATION = 120; // 2 minutes (120 seconds)
const CALLBACK_MIN_DURATION = 45; // 45 seconds

async function fixReachedAndBookedMetrics() {
  console.log('🚀 Starting fix for reached and booked metrics...\n');
  console.log(`📋 Requirements:`);
  console.log(`  - Reached: call_status IN ('answered', 'completed') AND duration >= ${REACHED_MIN_DURATION}s`);
  console.log(`  - Booked: call_status IN ('answered', 'completed') AND duration >= ${BOOKED_MIN_DURATION}s`);
  console.log(`  - Callback: call_status IN ('answered', 'completed') AND duration >= ${CALLBACK_MIN_DURATION}s\n`);

  try {
    // Step 1: Find and remove invalid "reached" metrics
    console.log('📋 Step 1: Finding invalid "reached" metrics...');
    await fixInvalidReachedMetrics();
    
    // Step 2: Find and remove invalid "booked" metrics
    console.log('\n📋 Step 2: Finding invalid "booked" metrics...');
    await fixInvalidBookedMetrics();
    
    // Step 3: Find and remove invalid "callback" dispositions (treated as "booked" events)
    console.log('\n📋 Step 3: Finding invalid "callback" dispositions...');
    await fixInvalidCallbackMetrics();
    
    // Summary
    console.log('\n✅ Fix completed!');
    await printSummary();
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
    throw error;
  }
}

async function fixInvalidReachedMetrics() {
  // Find invalid "reached" metrics:
  // 1. event_type = 'reach' AND (call_duration < 30 OR call_status NOT IN ('answered', 'completed'))
  // 2. Join with twilio_call_logs to get real call duration and status
  const { data: invalidReached, error: fetchError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select(`
      id,
      agent_email,
      lead_phone,
      event_timestamp,
      call_duration,
      call_status,
      call_sid,
      twilio_call_logs!inner (
        call_duration,
        call_status
      )
    `)
    .eq('event_type', 'reach');
  
  if (fetchError) {
    console.error('❌ Error fetching reached metrics:', fetchError);
    return;
  }
  
  // Also get reached metrics without twilio_call_logs (for comparison)
  const { data: allReached, error: allReachedError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('id, agent_email, lead_phone, call_duration, call_status, call_sid')
    .eq('event_type', 'reach');
  
  if (allReachedError) {
    console.error('❌ Error fetching all reached metrics:', allReachedError);
    return;
  }
  
  console.log(`📊 Found ${allReached?.length || 0} total "reached" metrics`);
  
  // Filter invalid reached metrics
  const invalidIds: number[] = [];
  
  for (const reached of allReached || []) {
    // Get real call data from twilio_call_logs if call_sid exists
    let realDuration = reached.call_duration;
    let realStatus = reached.call_status;
    
    if (reached.call_sid) {
      const { data: twilioCall } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('call_duration, call_status')
        .eq('twilio_call_sid', reached.call_sid)
        .maybeSingle();
      
      if (twilioCall) {
        realDuration = twilioCall.call_duration;
        realStatus = twilioCall.call_status;
      }
    }
    
    // Check if invalid
    const effectiveDuration = realDuration || 0;
    const status = (realStatus || '').toLowerCase();
    const isValidStatus = status === 'answered' || status === 'completed';
    
    if (!isValidStatus || effectiveDuration < REACHED_MIN_DURATION) {
      invalidIds.push(reached.id);
    }
  }
  
  console.log(`⚠️ Found ${invalidIds.length} invalid "reached" metrics`);
  
  if (invalidIds.length > 0) {
    // Delete invalid reached metrics
    const { error: deleteError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .delete()
      .in('id', invalidIds);
    
    if (deleteError) {
      console.error('❌ Error deleting invalid reached metrics:', deleteError);
    } else {
      console.log(`✅ Deleted ${invalidIds.length} invalid "reached" metrics`);
    }
  } else {
    console.log('✅ All "reached" metrics are valid');
  }
}

async function fixInvalidBookedMetrics() {
  // Find invalid "booked" metrics:
  // 1. (event_type = 'booked' OR disposition = 'booked') AND (call_duration < 120 OR call_status NOT IN ('answered', 'completed'))
  // 2. Join with twilio_call_logs to get real call duration and status
  const { data: allBooked, error: fetchError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('id, agent_email, lead_phone, call_duration, call_status, call_sid, disposition, event_type')
    .or('event_type.eq.booked,disposition.eq.booked');
  
  if (fetchError) {
    console.error('❌ Error fetching booked metrics:', fetchError);
    return;
  }
  
  console.log(`📊 Found ${allBooked?.length || 0} total "booked" metrics`);
  
  // Filter invalid booked metrics
  const invalidIds: number[] = [];
  
  for (const booked of allBooked || []) {
    // Get real call data from twilio_call_logs if call_sid exists
    let realDuration = booked.call_duration;
    let realStatus = booked.call_status;
    
    if (booked.call_sid) {
      const { data: twilioCall } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('call_duration, call_status')
        .eq('twilio_call_sid', booked.call_sid)
        .maybeSingle();
      
      if (twilioCall) {
        realDuration = twilioCall.call_duration;
        realStatus = twilioCall.call_status;
      }
    }
    
    // Check if invalid
    const effectiveDuration = realDuration || 0;
    const status = (realStatus || '').toLowerCase();
    const isValidStatus = status === 'answered' || status === 'completed';
    
    if (!isValidStatus || effectiveDuration < BOOKED_MIN_DURATION) {
      invalidIds.push(booked.id);
      console.log(`  ⚠️ Invalid booked: ${booked.agent_email} -> ${booked.lead_phone} (duration: ${effectiveDuration}s, status: ${status})`);
    }
  }
  
  console.log(`⚠️ Found ${invalidIds.length} invalid "booked" metrics`);
  
  if (invalidIds.length > 0) {
    // Delete invalid booked metrics
    const { error: deleteError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .delete()
      .in('id', invalidIds);
    
    if (deleteError) {
      console.error('❌ Error deleting invalid booked metrics:', deleteError);
    } else {
      console.log(`✅ Deleted ${invalidIds.length} invalid "booked" metrics`);
    }
  } else {
    console.log('✅ All "booked" metrics are valid');
  }
}

async function fixInvalidCallbackMetrics() {
  // Find invalid "callback" dispositions (disposition = 'callback' or 'call_back')
  // Requirements: call_status IN ('answered', 'completed') AND call_duration >= 45 seconds
  const { data: allCallbacks, error: fetchError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('id, agent_email, lead_phone, call_duration, call_status, call_sid, disposition')
    .or('disposition.eq.callback,disposition.eq.call_back,disposition.eq.callback_scheduled');
  
  if (fetchError) {
    console.error('❌ Error fetching callback metrics:', fetchError);
    return;
  }
  
  console.log(`📊 Found ${allCallbacks?.length || 0} total "callback" dispositions`);
  
  // Filter invalid callback metrics
  const invalidIds: number[] = [];
  
  for (const callback of allCallbacks || []) {
    // Get real call data from twilio_call_logs if call_sid exists
    let realDuration = callback.call_duration;
    let realStatus = callback.call_status;
    
    if (callback.call_sid) {
      const { data: twilioCall } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('call_duration, call_status')
        .eq('twilio_call_sid', callback.call_sid)
        .maybeSingle();
      
      if (twilioCall) {
        realDuration = twilioCall.call_duration;
        realStatus = twilioCall.call_status;
      }
    }
    
    // Check if invalid
    const effectiveDuration = realDuration || 0;
    const status = (realStatus || '').toLowerCase();
    const isValidStatus = status === 'answered' || status === 'completed';
    
    if (!isValidStatus || effectiveDuration < CALLBACK_MIN_DURATION) {
      invalidIds.push(callback.id);
      console.log(`  ⚠️ Invalid callback: ${callback.agent_email} -> ${callback.lead_phone} (duration: ${effectiveDuration}s, status: ${status})`);
    }
  }
  
  console.log(`⚠️ Found ${invalidIds.length} invalid "callback" dispositions`);
  
  if (invalidIds.length > 0) {
    // Delete invalid callback metrics
    const { error: deleteError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .delete()
      .in('id', invalidIds);
    
    if (deleteError) {
      console.error('❌ Error deleting invalid callback metrics:', deleteError);
    } else {
      console.log(`✅ Deleted ${invalidIds.length} invalid "callback" dispositions`);
    }
  } else {
    console.log('✅ All "callback" dispositions are valid');
  }
}

async function printSummary() {
  // Count valid metrics after cleanup
  const { count: totalReached } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reach');
  
  const { count: totalBooked } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .or('event_type.eq.booked,disposition.eq.booked');
  
  const { count: totalCallbacks } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .or('disposition.eq.callback,disposition.eq.call_back,disposition.eq.callback_scheduled');
  
  console.log('\n📊 Summary after cleanup:');
  console.log(`  Total "reached" metrics: ${totalReached || 0}`);
  console.log(`  Total "booked" metrics: ${totalBooked || 0}`);
  console.log(`  Total "callback" dispositions: ${totalCallbacks || 0}`);
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fix-reached-and-booked-metrics.ts');
if (isMainModule) {
  fixReachedAndBookedMetrics()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { fixReachedAndBookedMetrics };
