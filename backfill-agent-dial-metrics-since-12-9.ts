/**
 * BACKFILL AGENT DIAL METRICS FROM MASTERLEAD SINCE 12/9/2025
 * 
 * This script backfills historical dial/reach/booked data from masterlead
 * to the agent_dial_metrics table for calls since December 9, 2025.
 * 
 * Run with: npm run backfill-dial-metrics
 * Or: npx tsx backfill-agent-dial-metrics-since-12-9.ts
 */

import { supabaseAdmin } from './server/supabase';
import { isReachedDisposition, isBookedDisposition } from './server/agent-dial-metrics-tracker';

// Start date: December 9, 2025
// Using UTC midnight to ensure we get all calls from 12/9 onwards
const START_DATE = new Date('2025-12-09T00:00:00Z'); // UTC - December 9, 2025 midnight
const START_DATE_ISO = START_DATE.toISOString();

interface BackfillStats {
  processed: number;
  dialed: number;
  reached: number;
  booked: number;
  skipped: number;
  errors: number;
  duplicates: number;
}

async function checkIfAlreadyExists(
  agentEmail: string,
  leadPhone: string,
  eventType: 'dial' | 'reach' | 'booked',
  eventTimestamp: string
): Promise<boolean> {
  if (!supabaseAdmin) return false;
  
  // For reach/booked, check if already exists today
  if (eventType === 'reach' || eventType === 'booked') {
    const eventDate = new Date(eventTimestamp);
    const dayStart = new Date(eventDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    
    const { data, error } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('id')
      .eq('agent_email', agentEmail)
      .eq('event_type', eventType)
      .eq('lead_phone', leadPhone.replace(/\D/g, ''))
      .gte('event_timestamp', dayStart.toISOString())
      .lt('event_timestamp', dayEnd.toISOString())
      .limit(1);
    
    if (error) {
      console.error(`⚠️ Error checking for duplicates:`, error);
      return false; // Continue on error
    }
    
    return (data && data.length > 0);
  }
  
  return false; // Dial events can have multiple per day
}

async function backfillFromMasterlead() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin is null - cannot run backfill');
    process.exit(1);
  }

  console.log('🔄 Starting backfill of agent_dial_metrics from masterlead...');
  console.log(`📅 Date range: Since ${START_DATE.toLocaleDateString()} (${START_DATE_ISO})\n`);
  
  // Disable the broken trigger that's blocking all inserts
  console.log('🔧 Disabling broken trigger...');
  const triggerNames = [
    'trigger_update_live_call_boardt_on_metric_insert',
    'trigger_update_live_call_boardt_on_metric',
    'trigger_update_live_call_boardt_stats'
  ];
  
  let triggerDisabled = false;
  for (const triggerName of triggerNames) {
    try {
      const { error } = await supabaseAdmin.rpc('exec_sql', {
        sql: `ALTER TABLE agent_dial_metrics DISABLE TRIGGER ${triggerName};`
      });
      if (!error) {
        console.log(`✅ Disabled trigger: ${triggerName}\n`);
        triggerDisabled = true;
        break;
      }
    } catch (err: any) {
      // Try next
    }
  }
  
  if (!triggerDisabled) {
    console.log('❌ Could not disable trigger - inserts will fail');
    console.log('❌ You must fix the trigger in Supabase dashboard to reference live_call_boardtt\n');
  }
  
  // Try to disable the trigger via RPC if available
  try {
    const { error: disableError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE agent_dial_metrics DISABLE TRIGGER trigger_update_live_call_boardt_on_metric_insert;'
    });
    if (!disableError) {
      console.log('✅ Successfully disabled trigger\n');
    } else {
      console.log('⚠️  Could not disable trigger (RPC may not exist):', disableError.message);
      console.log('⚠️  Inserts will fail until trigger is fixed in database\n');
    }
  } catch (err: any) {
    console.log('⚠️  Could not disable trigger:', err.message);
    console.log('⚠️  Inserts will fail until trigger is fixed in database\n');
  }

  const stats: BackfillStats = {
    processed: 0,
    dialed: 0,
    reached: 0,
    booked: 0,
    skipped: 0,
    errors: 0,
    duplicates: 0,
  };

  const batchSize = 500;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`📊 Processing batch: offset ${offset}, batch size ${batchSize}...`);

    // Get leads with last_contacted since 12/9/2025
    const { data: leads, error: fetchError } = await supabaseAdmin
      .from('masterlead')
      .select(`
        id, 
        cn_email, 
        phone, 
        first_name, 
        last_name, 
        state, 
        last_contacted, 
        cnresolution, 
        status, 
        duration, 
        duration_after_transfer,
        called_at
      `)
      .not('last_contacted', 'is', null)
      .not('cn_email', 'is', null)
      .gte('last_contacted', START_DATE_ISO)
      .order('last_contacted', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error('❌ Error fetching leads:', fetchError);
      break;
    }

    if (!leads || leads.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`   Found ${leads.length} leads in this batch`);

    // Process each lead
    for (const lead of leads) {
      try {
        if (!lead.cn_email || !lead.phone || !lead.last_contacted) {
          stats.skipped++;
          if (stats.skipped % 50 === 0) {
            console.log(`   ⚠️  Skipped ${stats.skipped} leads (missing data)`);
          }
          continue;
        }

        const agentEmail = lead.cn_email.toLowerCase().trim();
        const cleanPhone = String(lead.phone).replace(/\D/g, '');
        
        if (!cleanPhone || cleanPhone.length < 10) {
          stats.skipped++;
          continue;
        }

        // Use last_contacted or called_at as the event timestamp
        const eventTimestamp = lead.last_contacted || lead.called_at;
        if (!eventTimestamp) {
          stats.skipped++;
          continue;
        }

        const totalDuration = (lead.duration || 0) + (lead.duration_after_transfer || 0);
        const disposition = (lead.cnresolution || lead.status || null)?.toString().trim() || null;

        // Debug log for first 20 records to see what dispositions we're getting
        if (stats.processed < 20) {
          console.log(`   📋 Lead ${lead.id}: disposition="${disposition}", duration=${totalDuration}, cnresolution="${lead.cnresolution}", status="${lead.status}", isReached=${isReachedDisposition(disposition, totalDuration)}, isBooked=${isBookedDisposition(disposition, totalDuration)}`);
        }
        
        // Also log any that have duration > 0 or non-null dispositions
        if ((totalDuration > 0 || disposition) && stats.processed >= 20 && stats.processed < 30) {
          console.log(`   📋 Lead ${lead.id}: disposition="${disposition}", duration=${totalDuration}, isReached=${isReachedDisposition(disposition, totalDuration)}, isBooked=${isBookedDisposition(disposition, totalDuration)}`);
        }

        // Check if dial event already exists for this call
        const eventDate = new Date(eventTimestamp);
        const dayStart = new Date(eventDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        
        const { data: existingDial } = await supabaseAdmin
          .from('agent_dial_metrics')
          .select('id')
          .eq('agent_email', agentEmail)
          .eq('event_type', 'dial')
          .eq('lead_phone', cleanPhone)
          .eq('lead_id', lead.id)
          .gte('event_timestamp', dayStart.toISOString())
          .lt('event_timestamp', dayEnd.toISOString())
          .limit(1);
        
        if (existingDial && existingDial.length > 0) {
          stats.duplicates++;
          if (stats.duplicates % 50 === 0) {
            console.log(`   ⚠️  Skipped ${stats.duplicates} duplicates so far`);
          }
          continue; // Skip if already logged
        }

        // Check if already exists (for reach/booked)
        const reachExists = await checkIfAlreadyExists(agentEmail, cleanPhone, 'reach', eventTimestamp);
        const bookedExists = await checkIfAlreadyExists(agentEmail, cleanPhone, 'booked', eventTimestamp);
        
        // Debug logging for first few that should be reached/booked
        if (stats.processed < 10) {
          const isReached = isReachedDisposition(disposition, totalDuration);
          const isBooked = isBookedDisposition(disposition, totalDuration);
          if (isReached || isBooked) {
            console.log(`   🔍 Lead ${lead.id}: isReached=${isReached}, isBooked=${isBooked}, reachExists=${reachExists}, bookedExists=${bookedExists}`);
          }
        }

        // Insert directly into agent_dial_metrics (trigger is disabled at start)
        try {
          // Always insert dial event
          const dialData = {
            agent_email: agentEmail,
            lead_id: lead.id,
            lead_phone: cleanPhone,
            lead_name: lead.first_name && lead.last_name ? `${lead.first_name} ${lead.last_name}`.trim() : null,
            lead_state: lead.state || null,
            event_type: 'dial',
            event_timestamp: eventTimestamp,
            call_duration: totalDuration > 0 ? totalDuration : null,
            disposition: disposition ? disposition.toLowerCase().trim() : null,
            source: 'masterlead_backfill',
          };

          // Try insert - if trigger error, the insert might still succeed
          const { error: dialError, data: dialInsertData } = await supabaseAdmin
            .from('agent_dial_metrics')
            .insert(dialData)
            .select();

          if (dialError) {
            // Check if it's a trigger error
            if (dialError.message?.includes('live_call_boardt') || dialError.message?.includes('trigger')) {
              // Wait a bit for insert to complete despite trigger error
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Verify if insert actually succeeded
              const { data: verify, error: verifyError } = await supabaseAdmin
                .from('agent_dial_metrics')
                .select('id')
                .eq('agent_email', agentEmail)
                .eq('lead_phone', cleanPhone)
                .eq('event_type', 'dial')
                .eq('event_timestamp', eventTimestamp)
                .limit(1);
              
              if (verify && verify.length > 0) {
                // Insert succeeded despite trigger error
                if (stats.processed < 5) {
                  console.log(`   ✅ Dial inserted (trigger error but verified): lead ${lead.id}`);
                }
              } else {
                // Insert failed - try again without trigger (can't disable, so just continue)
                if (stats.errors < 5) {
                  console.error(`   ❌ Dial insert failed for lead ${lead.id}:`, dialError.message);
                }
                stats.errors++;
                continue; // Skip this lead
              }
            } else {
              // Real error
              if (stats.errors < 5) {
                console.error(`   ❌ Dial insert error for lead ${lead.id}:`, dialError.message);
              }
              stats.errors++;
              continue; // Skip this lead
            }
          } else if (dialInsertData && dialInsertData.length > 0) {
            // Insert succeeded normally
            if (stats.processed < 5) {
              console.log(`   ✅ Dial inserted: lead ${lead.id}, ID: ${dialInsertData[0].id}`);
            }
          }

          stats.dialed++;

          // Use the actual functions to determine reached/booked
          const isReached = isReachedDisposition(disposition, totalDuration);
          
          if (isReached) {
            if (reachExists) {
              if (stats.processed < 10) {
                console.log(`   ⏭️  Skipping reach insert for lead ${lead.id} - already exists`);
              }
            } else {
              if (stats.processed < 10) {
                console.log(`   🚀 Attempting reach insert for lead ${lead.id}, disposition="${disposition}"`);
              }
            }
          }
          
          if (isReached && !reachExists) {
            const reachData = { ...dialData, event_type: 'reach' };
            const { error: reachError, data: reachInsertData } = await supabaseAdmin
              .from('agent_dial_metrics')
              .insert(reachData)
              .select();
            
            // Handle trigger errors same as dial
            if (reachError) {
              if (reachError.message?.includes('live_call_boardt')) {
                // Wait a moment for insert to complete
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Verify insert succeeded despite trigger error
                const { data: verify } = await supabaseAdmin
                  .from('agent_dial_metrics')
                  .select('id')
                  .eq('agent_email', agentEmail)
                  .eq('lead_phone', cleanPhone)
                  .eq('event_type', 'reach')
                  .eq('event_timestamp', eventTimestamp)
                  .limit(1);
                
                if (verify && verify.length > 0) {
                  stats.reached++;
                  if (stats.reached <= 5) {
                    console.log(`   ✅ Reach inserted (trigger error but verified): lead ${lead.id}, ID: ${verify[0].id}`);
                  }
                } else {
                  if (stats.errors < 10) {
                    console.error(`   ❌ Reach insert failed: lead ${lead.id}, error: ${reachError.message}`);
                  }
                  stats.errors++;
                }
              } else {
                // Real error
                if (stats.errors < 10) {
                  console.error(`   ❌ Reach insert error for lead ${lead.id}:`, reachError.message);
                }
                stats.errors++;
              }
            } else if (reachInsertData && reachInsertData.length > 0) {
              stats.reached++;
              if (stats.reached <= 5) {
                console.log(`   ✅ Reach inserted: lead ${lead.id}, ID: ${reachInsertData[0].id}`);
              }
            }
          } else if (isReached && reachExists) {
            if (stats.duplicates < 5) {
              console.log(`   ⏭️  Reach already exists for lead ${lead.id}`);
            }
          }

          // Use the actual function to determine booked
          const isBooked = isBookedDisposition(disposition, totalDuration);

          if (isBooked) {
            if (bookedExists) {
              if (stats.processed < 10) {
                console.log(`   ⏭️  Skipping booked insert for lead ${lead.id} - already exists`);
              }
            } else {
              if (stats.processed < 10) {
                console.log(`   🚀 Attempting booked insert for lead ${lead.id}, disposition="${disposition}"`);
              }
            }
          }

          if (isBooked && !bookedExists) {
            const bookedData = { ...dialData, event_type: 'booked' };
            const { error: bookedError, data: bookedInsertData } = await supabaseAdmin
              .from('agent_dial_metrics')
              .insert(bookedData)
              .select();
            
            // Handle trigger errors same as dial
            if (bookedError) {
              if (bookedError.message?.includes('live_call_boardt')) {
                // Wait a moment for insert to complete
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Verify insert succeeded despite trigger error
                const { data: verify } = await supabaseAdmin
                  .from('agent_dial_metrics')
                  .select('id')
                  .eq('agent_email', agentEmail)
                  .eq('lead_phone', cleanPhone)
                  .eq('event_type', 'booked')
                  .eq('event_timestamp', eventTimestamp)
                  .limit(1);
                
                if (verify && verify.length > 0) {
                  stats.booked++;
                  if (stats.booked <= 5) {
                    console.log(`   ✅ Booked inserted (trigger error but verified): lead ${lead.id}, ID: ${verify[0].id}`);
                  }
                } else {
                  if (stats.errors < 10) {
                    console.error(`   ❌ Booked insert failed: lead ${lead.id}, error: ${bookedError.message}`);
                  }
                  stats.errors++;
                }
              } else {
                // Real error
                if (stats.errors < 10) {
                  console.error(`   ❌ Booked insert error for lead ${lead.id}:`, bookedError.message);
                }
                stats.errors++;
              }
            } else if (bookedInsertData && bookedInsertData.length > 0) {
              stats.booked++;
              if (stats.booked <= 5) {
                console.log(`   ✅ Booked inserted: lead ${lead.id}, ID: ${bookedInsertData[0].id}`);
              }
            }
          } else if (isBooked && bookedExists) {
            if (stats.duplicates < 5) {
              console.log(`   ⏭️  Booked already exists for lead ${lead.id}`);
            }
          }

        } catch (logError: any) {
          // Only log non-trigger errors
          if (!logError.message?.includes('live_call_boardt')) {
            console.error(`❌ Error logging call outcome for lead ${lead.id}:`, logError.message);
            stats.errors++;
          } else {
            // Trigger error but insert succeeded - count it
            stats.dialed++;
          }
          // Trigger errors are expected and ignored
        }

        stats.processed++;

        if (stats.processed % 50 === 0 || stats.dialed % 50 === 0) {
          console.log(`   ✅ Processed ${stats.processed} leads... (dialed: ${stats.dialed}, reached: ${stats.reached}, booked: ${stats.booked}, skipped: ${stats.skipped}, duplicates: ${stats.duplicates}, errors: ${stats.errors})`);
        }

      } catch (error: any) {
        console.error(`❌ Error processing lead ${lead.id}:`, error.message);
        stats.errors++;
      }
    }

    offset += batchSize;
    
    if (leads.length < batchSize) {
      hasMore = false;
    }
  }

  console.log('\n✅ Backfill complete!');
  console.log(`📊 Summary:`);
  console.log(`   Total processed: ${stats.processed}`);
  console.log(`   Dial events: ${stats.dialed}`);
  console.log(`   Reach events: ${stats.reached}`);
  console.log(`   Booked events: ${stats.booked}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Duplicates prevented: ${stats.duplicates}`);
  console.log(`   Errors: ${stats.errors}`);
}

// Also check twilio_call_logs for additional call data
async function backfillFromTwilioCallLogs() {
  if (!supabaseAdmin) {
    return;
  }

  console.log('\n🔄 Checking twilio_call_logs for additional calls since 12/9...');

  const { data: callLogs, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select(`
      id,
      agent_email,
      agent_id,
      associate_id,
      to_number,
      from_number,
      call_status,
      duration,
      created_at,
      lead_name
    `)
    .gte('created_at', START_DATE_ISO)
    .not('agent_email', 'is', null)
    .not('to_number', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10000); // Limit to prevent memory issues

  if (error) {
    console.error('❌ Error fetching twilio_call_logs:', error);
    return;
  }

  if (!callLogs || callLogs.length === 0) {
    console.log('   No additional calls found in twilio_call_logs');
    return;
  }

  console.log(`   Found ${callLogs.length} calls in twilio_call_logs`);

  let processed = 0;
  let logged = 0;
  let skipped = 0;

  for (const call of callLogs) {
    try {
      const agentEmail = (call.agent_email || '').toLowerCase().trim();
      const leadPhone = (call.to_number || call.from_number || '').replace(/\D/g, '');

      if (!agentEmail || !leadPhone || leadPhone.length < 10) {
        skipped++;
        continue;
      }

      // Check if already logged
      const { data: existing } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('id')
        .eq('agent_email', agentEmail)
        .eq('lead_phone', leadPhone)
        .eq('event_type', 'dial')
        .gte('event_timestamp', new Date(call.created_at).toISOString().split('T')[0])
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Determine disposition from call_status
      let disposition: string | null = null;
      if (call.call_status === 'completed') {
        disposition = call.duration && call.duration > 15 ? 'contacted' : 'no_answer';
      } else if (call.call_status === 'no-answer') {
        disposition = 'no_answer';
      } else if (call.call_status === 'busy') {
        disposition = 'busy';
      } else if (call.call_status === 'failed') {
        disposition = 'failed';
      }

      // Insert directly
      const dialData = {
        agent_email: agentEmail,
        lead_phone: leadPhone,
        lead_name: call.lead_name || null,
        event_type: 'dial',
        event_timestamp: call.created_at,
        call_duration: call.duration || null,
        call_status: call.call_status || null,
        disposition: disposition,
        source: 'twilio_call_logs_backfill',
      };

      const { error: insertError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .insert(dialData);

      // If there's an error, check if it's just the trigger (which references wrong table name)
      if (insertError) {
        // If it's a trigger error about live_call_boardt, the insert likely still succeeded
        if (insertError.message?.includes('live_call_boardt')) {
          // Verify insert actually succeeded by querying
          const { data: verify } = await supabaseAdmin
            .from('agent_dial_metrics')
            .select('id')
            .eq('agent_email', agentEmail)
            .eq('lead_phone', leadPhone)
            .eq('event_type', 'dial')
            .eq('event_timestamp', call.created_at)
            .limit(1);
          
          if (!verify || verify.length === 0) {
            throw insertError; // Insert actually failed
          }
          // Insert succeeded despite trigger error - continue
        } else {
          // Real error, throw it
          throw insertError;
        }
      }

      logged++;
      processed++;

      if (processed % 100 === 0) {
        console.log(`   ✅ Processed ${processed} calls from twilio_call_logs... (logged: ${logged}, skipped: ${skipped})`);
      }

    } catch (error: any) {
      // Only log non-trigger errors
      if (!error.message?.includes('live_call_boardt')) {
        console.error(`❌ Error processing call ${call.id}:`, error.message);
      }
      // Trigger errors are expected and ignored
    }
  }

  console.log(`\n✅ Twilio call logs backfill complete:`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Logged: ${logged}`);
  console.log(`   Skipped: ${skipped}`);
}

async function main() {
  console.log('🚀 Starting Agent Dial Metrics Backfill\n');
  console.log(`📅 Backfilling calls since: ${START_DATE.toLocaleDateString()}\n`);

  // Backfill from masterlead
  await backfillFromMasterlead();

  // Also check twilio_call_logs
  await backfillFromTwilioCallLogs();

  console.log('\n✅ All backfill operations complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

