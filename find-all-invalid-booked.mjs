/**
 * Find ALL invalid booked events - including event_type='dial' with disposition='booked'
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

async function findAllInvalidBooked() {
  console.log('🔍 Finding ALL invalid booked events...\n');
  
  // Fetch ALL records with disposition='booked' (regardless of event_type)
  let allBookedEvents = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: pageData, error } = await supabase
      .from('agent_dial_metrics')
      .select('*')
      .eq('disposition', 'booked')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    if (pageData && pageData.length > 0) {
      allBookedEvents = allBookedEvents.concat(pageData);
      page++;
      hasMore = pageData.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`✅ Found ${allBookedEvents.length} total records with disposition='booked'\n`);
  
  // Find invalid ones
  const invalid = allBookedEvents.filter(e => {
    const hasCallSid = e.call_sid && e.call_sid.trim() !== '';
    const hasDuration = e.call_duration !== null && e.call_duration !== undefined && e.call_duration > 120;
    return !hasCallSid || !hasDuration;
  });
  
  console.log(`❌ INVALID BOOKED EVENTS: ${invalid.length}\n`);
  
  if (invalid.length > 0) {
    console.log('📋 Invalid booked events:');
    invalid.forEach((e, idx) => {
      console.log(`\n${idx + 1}. ID: ${e.id}`);
      console.log(`   Agent: ${e.agent_email}`);
      console.log(`   Event Type: ${e.event_type}`);
      console.log(`   Disposition: ${e.disposition}`);
      console.log(`   CallSid: ${e.call_sid || 'NULL'}`);
      console.log(`   Duration: ${e.call_duration === null ? 'NULL' : e.call_duration === undefined ? 'UNDEFINED' : e.call_duration}`);
      console.log(`   Call Status: ${e.call_status || 'NULL'}`);
      console.log(`   Timestamp: ${e.event_timestamp}`);
    });
  } else {
    console.log('✅ No invalid booked events found!');
  }
}

findAllInvalidBooked().catch(console.error);
