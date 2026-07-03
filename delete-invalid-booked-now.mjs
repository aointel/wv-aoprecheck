/**
 * Delete invalid booked events immediately
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

async function deleteInvalidBooked() {
  console.log('🔍 Finding and deleting ALL invalid booked events...\n');
  
  // Fetch ALL records with disposition='booked'
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
  
  // Find invalid ones (no call_sid OR null/insufficient duration)
  const invalid = allBookedEvents.filter(e => {
    const hasCallSid = e.call_sid && e.call_sid.trim() !== '';
    const hasValidDuration = e.call_duration !== null && e.call_duration !== undefined && e.call_duration > 120;
    return !hasCallSid || !hasValidDuration;
  });
  
  console.log(`❌ Found ${invalid.length} invalid booked events to delete\n`);
  
  if (invalid.length > 0) {
    const idsToDelete = invalid.map(e => e.id);
    console.log(`🗑️  Deleting ${idsToDelete.length} invalid booked events...`);
    
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
    
    console.log(`\n✅ Deleted ${idsToDelete.length} invalid booked events`);
    
    // Recalculate stats
    console.log('\n🔄 Recalculating stats...');
    await supabase.rpc('backfill_live_call_boardt_stats_corrected');
    console.log('✅ Stats recalculated');
  } else {
    console.log('✅ No invalid booked events found!');
  }
}

deleteInvalidBooked().catch(console.error);
