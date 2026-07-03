/**
 * FIND MISSING INSTANT PRESENTATIONS
 * 
 * This script:
 * 1. Finds calls in twilio_call_logs today with duration > 900s (15 minutes)
 * 2. Checks if there's a corresponding instant_presentation event in agent_dial_metrics
 * 3. Identifies potential missing instant_presentation events
 * 4. Optionally creates missing events
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

// If not found, try to read from hardcoded-config.ts
if (!supabaseUrl || !supabaseServiceKey) {
  const hardcodedConfigPath = join(__dirname, 'server', 'hardcoded-config.ts');
  try {
    if (existsSync(hardcodedConfigPath)) {
      const configContent = readFileSync(hardcodedConfigPath, 'utf-8');
      const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
      if (urlMatch && !supabaseUrl) supabaseUrl = urlMatch[1];
      const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
      if (keyMatch && !supabaseServiceKey) supabaseServiceKey = keyMatch[1];
    }
  } catch (e) {
    console.warn('⚠️ Could not read hardcoded-config.ts:', e.message);
  }
}

// Fallback to hardcoded values if still not found (from other scripts)
if (!supabaseUrl || !supabaseServiceKey) {
  supabaseUrl = 'https://ycztjetxwpfgtrzeytt.supabase.co';
  supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';
  console.log('⚠️ Using fallback Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findMissingInstantPresentations() {
  console.log('🔍 Finding potential missing instant presentations...\n');

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
    console.log('✅ No calls > 15 minutes found - nothing to check');
    return;
  }

  // Step 2: Check which ones have instant_presentation events in agent_dial_metrics
  console.log('🔍 Step 2: Checking for existing instant_presentation events...');
  
  const missingEvents = [];
  const existingEvents = [];

  for (const call of longCalls) {
    const { data: existingEvents, error: checkError } = await supabase
      .from('agent_dial_metrics')
      .select('id, event_type, disposition, event_timestamp, call_sid, call_duration')
      .eq('agent_email', call.owner_email)
      .eq('lead_phone', call.to_number.replace(/\D/g, ''))
      .eq('call_sid', call.twilio_call_sid)
      .gte('event_timestamp', todayStartUTC.toISOString())
      .lt('event_timestamp', todayEndUTC.toISOString())
      .or('event_type.eq.instant_presentation,disposition.eq.instant_presentation');

    if (checkError) {
      console.error(`❌ Error checking events for call ${call.twilio_call_sid}:`, checkError);
      continue;
    }

    // Also check masterlead for instant_presentation resolution
    const { data: masterlead } = await supabase
      .from('masterlead')
      .select('id, cnresolution, phone, cn_email')
      .eq('phone', call.to_number.replace(/\D/g, ''))
      .eq('cn_email', call.owner_email)
      .eq('cnresolution', 'instant_presentation')
      .maybeSingle();

    if (existingEvents && existingEvents.length > 0) {
      existingEvents.push({
        call,
        event: existingEvents[0],
        masterlead: masterlead || null
      });
    } else {
      missingEvents.push({
        call,
        masterlead: masterlead || null
      });
    }
  }

  console.log(`✅ Found ${existingEvents.length} calls with instant_presentation events`);
  console.log(`❌ Found ${missingEvents.length} calls MISSING instant_presentation events\n`);

  // Step 3: Display missing events
  if (missingEvents.length > 0) {
    console.log('📋 MISSING INSTANT_PRESENTATION EVENTS:\n');
    console.log('='.repeat(100));
    
    for (const { call, masterlead } of missingEvents) {
      console.log(`\n❌ MISSING: Call ${call.twilio_call_sid}`);
      console.log(`   Agent: ${call.owner_email}`);
      console.log(`   Phone: ${call.to_number}`);
      console.log(`   Duration: ${call.call_duration}s (${Math.round(call.call_duration / 60)} minutes)`);
      console.log(`   Status: ${call.call_status}`);
      console.log(`   Started: ${call.call_started_at}`);
      console.log(`   Masterlead resolution: ${masterlead?.cnresolution || 'NOT SET'}`);
      console.log(`   Masterlead ID: ${masterlead?.id || 'N/A'}`);
    }
    
    console.log('\n' + '='.repeat(100));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total calls > 15min: ${longCalls.length}`);
    console.log(`   Has instant_presentation event: ${existingEvents.length}`);
    console.log(`   Missing instant_presentation event: ${missingEvents.length}`);
    console.log(`   Has masterlead resolution: ${missingEvents.filter(m => m.masterlead).length}`);
  } else {
    console.log('✅ All calls > 15 minutes have instant_presentation events!');
  }

  return { missingEvents, existingEvents, totalCalls: longCalls.length };
}

// Run the script
findMissingInstantPresentations()
  .then((result) => {
    if (result && result.missingEvents.length > 0) {
      console.log(`\n⚠️  Found ${result.missingEvents.length} missing instant_presentation events`);
      console.log('   Review the output above and decide if these should be created');
      process.exit(1);
    } else {
      console.log('\n✅ No missing instant_presentation events found');
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
