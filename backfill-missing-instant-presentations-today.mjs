/**
 * BACKFILL MISSING INSTANT PRESENTATIONS FOR TODAY
 * 
 * This script:
 * 1. Finds calls in twilio_call_logs today with duration > 900s (15 minutes)
 * 2. Checks if there's a corresponding instant_presentation event in agent_dial_metrics
 * 3. Creates missing instant_presentation events
 * 4. Ensures they're properly tracked in both booked and instant_presentation columns
 */

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple .env paths
const envPaths = [
  join(__dirname, '.env'),
  join(__dirname, '..', '.env'),
  join(__dirname, '..', '..', '.env')
];

for (const envPath of envPaths) {
  try {
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath });
      break;
    }
  } catch (e) {
    // Continue to next path
  }
}

let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Fallback to hardcoded values if still not found
if (!supabaseUrl || !supabaseServiceKey) {
  supabaseUrl = 'https://ycztjetxwpfgtrzeytt.supabase.co';
  supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';
  console.log('⚠️ Using fallback Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillMissingInstantPresentations() {
  console.log('🔍 Finding and backfilling missing instant presentations...\n');

  // Get today's date range in EST
  const now = new Date();
  const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayStart = new Date(estNow);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Convert to UTC for database query
  const utcOffset = now.getTime() - estNow.getTime();
  const todayStartUTC = new Date(todayStart.getTime() - utcOffset);
  const todayEndUTC = new Date(todayEnd.getTime() - utcOffset);

  console.log(`📅 Today's range (EST): ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);
  console.log(`📅 Today's range (UTC): ${todayStartUTC.toISOString()} to ${todayEndUTC.toISOString()}\n`);

  // Step 1: Find all calls today with duration > 900s (15 minutes)
  console.log('🔍 Step 1: Finding calls > 15 minutes in twilio_call_logs...');
  const { data: longCalls, error: callsError } = await supabase
    .from('twilio_call_logs')
    .select('twilio_call_sid, owner_email, to_number, call_duration, call_status, call_started_at, call_ended_at, call_direction')
    .gte('call_started_at', todayStartUTC.toISOString())
    .lt('call_started_at', todayEndUTC.toISOString())
    .not('owner_email', 'is', null)
    .neq('owner_email', '')
    .eq('call_direction', 'outbound')
    .not('call_duration', 'is', null)
    .gt('call_duration', 900)  // Over 15 minutes
    .not('to_number', 'is', null)
    .neq('to_number', '')
    .in('call_status', ['answered', 'completed', 'in-progress'])
    .order('call_duration', { ascending: false });

  if (callsError) {
    console.error('❌ Error fetching long calls:', callsError);
    return;
  }

  console.log(`✅ Found ${longCalls?.length || 0} calls > 15 minutes today\n`);

  if (!longCalls || longCalls.length === 0) {
    console.log('✅ No calls > 15 minutes found - nothing to backfill');
    return;
  }

  // Step 2: Check which ones are missing instant_presentation events
  console.log('🔍 Step 2: Checking for existing instant_presentation events...');
  
  const missingEvents = [];
  const existingEvents = [];

  for (const call of longCalls) {
    // Normalize phone number (remove non-digits)
    const normalizedPhone = call.to_number.replace(/\D/g, '');
    
    // Check for existing instant_presentation event
    const { data: existingEvent, error: checkError } = await supabase
      .from('agent_dial_metrics')
      .select('id, event_type, disposition, event_timestamp, call_sid, call_duration')
      .eq('agent_email', call.owner_email)
      .eq('lead_phone', normalizedPhone)
      .eq('call_sid', call.twilio_call_sid)
      .gte('event_timestamp', todayStartUTC.toISOString())
      .lt('event_timestamp', todayEndUTC.toISOString())
      .or('event_type.eq.instant_presentation,disposition.eq.instant_presentation')
      .maybeSingle();

    if (checkError) {
      console.error(`❌ Error checking events for call ${call.twilio_call_sid}:`, checkError);
      continue;
    }

    if (existingEvent) {
      existingEvents.push({ call, event: existingEvent });
    } else {
      missingEvents.push({ call });
    }
  }

  console.log(`✅ Found ${existingEvents.length} calls with instant_presentation events`);
  console.log(`❌ Found ${missingEvents.length} calls MISSING instant_presentation events\n`);

  if (missingEvents.length === 0) {
    console.log('✅ All calls > 15 minutes have instant_presentation events!');
    return;
  }

  // Step 3: Display what will be created
  console.log('📋 CALLS THAT WILL GET INSTANT_PRESENTATION EVENTS:\n');
  console.log('='.repeat(100));
  
  for (const { call } of missingEvents) {
    const normalizedPhone = call.to_number.replace(/\D/g, '');
    console.log(`\n📞 Call ${call.twilio_call_sid}`);
    console.log(`   Agent: ${call.owner_email}`);
    console.log(`   Phone: ${call.to_number} (normalized: ${normalizedPhone})`);
    console.log(`   Duration: ${call.call_duration}s (${Math.round(call.call_duration / 60)} minutes)`);
    console.log(`   Status: ${call.call_status}`);
    console.log(`   Started: ${call.call_started_at}`);
  }
  
  console.log('\n' + '='.repeat(100));

  // Step 4: Create missing instant_presentation events
  console.log(`\n🔧 Step 3: Creating ${missingEvents.length} missing instant_presentation events...\n`);
  
  let created = 0;
  let errors = 0;

  for (const { call } of missingEvents) {
    const normalizedPhone = call.to_number.replace(/\D/g, '');
    
    // Check if there's already a booked event for this call (we don't want duplicates)
    const { data: bookedEvent } = await supabase
      .from('agent_dial_metrics')
      .select('id, event_type, disposition')
      .eq('agent_email', call.owner_email)
      .eq('lead_phone', normalizedPhone)
      .eq('call_sid', call.twilio_call_sid)
      .gte('event_timestamp', todayStartUTC.toISOString())
      .lt('event_timestamp', todayEndUTC.toISOString())
      .or('event_type.eq.booked,disposition.eq.booked')
      .maybeSingle();

    if (bookedEvent) {
      console.log(`⚠️  Skipping ${call.twilio_call_sid} - already has booked event (will be counted in booked total)`);
      continue;
    }

    // Create instant_presentation event
    const { data: newEvent, error: insertError } = await supabase
      .from('agent_dial_metrics')
      .insert({
        agent_email: call.owner_email,
        lead_phone: normalizedPhone,
        call_sid: call.twilio_call_sid,
        call_duration: call.call_duration,
        call_status: call.call_status,
        event_type: 'instant_presentation',
        disposition: 'instant_presentation',
        event_timestamp: call.call_started_at || new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error(`❌ Error creating instant_presentation for ${call.twilio_call_sid}:`, insertError);
      errors++;
    } else {
      console.log(`✅ Created instant_presentation event for ${call.twilio_call_sid} (${call.owner_email}, ${normalizedPhone})`);
      created++;
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total calls > 15min: ${longCalls.length}`);
  console.log(`   Already had instant_presentation: ${existingEvents.length}`);
  console.log(`   Missing instant_presentation: ${missingEvents.length}`);
  console.log(`   Created: ${created}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Skipped (had booked): ${missingEvents.length - created - errors}`);

  if (created > 0) {
    console.log(`\n✅ Created ${created} instant_presentation events!`);
    console.log(`   These will now be counted in both 'booked' and 'instant_presentation' columns`);
    console.log(`   Run the live call board update function to see the changes`);
  }

  return { created, errors, total: missingEvents.length };
}

// Run the script
backfillMissingInstantPresentations()
  .then((result) => {
    if (result && result.created > 0) {
      console.log(`\n✅ Successfully backfilled ${result.created} instant_presentation events`);
      process.exit(0);
    } else if (result && result.errors > 0) {
      console.log(`\n⚠️  Completed with ${result.errors} errors`);
      process.exit(1);
    } else {
      console.log('\n✅ No missing events to backfill');
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
