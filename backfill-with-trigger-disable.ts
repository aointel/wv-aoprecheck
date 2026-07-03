/**
 * BACKFILL WITH TRIGGER DISABLE: Temporarily disable trigger, backfill, then re-enable
 * 
 * Run with: npx tsx backfill-with-trigger-disable.ts
 */

import { supabaseAdmin } from './server/supabase';
import { isReachedDisposition, isBookedDisposition } from './server/agent-dial-metrics-tracker';

interface BackfillStats {
  processed: number;
  dialed: number;
  reached: number;
  booked: number;
  skipped: number;
  errors: number;
}

async function disableTrigger() {
  console.log('🔧 Disabling trigger...');
  // Try to disable via RPC or direct SQL
  // Note: This might not work via Supabase client, may need to be done manually
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `ALTER TABLE agent_dial_metrics DISABLE TRIGGER trigger_update_live_call_boardt_on_metric_insert;`
    });
    if (error) {
      console.log('⚠️  Cannot disable trigger via API - you may need to run SQL manually');
      console.log('   Run this in Supabase SQL Editor:');
      console.log('   ALTER TABLE agent_dial_metrics DISABLE TRIGGER trigger_update_live_call_boardt_on_metric_insert;');
      return false;
    }
    console.log('✅ Trigger disabled');
    return true;
  } catch (e) {
    console.log('⚠️  Cannot disable trigger via API');
    return false;
  }
}

async function enableTrigger() {
  console.log('🔧 Re-enabling trigger...');
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `ALTER TABLE agent_dial_metrics ENABLE TRIGGER trigger_update_live_call_boardt_on_metric_insert;`
    });
    if (!error) {
      console.log('✅ Trigger re-enabled');
    }
  } catch (e) {
    // Ignore
  }
}

async function backfillDirect() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  console.log('\n🚀 DIRECT BACKFILL: agent_dial_metrics from twilio_call_logs (LAST 2 DAYS)');
  console.log('═'.repeat(70));
  
  // Try to disable trigger first
  const triggerDisabled = await disableTrigger();
  if (!triggerDisabled) {
    console.log('\n⚠️  WARNING: Trigger could not be disabled automatically.');
    console.log('   The backfill will likely fail with "live_call_boardt does not exist" errors.');
    console.log('   You MUST run the SQL fix first: remove-live-call-boardt-trigger.sql\n');
  }

  const stats: BackfillStats = {
    processed: 0,
    dialed: 0,
    reached: 0,
    booked: 0,
    skipped: 0,
    errors: 0
  };

  // Get all outbound calls from twilio_call_logs - last 2 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 2);

  console.log(`📅 Backfilling calls from ${startDate.toISOString()} to now\n`);

  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    console.log(`📊 Fetching batch starting at offset ${offset}...`);
    
    const { data: calls, error } = await supabaseAdmin
      .from('twilio_call_logs')
      .select(`
        id,
        twilio_call_sid,
        owner_email,
        agent_identity,
        to_number,
        from_number,
        call_direction,
        call_status,
        call_duration,
        call_started_at,
        created_at,
        metadata
      `)
      .eq('call_direction', 'outbound')
      .gte('call_started_at', startDate.toISOString())
      .not('to_number', 'is', null)
      .neq('to_number', '')
      .order('call_started_at', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Error fetching calls:', error);
      break;
    }

    if (!calls || calls.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`   Found ${calls.length} calls in this batch\n`);

    for (const call of calls) {
      stats.processed++;
      
      try {
        // Extract agent email
        let agentEmail = call.owner_email || null;
        
        if (!agentEmail && call.agent_identity) {
          const identity = String(call.agent_identity);
          if (identity.startsWith('client:')) {
            agentEmail = identity.replace('client:', '');
          }
        }
        
        if (!agentEmail && call.metadata) {
          try {
            const metadata = typeof call.metadata === 'string' ? JSON.parse(call.metadata) : call.metadata;
            if (metadata.agent_email) {
              agentEmail = metadata.agent_email;
            }
          } catch (e) {
            // Ignore
          }
        }

        if (!agentEmail || !agentEmail.includes('@')) {
          stats.skipped++;
          continue;
        }

        agentEmail = agentEmail.toLowerCase().trim();

        // Get lead phone
        const leadPhone = call.to_number || '';
        const cleanPhone = leadPhone.replace(/\D/g, '');
        
        if (!cleanPhone || cleanPhone.length < 10) {
          stats.skipped++;
          continue;
        }

        // Check if already logged
        const callDate = new Date(call.call_started_at || call.created_at);
        const dayStart = new Date(callDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const { data: existing } = await supabaseAdmin
          .from('agent_dial_metrics')
          .select('id')
          .eq('agent_email', agentEmail)
          .eq('lead_phone', cleanPhone)
          .eq('event_type', 'dial')
          .gte('event_timestamp', dayStart.toISOString())
          .lt('event_timestamp', dayEnd.toISOString())
          .limit(1);

        if (existing && existing.length > 0) {
          stats.skipped++;
          continue;
        }

        // Get call duration and status
        const callDuration = call.call_duration ? parseInt(String(call.call_duration), 10) : 0;
        const callStatus = call.call_status || 'completed';
        
        // Skip if no duration
        if (callDuration <= 0) {
          stats.skipped++;
          continue;
        }

        // Determine disposition
        let disposition: string | null = null;
        if (callStatus === 'completed' || callStatus === 'answered') {
          if (callDuration > 45) {
            disposition = 'contacted';
          } else {
            disposition = 'no_answer';
          }
        } else if (callStatus === 'no-answer' || callStatus === 'no_answer') {
          disposition = 'no_answer';
        } else if (callStatus === 'busy') {
          disposition = 'busy';
        } else if (callStatus === 'failed') {
          disposition = 'failed';
        } else {
          disposition = 'no_answer';
        }

        // Try to get disposition from masterlead
        let leadId = null;
        let leadName = null;
        let leadState = null;
        
        try {
          const { data: lead } = await supabaseAdmin
            .from('masterlead')
            .select('id, cnresolution, first_name, last_name, state, phone, phone_number')
            .or(`phone.eq.${cleanPhone},phone_number.eq.${cleanPhone}`)
            .limit(1)
            .maybeSingle();

          if (lead) {
            leadId = lead.id;
            leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || null;
            leadState = lead.state || null;
            if (lead.cnresolution) {
              disposition = lead.cnresolution;
            }
          }
        } catch (e) {
          // Ignore
        }

        // INSERT DIRECTLY
        const eventTimestamp = call.call_started_at || call.created_at || new Date().toISOString();
        
        // Insert DIAL event
        const dialData = {
          agent_email: agentEmail,
          agent_name: null,
          lead_id: leadId,
          lead_phone: cleanPhone,
          lead_name: leadName,
          lead_state: leadState,
          event_type: 'dial',
          event_timestamp: eventTimestamp,
          call_duration: callDuration,
          call_status: callStatus,
          disposition: disposition,
          call_sid: call.twilio_call_sid || null,
          source: 'twilio_call_logs_backfill',
          notes: `Backfilled from twilio_call_logs on ${new Date().toISOString()}`,
        };

        const { error: dialError } = await supabaseAdmin
          .from('agent_dial_metrics')
          .insert(dialData);

        if (dialError) {
          // Check if it's the trigger error
          if (dialError.message?.includes('live_call_boardt')) {
            console.error(`❌ TRIGGER BLOCKING: ${dialError.message}`);
            console.error(`   You MUST run remove-live-call-boardt-trigger.sql in Supabase first!`);
            stats.errors++;
            continue;
          }
          console.error(`❌ Error inserting dial for call ${call.id}:`, dialError.message);
          stats.errors++;
          continue;
        }

        stats.dialed++;

        // Check if it should be a REACH
        const isReached = callDuration > 45 || isReachedDisposition(disposition, callDuration, callStatus);
        
        if (isReached) {
          const { data: existingReach } = await supabaseAdmin
            .from('agent_dial_metrics')
            .select('id')
            .eq('agent_email', agentEmail)
            .eq('lead_phone', cleanPhone)
            .eq('event_type', 'reach')
            .gte('event_timestamp', dayStart.toISOString())
            .lt('event_timestamp', dayEnd.toISOString())
            .limit(1);

          if (!existingReach || existingReach.length === 0) {
            const reachData = {
              agent_email: agentEmail,
              agent_name: null,
              lead_id: leadId,
              lead_phone: cleanPhone,
              lead_name: leadName,
              lead_state: leadState,
              event_type: 'reach',
              event_timestamp: eventTimestamp,
              call_duration: callDuration,
              call_status: callStatus,
              disposition: disposition,
              call_sid: call.twilio_call_sid || null,
              source: 'twilio_call_logs_backfill',
              notes: `Backfilled from twilio_call_logs on ${new Date().toISOString()}`,
            };

            const { error: reachError } = await supabaseAdmin
              .from('agent_dial_metrics')
              .insert(reachData);

            if (!reachError) {
              stats.reached++;
            }
          }
        }

        // Check if it should be BOOKED
        const isBooked = isBookedDisposition(disposition, callDuration);
        
        if (isBooked) {
          const { data: existingBooked } = await supabaseAdmin
            .from('agent_dial_metrics')
            .select('id')
            .eq('agent_email', agentEmail)
            .eq('lead_phone', cleanPhone)
            .eq('event_type', 'booked')
            .gte('event_timestamp', dayStart.toISOString())
            .lt('event_timestamp', dayEnd.toISOString())
            .limit(1);

          if (!existingBooked || existingBooked.length === 0) {
            const bookedData = {
              agent_email: agentEmail,
              agent_name: null,
              lead_id: leadId,
              lead_phone: cleanPhone,
              lead_name: leadName,
              lead_state: leadState,
              event_type: 'booked',
              event_timestamp: eventTimestamp,
              call_duration: callDuration,
              call_status: callStatus,
              disposition: disposition,
              call_sid: call.twilio_call_sid || null,
              source: 'twilio_call_logs_backfill',
              notes: `Backfilled from twilio_call_logs on ${new Date().toISOString()}`,
            };

            const { error: bookedError } = await supabaseAdmin
              .from('agent_dial_metrics')
              .insert(bookedData);

            if (!bookedError) {
              stats.booked++;
            }
          }
        }

      } catch (error: any) {
        console.error(`❌ Error processing call ${call.id}:`, error.message);
        stats.errors++;
      }

      // Progress update every 50 calls
      if (stats.processed % 50 === 0) {
        console.log(`   Progress: ${stats.processed} processed, ${stats.dialed} dialed, ${stats.reached} reached, ${stats.booked} booked, ${stats.skipped} skipped, ${stats.errors} errors`);
      }
    }

    if (calls.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Re-enable trigger
  if (triggerDisabled) {
    await enableTrigger();
  }

  console.log('\n' + '═'.repeat(70));
  console.log('📊 BACKFILL COMPLETE');
  console.log('═'.repeat(70));
  console.log(`   Processed: ${stats.processed}`);
  console.log(`   Dialed: ${stats.dialed}`);
  console.log(`   Reached: ${stats.reached}`);
  console.log(`   Booked: ${stats.booked}`);
  console.log(`   Skipped: ${stats.skipped} (already logged or invalid)`);
  console.log(`   Errors: ${stats.errors}`);
  console.log('═'.repeat(70));
  
  if (stats.errors > 0 && !triggerDisabled) {
    console.log('\n⚠️  ERRORS DETECTED - Likely due to trigger blocking inserts.');
    console.log('   Run remove-live-call-boardt-trigger.sql in Supabase SQL Editor to fix.');
  }
}

backfillDirect()
  .then(() => {
    console.log('\n✅ Backfill complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
