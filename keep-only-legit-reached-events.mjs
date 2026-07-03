/**
 * Keep only the legitimate reached events provided by the user
 * Delete all other reached events
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

// The legitimate reached event IDs from the user
const legitReachedEventIds = [
  335452, 335449, 335291, 335277, 335255, 335239, 335207, 335147, 335087, 335016,
  334675, 334668, 334514, 334439, 334399, 334382, 334372, 334143, 334142, 334141,
  334108, 334017, 334007, 333987, 333976, 333882, 333733, 333720, 333626, 333592,
  333591, 333534, 333528, 333491, 333460, 333443, 333387, 333352, 333339, 333337,
  333332, 333329, 333325, 333319, 333296, 333274, 333241, 333240, 333214, 333078,
  333075, 333046, 333014, 332980, 332871, 332849, 332759, 332743, 332721, 332720,
  332639, 332145, 332144, 332106, 332010, 331721, 331487, 331466, 331220, 331191,
  331186, 331077, 331064, 330988, 330914, 330898, 330872, 330773, 330610, 330377,
  330363, 330316, 330245, 330201, 330198, 330180, 330100, 330078, 329904, 329852,
  329837, 329685, 329635, 329622, 329618, 329548, 329524, 329522, 329512, 329464,
  329428, 329355, 329345, 329294, 329166, 329137, 329123, 329088, 328862, 328801,
  328793, 328777, 328752, 328718, 328693, 328681, 328609, 328568, 328541, 328536,
  328421, 328411, 328396, 328376, 328349, 328329, 328325, 328308, 328297, 328283,
  328278, 328275, 328239, 328222, 328075, 328056, 328053, 328035, 328028, 327973,
  327942, 327929, 327902, 327866, 327848, 327839
];

async function keepOnlyLegitReachedEvents() {
  console.log('🔍 Starting cleanup - keeping only legitimate reached events...\n');
  console.log(`📋 Legitimate event IDs to keep: ${legitReachedEventIds.length}\n`);
  
  // Step 1: Fetch ALL reached events with their duration (no date restriction, with pagination)
  console.log('📊 Fetching all reached events...');
  
  let allReachedEvents = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: pageData, error: fetchError } = await supabase
      .from('agent_dial_metrics')
      .select('id, call_duration')
      .eq('event_type', 'reach')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (fetchError) {
      console.error('❌ Error fetching reached events:', fetchError);
      return;
    }
    
    if (pageData && pageData.length > 0) {
      allReachedEvents = allReachedEvents.concat(pageData);
      page++;
      hasMore = pageData.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`✅ Found ${allReachedEvents.length} total reached events\n`);
  
  // Step 2: Filter legitimate IDs to only those with non-null duration >= 30 seconds
  console.log('🔍 Validating legitimate events have non-null duration >= 30s...');
  const legitIdsSet = new Set(legitReachedEventIds);
  const validLegitEvents = allReachedEvents.filter(e => 
    legitIdsSet.has(e.id) && 
    e.call_duration !== null && 
    e.call_duration !== undefined && 
    e.call_duration >= 30
  );
  const validLegitIds = new Set(validLegitEvents.map(e => e.id));
  
  const invalidLegitCount = legitReachedEventIds.length - validLegitIds.size;
  if (invalidLegitCount > 0) {
    console.log(`   ⚠️  Found ${invalidLegitCount} legitimate events with null/insufficient duration - will be deleted`);
  }
  console.log(`   ✅ ${validLegitIds.size} legitimate events have valid duration\n`);
  
  // Step 3: Find events to delete (all except the valid legitimate ones)
  const allIds = allReachedEvents.map(e => e.id);
  const idsToDelete = allIds.filter(id => !validLegitIds.has(id));
  
  console.log(`📊 Analysis:`);
  console.log(`   ✅ To Keep (with valid duration): ${validLegitIds.size}`);
  console.log(`   ❌ To Delete: ${idsToDelete.length}\n`);
  
  // Step 4: Delete invalid events
  if (idsToDelete.length > 0) {
    console.log(`🗑️  Deleting ${idsToDelete.length} invalid reached events...`);
    
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
    console.log(`✅ Deleted ${idsToDelete.length} invalid events\n`);
  }
  
  // Step 5: Recalculate stats
  console.log('🔄 Recalculating stats for all agents...');
  const { error: rpcError } = await supabase.rpc('backfill_live_call_boardt_stats_corrected');
  
  if (rpcError) {
    console.error('❌ Error recalculating stats:', rpcError);
  } else {
    console.log('✅ Stats recalculated\n');
  }
  
  // Step 6: Verify what's left (with pagination)
  let remainingEvents = [];
  let remainingPage = 0;
  let hasMoreRemaining = true;
  
  while (hasMoreRemaining) {
    const { data: remainingPageData } = await supabase
      .from('agent_dial_metrics')
      .select('id')
      .eq('event_type', 'reach')
      .range(remainingPage * pageSize, (remainingPage + 1) * pageSize - 1);
    
    if (remainingPageData && remainingPageData.length > 0) {
      remainingEvents = remainingEvents.concat(remainingPageData);
      remainingPage++;
      hasMoreRemaining = remainingPageData.length === pageSize;
    } else {
      hasMoreRemaining = false;
    }
  }
  
  console.log('📊 Final Summary:');
  console.log(`   ✅ Legitimate events kept (with valid duration): ${validLegitIds.size}`);
  console.log(`   ⚠️  Legitimate events removed (null/insufficient duration): ${invalidLegitCount}`);
  console.log(`   ❌ Other events deleted: ${idsToDelete.length - invalidLegitCount}`);
  console.log(`   📊 Remaining reached events: ${remainingEvents?.length || 0}`);
  console.log(`\n✅ Fix complete!`);
}

keepOnlyLegitReachedEvents()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
