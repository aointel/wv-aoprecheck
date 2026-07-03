/**
 * Sync booked dispositions from masterlead to agent_dial_metrics
 * 
 * This script finds all masterlead records with cnresolution = 'booked'
 * and ensures they have corresponding booked events in agent_dial_metrics
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

async function syncBookedFromMasterlead() {
  console.log('🔍 Starting sync of booked dispositions from masterlead to agent_dial_metrics...\n');

  let totalProcessed = 0;
  let totalFixed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  const requiredDuration = 240; // Must be > 240 seconds (4 minutes)

  try {
    // Fetch all masterlead records with cnresolution = 'booked' in batches
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: bookedLeads, error: fetchError } = await supabase
        .from('masterlead')
        .select('id, phone, cn_email, cnresolution, updated_at, last_contacted, first_name, last_name, state, taalk_state')
        .eq('cnresolution', 'booked')
        .order('id', { ascending: true })
        .range(from, from + batchSize - 1);

      if (fetchError) {
        console.error(`❌ Error fetching booked leads:`, fetchError);
        break;
      }

      if (!bookedLeads || bookedLeads.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`\n📊 Processing batch: ${from + 1} to ${from + bookedLeads.length} of booked leads...`);

      for (let i = 0; i < bookedLeads.length; i++) {
        const lead = bookedLeads[i];
        totalProcessed++;
        
        // Progress indicator every 100 leads
        if (totalProcessed % 100 === 0) {
          console.log(`   Progress: ${totalProcessed} processed, ${totalFixed} fixed, ${totalSkipped} skipped`);
        }

        try {
          // Special logging for lead 625289 (the user's specific case)
          const isTargetLead = lead.id === 625289;
          if (isTargetLead) {
            console.log(`\n🎯 TARGET LEAD FOUND: ${lead.id} (${lead.phone})`);
          }
          
          // Check if there's already a booked event in agent_dial_metrics for this lead
          const { data: existingBooked, error: bookedCheckError } = await supabase
            .from('agent_dial_metrics')
            .select('id, event_type, disposition, call_duration, call_sid, agent_email, lead_phone')
            .eq('lead_id', lead.id)
            .or('disposition.eq.booked,event_type.eq.booked')
            .order('event_timestamp', { ascending: false })
            .limit(1);
          
          if (isTargetLead) {
            console.log(`   Existing booked events:`, existingBooked);
          }

          if (bookedCheckError) {
            console.error(`❌ Error checking for booked event for lead ${lead.id}:`, bookedCheckError);
            totalErrors++;
            continue;
          }

          // If we already have a booked event with valid duration, skip
          if (existingBooked && existingBooked.length > 0) {
            const bookedEvent = existingBooked[0];
            // Verify it has valid duration
            if (bookedEvent.call_duration && bookedEvent.call_duration > requiredDuration) {
              totalSkipped++;
              continue; // Already has valid booked event
            } else {
              // Has booked event but invalid duration - we'll try to find a better dial event to update
              console.log(`⚠️  Lead ${lead.id} has booked event but invalid duration: ${bookedEvent.call_duration || 'null'} - will look for better dial event`);
            }
          }

          // Try to find an existing dial event for this lead that we can update
          // First check by lead_id, then by phone if no match
          let dialEvents = null;
          let dialError = null;
          
          const { data: dialEventsById, error: dialErrorById } = await supabase
            .from('agent_dial_metrics')
            .select('id, event_type, disposition, call_duration, call_sid, agent_email, lead_phone, event_timestamp')
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
              .select('id, event_type, disposition, call_duration, call_sid, agent_email, lead_phone, event_timestamp')
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

          // Look for a dial event with valid duration (> 240s) that we can update to booked
          let foundValidDial = null;
          if (dialEvents && dialEvents.length > 0) {
            if (isTargetLead) {
              console.log(`   Found ${dialEvents.length} dial events:`, dialEvents.map(e => ({ id: e.id, duration: e.call_duration, disposition: e.disposition })));
            }
            for (const event of dialEvents) {
              // Check if this event has valid duration
              if (event.call_duration && event.call_duration > requiredDuration) {
                foundValidDial = event;
                if (isTargetLead) {
                  console.log(`   ✅ Found valid dial event: ${event.id} with duration ${event.call_duration}s`);
                }
                break;
              }
            }
          } else if (isTargetLead) {
            console.log(`   ⚠️  No dial events found for lead ${lead.id}`);
          }

          // If we found a valid dial event, update it to booked
          if (foundValidDial) {
            const { error: updateError } = await supabase
              .from('agent_dial_metrics')
              .update({
                disposition: 'booked',
                event_type: 'booked'
              })
              .eq('id', foundValidDial.id);

            if (updateError) {
              console.error(`❌ Error updating dial event ${foundValidDial.id} to booked:`, updateError);
              totalErrors++;
            } else {
              console.log(`✅ Updated dial event ${foundValidDial.id} to booked for lead ${lead.id} (duration: ${foundValidDial.call_duration}s)`);
              totalFixed++;
            }
            continue;
          }

          // If no valid dial event found, try to find call data from twilio_call_logs
          // But first, check if any dial event has a call_sid we can look up
          if (dialEvents && dialEvents.length > 0) {
            for (const event of dialEvents) {
              if (event.call_sid) {
                // Try to get duration from twilio_call_logs using call_sid
                const { data: twilioCallBySid, error: sidError } = await supabase
                  .from('twilio_call_logs')
                  .select('call_duration, call_status, twilio_call_sid, call_started_at')
                  .eq('twilio_call_sid', event.call_sid)
                  .maybeSingle();

                if (!sidError && twilioCallBySid && twilioCallBySid.call_duration && twilioCallBySid.call_duration > requiredDuration) {
                  // Update the dial event with the correct duration and set to booked
                  const { error: updateError } = await supabase
                    .from('agent_dial_metrics')
                    .update({
                      disposition: 'booked',
                      event_type: 'booked',
                      call_duration: twilioCallBySid.call_duration,
                      call_status: twilioCallBySid.call_status,
                      call_sid: twilioCallBySid.twilio_call_sid
                    })
                    .eq('id', event.id);

                  if (updateError) {
                    console.error(`❌ Error updating dial event ${event.id} with Twilio duration:`, updateError);
                    totalErrors++;
                  } else {
                    console.log(`✅ Updated dial event ${event.id} to booked with Twilio duration (${twilioCallBySid.call_duration}s) for lead ${lead.id}`);
                    totalFixed++;
                  }
                  continue; // Skip to next lead
                }
              }
            }
          }
          
          // If still no valid event, try to find call data from twilio_call_logs by phone
          const normalizedPhone = lead.phone?.replace(/\D/g, '') || '';
          const phoneVariations = [
            lead.phone,
            `+1${normalizedPhone}`,
            `+${normalizedPhone}`,
            normalizedPhone,
            `1${normalizedPhone}`
          ];

          // Look for calls in the last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const { data: twilioCalls, error: twilioError } = await supabase
            .from('twilio_call_logs')
            .select('call_duration, call_status, twilio_call_sid, call_started_at, owner_email')
            .in('to_number', phoneVariations)
            .eq('owner_email', lead.cn_email || '')
            .in('call_status', ['answered', 'completed'])
            .gte('call_started_at', thirtyDaysAgo.toISOString())
            .gt('call_duration', requiredDuration)
            .order('call_started_at', { ascending: false })
            .limit(1);

          if (twilioError) {
            console.warn(`⚠️  Error looking up Twilio call for lead ${lead.id}:`, twilioError);
          }

          // If we found a valid Twilio call, create a booked event
          if (twilioCalls && twilioCalls.length > 0) {
            const twilioCall = twilioCalls[0];
            const { error: insertError } = await supabase
              .from('agent_dial_metrics')
              .insert({
                agent_email: lead.cn_email,
                agent_name: null,
                lead_id: lead.id,
                lead_phone: lead.phone,
                lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || null,
                lead_state: lead.state || lead.taalk_state || null,
                event_type: 'booked',
                disposition: 'booked',
                call_duration: twilioCall.call_duration,
                call_status: twilioCall.call_status,
                call_sid: twilioCall.twilio_call_sid,
                source: 'outbound_dialer',
                notes: 'Synced from masterlead.cnresolution',
                event_timestamp: twilioCall.call_started_at || new Date().toISOString()
              });

            if (insertError) {
              console.error(`❌ Error creating booked event for lead ${lead.id}:`, insertError);
              totalErrors++;
            } else {
              console.log(`✅ Created booked event for lead ${lead.id} from Twilio call (duration: ${twilioCall.call_duration}s)`);
              totalFixed++;
            }
            continue;
          }


          // If we can't find any valid call data, log it but don't create invalid data
          console.warn(`⚠️  Lead ${lead.id} (${lead.phone}) marked as booked in masterlead but no valid call data found (duration > ${requiredDuration}s required)`);
          totalSkipped++;

        } catch (error) {
          console.error(`❌ Error processing lead ${lead.id}:`, error);
          totalErrors++;
        }
      }

      from += batchSize;
      if (bookedLeads.length < batchSize) {
        hasMore = false;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY:');
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   ✅ Fixed/Created: ${totalFixed}`);
    console.log(`   ⏭️  Skipped (already valid): ${totalSkipped}`);
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

// Run the script
syncBookedFromMasterlead()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
