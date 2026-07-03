/**
 * Verify that invalid booked events were cleaned up
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

async function verify() {
  console.log('🔍 Verifying booked cleanup...\n');
  
  // Check the specific record the user mentioned
  const { data: specificRecord } = await supabase
    .from('agent_dial_metrics')
    .select('*')
    .eq('id', 347088)
    .single();
  
  if (specificRecord) {
    console.log('❌ RECORD STILL EXISTS:');
    console.log(JSON.stringify(specificRecord, null, 2));
    console.log('\n⚠️  This record should have been deleted!\n');
  } else {
    console.log('✅ Record 347088 has been deleted\n');
  }
  
  // Check for all invalid booked events
  console.log('📊 Checking for remaining invalid booked events...');
  
  let allBookedEvents = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: bookedByType } = await supabase
      .from('agent_dial_metrics')
      .select('*')
      .eq('event_type', 'booked')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    const { data: bookedByDisposition } = await supabase
      .from('agent_dial_metrics')
      .select('*')
      .eq('disposition', 'booked')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
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
  
  const bookedEvents = Array.from(
    new Map(allBookedEvents.map(e => [e.id, e])).values()
  );
  
  console.log(`   Total booked events: ${bookedEvents.length}`);
  
  // Find invalid ones
  const invalid = bookedEvents.filter(e => {
    const hasCallSid = e.call_sid && e.call_sid.trim() !== '';
    const hasDuration = e.call_duration !== null && e.call_duration > 120;
    return !hasCallSid || !hasDuration;
  });
  
  console.log(`   Invalid booked events: ${invalid.length}`);
  
  if (invalid.length > 0) {
    console.log('\n❌ INVALID BOOKED EVENTS FOUND:');
    invalid.slice(0, 10).forEach(e => {
      console.log(`   ID: ${e.id}, Agent: ${e.agent_email}, CallSid: ${e.call_sid || 'NULL'}, Duration: ${e.call_duration || 'NULL'}`);
    });
    if (invalid.length > 10) {
      console.log(`   ... and ${invalid.length - 10} more`);
    }
  } else {
    console.log('\n✅ All booked events are valid!');
  }
}

verify().catch(console.error);
