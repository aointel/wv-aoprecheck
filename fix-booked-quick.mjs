/**
 * Quick fix: Update dial events to booked for leads marked as booked in masterlead
 * This is a faster version that uses SQL directly
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function quickFix() {
  console.log('🔍 Quick fix: Updating dial events to booked for leads marked as booked in masterlead...\n');

  // Use RPC to update in bulk
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      UPDATE agent_dial_metrics adm
      SET 
        disposition = 'booked',
        event_type = 'booked'
      FROM masterlead ml
      WHERE 
        adm.lead_id = ml.id
        AND ml.cnresolution = 'booked'
        AND adm.call_duration > 240
        AND adm.disposition != 'booked'
        AND adm.event_type != 'booked'
        AND NOT EXISTS (
          SELECT 1 
          FROM agent_dial_metrics adm2
          WHERE adm2.lead_id = ml.id
            AND (adm2.disposition = 'booked' OR adm2.event_type = 'booked')
            AND adm2.call_duration > 240
            AND adm2.id != adm.id
        )
      RETURNING adm.id, adm.lead_id, adm.call_duration;
    `
  });

  if (error) {
    console.error('❌ Error:', error);
    // Try direct update instead
    console.log('Trying direct update...');
    
    // Get leads marked as booked
    const { data: bookedLeads } = await supabase
      .from('masterlead')
      .select('id')
      .eq('cnresolution', 'booked');
    
    if (!bookedLeads || bookedLeads.length === 0) {
      console.log('No booked leads found');
      return;
    }
    
    const leadIds = bookedLeads.map(l => l.id);
    let totalUpdated = 0;
    
    // Process in batches
    for (let i = 0; i < leadIds.length; i += 100) {
      const batch = leadIds.slice(i, i + 100);
      
      // Find dial events with valid duration for these leads
      // Get ALL events with duration > 240, then filter in code
      const { data: dialEvents } = await supabase
        .from('agent_dial_metrics')
        .select('id, lead_id, call_duration, disposition, event_type')
        .in('lead_id', batch)
        .gt('call_duration', 240);
      
      if (dialEvents && dialEvents.length > 0) {
        // Filter to only events that are NOT already fully booked (both disposition AND event_type must be booked to skip)
        const eventsToUpdate = dialEvents.filter(e => 
          !(e.disposition === 'booked' && e.event_type === 'booked')
        );
        
        // Check each one to make sure there's no existing booked event for this lead
        for (const event of eventsToUpdate) {
          const { data: existingBooked } = await supabase
            .from('agent_dial_metrics')
            .select('id')
            .eq('lead_id', event.lead_id)
            .or('disposition.eq.booked,event_type.eq.booked')
            .gt('call_duration', 240)
            .neq('id', event.id)
            .limit(1);
          
          if (!existingBooked || existingBooked.length === 0) {
            // No existing booked event, update this one
            const { error: updateError } = await supabase
              .from('agent_dial_metrics')
              .update({ disposition: 'booked', event_type: 'booked' })
              .eq('id', event.id);
            
            if (!updateError) {
              totalUpdated++;
              if (event.lead_id === 625289) {
                console.log(`✅ Fixed target lead 625289: Updated event ${event.id} to booked (duration: ${event.call_duration}s)`);
              }
            } else {
              console.error(`❌ Error updating event ${event.id}:`, updateError);
            }
          }
        }
      }
      
      if ((i + 100) % 1000 === 0) {
        console.log(`   Processed ${i + 100} leads, updated ${totalUpdated} events`);
      }
    }
    
    console.log(`\n✅ Total updated: ${totalUpdated} dial events`);
  } else {
    console.log(`✅ Updated ${data?.length || 0} dial events`);
  }
  
  // Recalculate stats
  console.log('\n🔄 Recalculating live call board stats...');
  const { error: rpcError } = await supabase.rpc('backfill_live_call_boardt_stats_corrected');
  if (rpcError) {
    console.error('❌ Error recalculating stats:', rpcError);
  } else {
    console.log('✅ Stats recalculated');
  }
}

quickFix()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
