/**
 * Fix invalid DNC events in agent_dial_metrics
 * This script batches through all DNC events and removes/fixes invalid ones
 * 
 * Requirements for valid DNC events:
 * - Must have call_sid (to verify against twilio_call_logs)
 * - Must have duration > 60 seconds (from twilio_call_logs or agent_dial_metrics)
 * - Must have call_status = 'answered' or 'completed' (from twilio_call_logs)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  const hardcodedConfigPath = join(__dirname, 'server', 'hardcoded-config.ts');
  try {
    const configContent = readFileSync(hardcodedConfigPath, 'utf-8');
    const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
    if (urlMatch && !supabaseUrl) supabaseUrl = urlMatch[1];
    const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
    if (keyMatch && !supabaseServiceKey) supabaseServiceKey = keyMatch[1];
  } catch (error) {}
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixInvalidDncEvents() {
  console.log('🔍 Starting fix for invalid DNC events...\n');
  
  // Use a wide date range
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  
  const start = yesterday.toISOString();
  const end = tomorrow.toISOString();
  
  console.log(`📅 Date range: ${start} to ${end}\n`);
  
  // Step 1: Fetch all DNC events (with pagination)
  console.log('📊 Fetching all DNC events...');
  
  let allDncEvents = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: pageData, error: fetchError } = await supabase
      .from('agent_dial_metrics')
      .select('*')
      .in('disposition', ['dnc', 'do_not_call', 'do-not-call', 'do not call'])
      .gte('event_timestamp', start)
      .lt('event_timestamp', end)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (fetchError) {
      console.error('❌ Error fetching DNC events:', fetchError);
      return;
    }
    
    if (pageData && pageData.length > 0) {
      allDncEvents = allDncEvents.concat(pageData);
      page++;
      hasMore = pageData.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`✅ Found ${allDncEvents.length} DNC events\n`);
  
  // Step 2: Categorize events
  const toDelete = [];
  const toUpdate = [];
  const valid = [];
  
  console.log('🔍 Analyzing events...');
  
  for (const event of allDncEvents) {
    const hasCallSid = event.call_sid && event.call_sid.trim() !== '';
    const hasDuration = event.call_duration !== null && event.call_duration > 60;
    
    // Check if there's valid duration and status in twilio_call_logs
    let twilioDuration = null;
    let twilioStatus = null;
    if (hasCallSid) {
      const { data: twilioCall } = await supabase
        .from('twilio_call_logs')
        .select('call_duration, call_status')
        .eq('twilio_call_sid', event.call_sid)
        .maybeSingle();
      
      if (twilioCall) {
        twilioDuration = twilioCall.call_duration;
        twilioStatus = twilioCall.call_status?.toLowerCase();
      }
    }
    
    const effectiveDuration = twilioDuration || event.call_duration || 0;
    const effectiveStatus = twilioStatus || event.call_status?.toLowerCase() || '';
    
    // Validate: must have call_sid, NON-NULL duration, duration > 60s, and status = 'answered'/'completed'
    const isValidStatus = effectiveStatus === 'answered' || effectiveStatus === 'completed';
    const hasValidDuration = effectiveDuration !== null && effectiveDuration !== undefined && effectiveDuration > 60;
    
    // Categorize
    if (!hasCallSid) {
      // No call_sid = definitely invalid, delete
      toDelete.push(event);
    } else if (effectiveDuration === null || effectiveDuration === undefined) {
      // Duration is NULL = definitely invalid, delete
      toDelete.push(event);
    } else if (!hasValidDuration) {
      // Duration is <= 60 = delete
      toDelete.push(event);
    } else if (!isValidStatus) {
      // Status is not 'answered' or 'completed' = delete
      toDelete.push(event);
    } else if (event.call_duration !== twilioDuration && twilioDuration) {
      // Has valid duration in twilio but not in metrics = update
      toUpdate.push({ event, newDuration: twilioDuration });
    } else if (event.call_status !== twilioStatus && twilioStatus) {
      // Has valid status in twilio but not in metrics = update
      toUpdate.push({ event, newStatus: twilioStatus });
    } else {
      // Valid event
      valid.push(event);
    }
  }
  
  console.log(`\n📊 Analysis complete:`);
  console.log(`   ✅ Valid: ${valid.length}`);
  console.log(`   🔧 To Update: ${toUpdate.length}`);
  console.log(`   ❌ To Delete: ${toDelete.length}\n`);
  
  // Step 3: Delete invalid events
  if (toDelete.length > 0) {
    console.log(`🗑️  Deleting ${toDelete.length} invalid DNC events...`);
    const idsToDelete = toDelete.map(e => e.id);
    
    // Delete in batches of 100
    for (let i = 0; i < idsToDelete.length; i += 100) {
      const batch = idsToDelete.slice(i, i + 100);
      const { error: deleteError } = await supabase
        .from('agent_dial_metrics')
        .delete()
        .in('id', batch);
      
      if (deleteError) {
        console.error(`❌ Error deleting batch ${Math.floor(i / 100) + 1}:`, deleteError);
      } else {
        console.log(`   ✅ Deleted batch ${Math.floor(i / 100) + 1} (${batch.length} records)`);
      }
    }
    console.log(`✅ Deleted ${toDelete.length} invalid events\n`);
  }
  
  // Step 4: Update events with valid duration/status from twilio
  if (toUpdate.length > 0) {
    console.log(`🔧 Updating ${toUpdate.length} events with valid data from twilio_call_logs...`);
    
    for (const { event, newDuration, newStatus } of toUpdate) {
      const updateData = {};
      if (newDuration) updateData.call_duration = newDuration;
      if (newStatus) updateData.call_status = newStatus;
      
      const { error: updateError } = await supabase
        .from('agent_dial_metrics')
        .update(updateData)
        .eq('id', event.id);
      
      if (updateError) {
        console.error(`❌ Error updating event ${event.id}:`, updateError);
      }
    }
    console.log(`✅ Updated ${toUpdate.length} events\n`);
  }
  
  // Step 5: Recalculate stats
  console.log('🔄 Recalculating stats for all agents...');
  const { error: rpcError } = await supabase.rpc('backfill_live_call_boardt_stats_corrected');
  
  if (rpcError) {
    console.error('❌ Error recalculating stats:', rpcError);
  } else {
    console.log('✅ Stats recalculated\n');
  }
  
  // Step 6: Show summary
  console.log('📊 Final Summary:');
  console.log(`   ✅ Valid DNC events remaining: ${valid.length}`);
  console.log(`   🔧 Events updated: ${toUpdate.length}`);
  console.log(`   ❌ Events deleted: ${toDelete.length}`);
  console.log(`\n✅ Fix complete!`);
}

fixInvalidDncEvents()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
