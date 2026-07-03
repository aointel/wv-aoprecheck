/**
 * Delete invalid not_interested events (and other dispositions) without call_sid or duration
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

// Dispositions that require call validation (must have call_sid and duration >= 30s)
const dispositionsRequiringCall = [
  'booked', 'not_interested', 'sale', 'callback', 'call_back', 'appointment_set', 'appointment',
  'instant_presentation', 'already_been_sold', 'medically_uninsurable', 'duplicate', 'over_age',
  'dnc', 'do_not_call', 'do-not-call', 'do not call'
];

// Exempt dispositions that can legitimately have no duration
const exemptDispositions = ['no_answer', 'no_answer_vm', 'no_answer_voicemail', 'wrong_number', 'wrong number', 'bad_number'];

async function deleteInvalidDispositions() {
  console.log('🔍 Finding and deleting ALL invalid disposition events...\n');
  
  // Fetch ALL records with dispositions that require call validation
  let allEvents = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: pageData, error } = await supabase
      .from('agent_dial_metrics')
      .select('*')
      .in('disposition', dispositionsRequiringCall)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    if (pageData && pageData.length > 0) {
      allEvents = allEvents.concat(pageData);
      page++;
      hasMore = pageData.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`✅ Found ${allEvents.length} total records with dispositions requiring call validation\n`);
  
  // Find invalid ones (no call_sid OR null/insufficient duration)
  const invalid = allEvents.filter(e => {
    const disposition = (e.disposition || '').toLowerCase();
    const isExempt = exemptDispositions.includes(disposition);
    
    // Exempt dispositions are allowed to have no duration
    if (isExempt) {
      return false;
    }
    
    // Booked requires > 120s, others require >= 30s
    const minDuration = disposition === 'booked' ? 120 : 30;
    const hasCallSid = e.call_sid && e.call_sid.trim() !== '';
    const hasValidDuration = e.call_duration !== null && e.call_duration !== undefined && e.call_duration >= minDuration;
    
    return !hasCallSid || !hasValidDuration;
  });
  
  console.log(`❌ Found ${invalid.length} invalid disposition events to delete\n`);
  
  if (invalid.length > 0) {
    console.log('📋 Invalid events:');
    invalid.slice(0, 20).forEach((e, idx) => {
      console.log(`\n${idx + 1}. ID: ${e.id}`);
      console.log(`   Agent: ${e.agent_email}`);
      console.log(`   Disposition: ${e.disposition}`);
      console.log(`   CallSid: ${e.call_sid || 'NULL'}`);
      console.log(`   Duration: ${e.call_duration === null ? 'NULL' : e.call_duration === undefined ? 'UNDEFINED' : e.call_duration}`);
      console.log(`   Call Status: ${e.call_status || 'NULL'}`);
      console.log(`   Timestamp: ${e.event_timestamp}`);
    });
    if (invalid.length > 20) {
      console.log(`\n   ... and ${invalid.length - 20} more`);
    }
    
    const idsToDelete = invalid.map(e => e.id);
    console.log(`\n🗑️  Deleting ${idsToDelete.length} invalid disposition events...`);
    
    // Delete in batches
    for (let i = 0; i < idsToDelete.length; i += 100) {
      const batch = idsToDelete.slice(i, i + 100);
      const { error: deleteError } = await supabase
        .from('agent_dial_metrics')
        .delete()
        .in('id', batch);
      
      if (deleteError) {
        console.error(`❌ Error deleting batch:`, deleteError);
      } else {
        console.log(`   ✅ Deleted batch (${batch.length} records)`);
      }
    }
    
    console.log(`\n✅ Deleted ${idsToDelete.length} invalid disposition events`);
    
    // Recalculate stats
    console.log('\n🔄 Recalculating stats...');
    await supabase.rpc('backfill_live_call_boardt_stats_corrected');
    console.log('✅ Stats recalculated');
  } else {
    console.log('✅ No invalid disposition events found!');
  }
}

deleteInvalidDispositions().catch(console.error);
