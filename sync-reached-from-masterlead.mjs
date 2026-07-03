/**
 * Sync reached events from masterlead to agent_dial_metrics
 * 
 * This script finds all masterlead records with dispositions that indicate "reached"
 * and ensures they have corresponding reach events in agent_dial_metrics
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
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Dispositions that indicate "reached" (human contact)
const reachedDispositions = [
  'contacted', 'connected', 'talked', 'qualified', 'interested', 
  'not_interested', 'transfer', 'appointment', 'booked', 
  'callback_scheduled', 'call_back', 'callback', 'sale',
  'instant_presentation', 'already_been_sold', 'medically_uninsurable',
  'over_age', 'duplicate', 'dnc', 'do_not_call'
];

// Dispositions that indicate NOT reached
const notReachedDispositions = [
  'no_answer', 'busy', 'failed', 'voicemail', 'bad_number',
  'no_answer_vm', 'no_answer_voicemail', 'wrong_number', 'wrong number'
];

async function syncReachedFromMasterlead() {
  console.log('🔍 Starting sync of reached events from masterlead to agent_dial_metrics...\n');

  let totalProcessed = 0;
  let totalFixed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  const requiredDuration = 30; // Must be >= 30 seconds

  try {
    // Fetch all masterlead records with "reached" dispositions in batches
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: reachedLeads, error: fetchError } = await supabase
        .from('masterlead')
        .select('id, phone, cn_email, cnresolution, updated_at, last_contacted, first_name, last_name, state, taalk_state')
        .not('cnresolution', 'is', null)
        .not('cnresolution', 'in', `(${notReachedDispositions.map(d => `'${d}'`).join(',')})`)
        .order('id', { ascending: true })
        .range(from, from + batchSize - 1);

      if (fetchError) {
        console.error(`❌ Error fetching reached leads:`, fetchError);
        break;
      }

      if (!reachedLeads || reachedLeads.length === 0) {
        hasMore = false;
        break;
      }

      // Filter to only "reached" dispositions
      const filteredLeads = reachedLeads.filter(lead => {
        const resolution = (lead.cnresolution || '').toLowerCase().trim();
        return reachedDispositions.includes(resolution) || 
               (!notReachedDispositions.includes(resolution) && resolution !== '');
      });

      if (filteredLeads.length === 0) {
        from += batchSize;
        continue;
      }

      console.log(`\n📊 Processing batch: ${from + 1} to ${from + filteredLeads.length} of reached leads...`);

      for (let i = 0; i < filteredLeads.length; i++) {
        const lead = filteredLeads[i];
        totalProcessed++;
        
        if (totalProcessed % 100 === 0) {
          console.log(`   Progress: ${totalProcessed} processed, ${totalFixed} fixed, ${totalSkipped} skipped`);
        }

        try {
          // Check if there's already a reach event in agent_dial_metrics for this lead
          const { data: existingReach, error: reachCheckError } = await supabase
            .from('agent_dial_metrics')
            .select('id, event_type, disposition, call_duration, call_sid, agent_email, lead_phone')
            .eq('lead_id', lead.id)
            .eq('event_type', 'reach')
            .order('event_timestamp', { ascending: false })
            .limit(1);

          if (reachCheckError) {
            console.error(`❌ Error checking for reach event for lead ${lead.id}:`, reachCheckError);
            totalErrors++;
            continue;
          }

          // If we already have a reach event with valid duration, skip
          if (existingReach && existingReach.length > 0) {
            const reachEvent = existingReach[0];
            if (reachEvent.call_duration && reachEvent.call_duration >= requiredDuration) {
              totalSkipped++;
              continue; // Already has valid reach event
            } else {
              console.log(`⚠️  Lead ${lead.id} has reach event but invalid duration: ${reachEvent.call_duration || 'null'}`);
            }
          }

          // Try to find an existing dial event for this lead that we can update or use
          let dialEvents = null;
          let dialError = null;
          
          const { data: dialEventsById, error: dialErrorById } = await supabase
            .from('agent_dial_metrics')
            .select('id, event_type, disposition, call_duration, call_sid, agent_email, lead_phone, event_timestamp, call_status')
            .eq('lead_id', lead.id)
            .order('event_timestamp', { ascending: false })
            .limit(5);
          
          if (dialErrorById) {
            dialError = dialErrorById;
          } else {
            dialEvents = dialEventsById;
          }
          
          // If no events found by lead_id, try by phone
          if ((!dialEvents || dialEvents.length === 0) && lead.phone) {
            const { data: dialEventsByPhone, error: dialErrorByPhone } = await supabase
              .from('agent_dial_metrics')
              .select('id, event_type, disposition, call_duration, call_sid, agent_email, lead_phone, event_timestamp, call_status')
              .eq('lead_phone', lead.phone)
              .order('event_timestamp', { ascending: false })
              .limit(5);
            
            if (dialErrorByPhone) {
              dialError = dialErrorByPhone;
            } else {
              dialEvents = dialEventsByPhone;
            }
          }

          if (dialError) {
            console.error(`❌ Error fetching dial events for lead ${lead.id}:`, dialError);
            totalErrors++;
            continue;
          }

          // Look for a dial event with valid duration (>= 30s) that we can use
          let foundValidDial = null;
          if (dialEvents && dialEvents.length > 0) {
            for (const event of dialEvents) {
              // Check if this event has valid duration and is not a "not reached" disposition
              const eventDisposition = (event.disposition || '').toLowerCase().trim();
              const isNotReached = notReachedDispositions.includes(eventDisposition);
              
              if (!isNotReached && event.call_duration && event.call_duration >= requiredDuration) {
                foundValidDial = event;
                break;
              }
            }
          }

          // If we found a valid dial event, check if we need to create a reach event or update existing
          if (foundValidDial) {
            // Check if there's already a reach event for this lead
            if (!existingReach || existingReach.length === 0) {
              // Create a new reach event
              const { error: insertError } = await supabase
                .from('agent_dial_metrics')
                .insert({
                  agent_email: foundValidDial.agent_email || lead.cn_email,
                  agent_name: null,
                  lead_id: lead.id,
                  lead_phone: foundValidDial.lead_phone || lead.phone,
                  lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || null,
                  lead_state: lead.state || lead.taalk_state || null,
                  event_type: 'reach',
                  disposition: lead.cnresolution || foundValidDial.disposition,
                  call_duration: foundValidDial.call_duration,
                  call_status: foundValidDial.call_status || 'completed',
                  call_sid: foundValidDial.call_sid || null,
                  source: 'outbound_dialer',
                  notes: 'Synced from masterlead.cnresolution',
                  event_timestamp: foundValidDial.event_timestamp || new Date().toISOString()
                });

              if (insertError) {
                console.error(`❌ Error creating reach event for lead ${lead.id}:`, insertError);
                totalErrors++;
              } else {
                console.log(`✅ Created reach event for lead ${lead.id} (duration: ${foundValidDial.call_duration}s)`);
                totalFixed++;
              }
            } else {
              // Update existing reach event with correct duration
              const { error: updateError } = await supabase
                .from('agent_dial_metrics')
                .update({
                  call_duration: foundValidDial.call_duration,
                  call_status: foundValidDial.call_status || 'completed',
                  call_sid: foundValidDial.call_sid || null,
                  disposition: lead.cnresolution || foundValidDial.disposition
                })
                .eq('id', existingReach[0].id);

              if (updateError) {
                console.error(`❌ Error updating reach event for lead ${lead.id}:`, updateError);
                totalErrors++;
              } else {
                console.log(`✅ Updated reach event for lead ${lead.id} (duration: ${foundValidDial.call_duration}s)`);
                totalFixed++;
              }
            }
            continue;
          }

          // If no valid dial event found, try to find call data from twilio_call_logs
          if (dialEvents && dialEvents.length > 0) {
            for (const event of dialEvents) {
              if (event.call_sid) {
                // Try to get duration from twilio_call_logs using call_sid
                const { data: twilioCallBySid, error: sidError } = await supabase
                  .from('twilio_call_logs')
                  .select('call_duration, call_status, twilio_call_sid, call_started_at')
                  .eq('twilio_call_sid', event.call_sid)
                  .maybeSingle();

                if (!sidError && twilioCallBySid && twilioCallBySid.call_duration && twilioCallBySid.call_duration >= requiredDuration) {
                  // Create or update reach event with Twilio duration
                  if (!existingReach || existingReach.length === 0) {
                    const { error: insertError } = await supabase
                      .from('agent_dial_metrics')
                      .insert({
                        agent_email: event.agent_email || lead.cn_email,
                        agent_name: null,
                        lead_id: lead.id,
                        lead_phone: event.lead_phone || lead.phone,
                        lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || null,
                        lead_state: lead.state || lead.taalk_state || null,
                        event_type: 'reach',
                        disposition: lead.cnresolution || event.disposition,
                        call_duration: twilioCallBySid.call_duration,
                        call_status: twilioCallBySid.call_status,
                        call_sid: twilioCallBySid.twilio_call_sid,
                        source: 'outbound_dialer',
                        notes: 'Synced from masterlead.cnresolution with Twilio duration',
                        event_timestamp: twilioCallBySid.call_started_at || event.event_timestamp || new Date().toISOString()
                      });

                    if (insertError) {
                      console.error(`❌ Error creating reach event with Twilio duration for lead ${lead.id}:`, insertError);
                      totalErrors++;
                    } else {
                      console.log(`✅ Created reach event for lead ${lead.id} with Twilio duration (${twilioCallBySid.call_duration}s)`);
                      totalFixed++;
                    }
                  } else {
                    const { error: updateError } = await supabase
                      .from('agent_dial_metrics')
                      .update({
                        call_duration: twilioCallBySid.call_duration,
                        call_status: twilioCallBySid.call_status,
                        call_sid: twilioCallBySid.twilio_call_sid
                      })
                      .eq('id', existingReach[0].id);

                    if (updateError) {
                      console.error(`❌ Error updating reach event with Twilio duration for lead ${lead.id}:`, updateError);
                      totalErrors++;
                    } else {
                      console.log(`✅ Updated reach event for lead ${lead.id} with Twilio duration (${twilioCallBySid.call_duration}s)`);
                      totalFixed++;
                    }
                  }
                  continue; // Skip to next lead
                }
              }
            }
          }

          // If we can't find any valid call data, skip
          totalSkipped++;

        } catch (error) {
          console.error(`❌ Error processing lead ${lead.id}:`, error);
          totalErrors++;
        }
      }

      from += batchSize;
      if (reachedLeads.length < batchSize) {
        hasMore = false;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY:');
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   ✅ Fixed/Created: ${totalFixed}`);
    console.log(`   ⏭️  Skipped (already valid or no data): ${totalSkipped}`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log('='.repeat(60));

    // Recalculate live call board stats
    if (totalFixed > 0) {
      console.log('\n🔄 Recalculating live call board stats...');
      const { error: rpcError } = await supabase.rpc('backfill_live_call_boardt_stats_corrected');
      if (rpcError) {
        console.error('❌ Error recalculating stats:', rpcError);
      } else {
        console.log('✅ Stats recalculated');
      }
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

syncReachedFromMasterlead()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
