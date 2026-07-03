/**
 * Fix invalid booked events in agent_dial_metrics
 * This script batches through all booked events and removes/fixes invalid ones
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Try to get Supabase credentials from env or hardcoded-config.ts
let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// If not found, try to read from hardcoded-config.ts
if (!supabaseUrl || !supabaseServiceKey) {
  const hardcodedConfigPath = join(__dirname, 'server', 'hardcoded-config.ts');
  try {
    const configContent = readFileSync(hardcodedConfigPath, 'utf-8');
    
    const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
    if (urlMatch && !supabaseUrl) {
      supabaseUrl = urlMatch[1];
    }
    
    const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
    if (keyMatch && !supabaseServiceKey) {
      supabaseServiceKey = keyMatch[1];
    }
  } catch (error) {
    // Ignore if file doesn't exist
  }
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Tried: VITE_SUPABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY');
  console.error('   Also tried reading from server/hardcoded-config.ts');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get today's date range in EST (converted to UTC for database query)
function getTodayESTRange() {
  // Use the same logic as the SQL functions - get EST date, then convert to UTC
  const now = new Date();
  
  // Get current date in EST timezone
  const estDateStr = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse EST date (MM/DD/YYYY format)
  const [month, day, year] = estDateStr.split('/');
  
  // Create start of day in EST (00:00:00 EST)
  const todayStartEST = new Date(`${year}-${month}-${day}T00:00:00`);
  
  // EST is UTC-5, so add 5 hours to get UTC
  // But we need to use the actual timezone offset, not a fixed 5 hours
  // Better approach: create date string in EST and let JavaScript handle conversion
  const estDate = new Date(`${year}-${month}-${day}T00:00:00-05:00`); // EST offset
  const todayStartUTC = new Date(estDate.toISOString());
  
  // End of day is start of next day
  const todayEndUTC = new Date(todayStartUTC);
  todayEndUTC.setDate(todayEndUTC.getDate() + 1);
  
  return {
    start: todayStartUTC.toISOString(),
    end: todayEndUTC.toISOString()
  };
}

async function fixInvalidBookedEvents() {
  console.log('🔍 Starting fix for invalid booked events...\n');
  
  // Use a wider date range - include previous day at 00:00 UTC to catch early morning events
  // Events are stored in UTC, so we need to account for EST being behind UTC
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  
  const start = yesterday.toISOString();
  const end = tomorrow.toISOString();
  
  console.log(`📅 Date range: ${start} to ${end} (wide range to catch all today's events)\n`);
  
  // Step 1: Fetch ALL booked events (event_type='booked' OR disposition='booked') with pagination
  console.log('📊 Fetching all booked events (no date restriction)...');
  
  let allBookedEvents = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    // Fetch events where event_type='booked'
    const { data: bookedByType, error: error1 } = await supabase
      .from('agent_dial_metrics')
      .select('*')
      .eq('event_type', 'booked')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error1) {
      console.error('❌ Error fetching booked events by type:', error1);
      return;
    }
    
    // Fetch events where disposition='booked' (but event_type might be 'dial')
    const { data: bookedByDisposition, error: error2 } = await supabase
      .from('agent_dial_metrics')
      .select('*')
      .eq('disposition', 'booked')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error2) {
      console.error('❌ Error fetching booked events by disposition:', error2);
      return;
    }
    
    // Combine and deduplicate
    const pageBooked = [...(bookedByType || []), ...(bookedByDisposition || [])];
    const pageDeduplicated = Array.from(
      new Map(pageBooked.map(e => [e.id, e])).values()
    );
    
    if (pageDeduplicated.length > 0) {
      allBookedEvents = allBookedEvents.concat(pageDeduplicated);
      page++;
      hasMore = pageDeduplicated.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  
  // Final deduplication
  const bookedEvents = Array.from(
    new Map(allBookedEvents.map(e => [e.id, e])).values()
  );
  
  console.log(`✅ Found ${bookedEvents.length} total booked events (all time, deduplicated)\n`);
  
  // Step 2: Categorize events
  const toDelete = [];
  const toUpdate = [];
  const valid = [];
  
  console.log('🔍 Analyzing events...');
  
  for (const event of bookedEvents) {
    const hasCallSid = event.call_sid && event.call_sid.trim() !== '';
    const hasDuration = event.call_duration !== null && event.call_duration > 120;
    
    // Check if there's valid duration in twilio_call_logs
    let twilioDuration = null;
    if (hasCallSid) {
      const { data: twilioCall } = await supabase
        .from('twilio_call_logs')
        .select('call_duration')
        .eq('twilio_call_sid', event.call_sid)
        .maybeSingle();
      
      if (twilioCall && twilioCall.call_duration > 120) {
        twilioDuration = twilioCall.call_duration;
      }
    }
    
    const effectiveDuration = twilioDuration || event.call_duration || 0;
    
    // Categorize
    if (!hasCallSid) {
      // No call_sid = definitely invalid, delete
      toDelete.push(event);
    } else if (effectiveDuration <= 120) {
      // Duration is null or <= 120, and no valid duration in twilio = delete
      toDelete.push(event);
    } else if (event.call_duration !== twilioDuration && twilioDuration) {
      // Has valid duration in twilio but not in metrics = update
      toUpdate.push({ event, newDuration: twilioDuration });
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
    console.log(`🗑️  Deleting ${toDelete.length} invalid booked events...`);
    const idsToDelete = toDelete.map(e => e.id);
    
    // Delete in batches of 100
    for (let i = 0; i < idsToDelete.length; i += 100) {
      const batch = idsToDelete.slice(i, i + 100);
      const { error: deleteError } = await supabase
        .from('agent_dial_metrics')
        .delete()
        .in('id', batch);
      
      if (deleteError) {
        console.error(`❌ Error deleting batch ${i / 100 + 1}:`, deleteError);
      } else {
        console.log(`   ✅ Deleted batch ${i / 100 + 1} (${batch.length} records)`);
      }
    }
    console.log(`✅ Deleted ${toDelete.length} invalid events\n`);
  }
  
  // Step 4: Update events with valid duration from twilio
  if (toUpdate.length > 0) {
    console.log(`🔧 Updating ${toUpdate.length} events with valid duration from twilio_call_logs...`);
    
    for (const { event, newDuration } of toUpdate) {
      const { error: updateError } = await supabase
        .from('agent_dial_metrics')
        .update({ call_duration: newDuration })
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
  console.log(`   ✅ Valid booked events remaining: ${valid.length}`);
  console.log(`   🔧 Events updated: ${toUpdate.length}`);
  console.log(`   ❌ Events deleted: ${toDelete.length}`);
  console.log(`\n✅ Fix complete!`);
}

// Run the fix
fixInvalidBookedEvents()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
