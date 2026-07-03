/**
 * COMPREHENSIVE BACKFILL: Agent Dial Metrics from masterlead
 * 
 * This script backfills agent_dial_metrics from masterlead table using the SAME logic
 * as the current logCallOutcome() function, including the new 45-second fallback.
 * 
 * Sources:
 * - masterlead table (cn_email, last_contacted, duration, cnresolution)
 * 
 * Run with: npx tsx backfill-agent-dial-metrics-comprehensive.ts
 */

import { supabaseAdmin } from './server/supabase';
import { isReachedDisposition, isBookedDisposition } from './server/agent-dial-metrics-tracker';

// Configuration: How many days back to backfill (set to null to backfill all)
const DAYS_BACK = 30; // Backfill last 30 days, or set to null for all time
const BATCH_SIZE = 100; // Process in batches

interface BackfillStats {
  processed: number;
  dialed: number;
  reached: number;
  booked: number;
  skipped: number;
  errors: number;
  duplicates: number;
}

/**
 * Check if an event already exists (to avoid duplicates)
 */
async function checkIfEventExists(
  agentEmail: string,
  leadPhone: string,
  eventType: 'dial' | 'reach' | 'booked',
  eventTimestamp: string,
  toleranceSeconds: number = 60 // Allow 60 second tolerance for same-day events
): Promise<boolean> {
  if (!supabaseAdmin) return false;
  
  const cleanPhone = leadPhone.replace(/\D/g, '');
  const eventDate = new Date(eventTimestamp);
  const toleranceMs = toleranceSeconds * 1000;
  const timeStart = new Date(eventDate.getTime() - toleranceMs);
  const timeEnd = new Date(eventDate.getTime() + toleranceMs);
  
  const { data, error } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('id')
    .eq('agent_email', agentEmail.toLowerCase().trim())
    .eq('event_type', eventType)
    .eq('lead_phone', cleanPhone)
    .gte('event_timestamp', timeStart.toISOString())
    .lte('event_timestamp', timeEnd.toISOString())
    .limit(1);
  
  if (error) {
    console.error(`⚠️ Error checking for duplicates:`, error);
    return false; // Continue on error
  }
  
  return (data && data.length > 0);
}

/**
 * Determine if call should be counted as reached (with 45-second fallback)
 */
function shouldCountAsReached(disposition: string | null | undefined, duration: number | null | undefined): boolean {
  // Use the same logic as isReachedDisposition
  let isReached = isReachedDisposition(disposition, duration || undefined, null);
  
  // NEW FALLBACK: If duration > 45 seconds, automatically count as reached
  // This handles cases where agents incorrectly use "no_answer_vm" for calls with human contact
  if (!isReached && duration && duration > 45) {
    console.log(`⚠️ FALLBACK REACH: Disposition=${disposition || 'null'} but duration=${duration}s > 45s - automatically counting as reached`);
    isReached = true;
  }
  
  return isReached;
}

async function backfillFromMasterlead() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin is null - cannot run backfill');
    process.exit(1);
  }

  console.log('🔄 Starting comprehensive backfill of agent_dial_metrics from masterlead...\n');
  
  // Calculate date range
  let startDate: Date | null = null;
  if (DAYS_BACK) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - DAYS_BACK);
    console.log(`📅 Backfilling last ${DAYS_BACK} days (since ${startDate.toISOString()})\n`);
  } else {
    console.log(`📅 Backfilling ALL historical data\n`);
  }

  const stats: BackfillStats = {
    processed: 0,
    dialed: 0,
    reached: 0,
    booked: 0,
    skipped: 0,
    errors: 0,
    duplicates: 0
  };

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`📊 Processing batch starting at offset ${offset}...`);
    
    // Build query
    let query = supabaseAdmin
      .from('masterlead')
      .select('id, first_name, last_name, phone, state, taalk_state, cn_email, cnresolution, last_contacted, duration, duration_after_transfer, updated_at')
      .not('cn_email', 'is', null)
      .neq('cn_email', '')
      .not('last_contacted', 'is', null)
      .order('last_contacted', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);
    
    // Add date filter if specified
    if (startDate) {
      query = query.gte('last_contacted', startDate.toISOString());
    }
    
    const { data: leads, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching leads:', error);
      stats.errors++;
      break;
    }
    
    if (!leads || leads.length === 0) {
      console.log('✅ No more leads to process');
      hasMore = false;
      break;
    }
    
    console.log(`   Found ${leads.length} leads in this batch\n`);
    
    // Process each lead
    for (const lead of leads) {
      try {
        stats.processed++;
        
        // Validate required fields
        if (!lead.cn_email || !lead.phone || !lead.last_contacted) {
          stats.skipped++;
          continue;
        }

        const agentEmail = lead.cn_email.toLowerCase().trim();
        const cleanPhone = String(lead.phone || '').replace(/\D/g, '');
        
        if (!cleanPhone || cleanPhone.length < 10) {
          stats.skipped++;
          continue;
        }

        // Calculate total duration
        const totalDuration = (lead.duration || 0) + (lead.duration_after_transfer || 0);
        const disposition = lead.cnresolution || null;
        const eventTimestamp = lead.last_contacted;
        const leadName = lead.first_name && lead.last_name 
          ? `${lead.first_name} ${lead.last_name}`.trim() 
          : null;
        const leadState = lead.state || lead.taalk_state || null;

        // Only process if we have duration > 0 (actual call was made)
        if (totalDuration <= 0) {
          stats.skipped++;
          continue;
        }

        // Check if dial event already exists
        const dialExists = await checkIfEventExists(agentEmail, cleanPhone, 'dial', eventTimestamp);
        if (dialExists) {
          stats.duplicates++;
          // Still check for reach/booked even if dial exists
        } else {
          // Insert dial event
          const dialData = {
            agent_email: agentEmail,
            lead_id: lead.id,
            lead_phone: cleanPhone,
            lead_name: leadName,
            lead_state: leadState,
            event_type: 'dial',
            event_timestamp: eventTimestamp,
            call_duration: totalDuration,
            disposition: disposition ? disposition.toLowerCase().trim() : null,
            source: 'masterlead_backfill',
            notes: 'Backfilled from masterlead table'
          };

          const { error: dialError } = await supabaseAdmin
            .from('agent_dial_metrics')
            .insert(dialData);

          if (dialError) {
            console.error(`❌ Error inserting dial for lead ${lead.id}:`, dialError);
            stats.errors++;
          } else {
            stats.dialed++;
          }
        }

        // Check if reach event should be created
        const shouldReach = shouldCountAsReached(disposition, totalDuration);
        if (shouldReach) {
          const reachExists = await checkIfEventExists(agentEmail, cleanPhone, 'reach', eventTimestamp);
          if (!reachExists) {
            const reachData = {
              agent_email: agentEmail,
              lead_id: lead.id,
              lead_phone: cleanPhone,
              lead_name: leadName,
              lead_state: leadState,
              event_type: 'reach',
              event_timestamp: eventTimestamp,
              call_duration: totalDuration,
              disposition: disposition ? disposition.toLowerCase().trim() : null,
              source: 'masterlead_backfill',
              notes: totalDuration > 45 && !isReachedDisposition(disposition, totalDuration, null)
                ? `Auto-created reach event (duration=${totalDuration}s > 45s fallback)`
                : 'Backfilled from masterlead table'
            };

            const { error: reachError } = await supabaseAdmin
              .from('agent_dial_metrics')
              .insert(reachData);

            if (reachError) {
              console.error(`❌ Error inserting reach for lead ${lead.id}:`, reachError);
              stats.errors++;
            } else {
              stats.reached++;
            }
          } else {
            stats.duplicates++;
          }
        }

        // Check if booked event should be created
        const shouldBook = isBookedDisposition(disposition, totalDuration);
        if (shouldBook) {
          const bookedExists = await checkIfEventExists(agentEmail, cleanPhone, 'booked', eventTimestamp);
          if (!bookedExists) {
            const bookedData = {
              agent_email: agentEmail,
              lead_id: lead.id,
              lead_phone: cleanPhone,
              lead_name: leadName,
              lead_state: leadState,
              event_type: 'booked',
              event_timestamp: eventTimestamp,
              call_duration: totalDuration,
              disposition: disposition ? disposition.toLowerCase().trim() : null,
              source: 'masterlead_backfill',
              notes: 'Backfilled from masterlead table'
            };

            const { error: bookedError } = await supabaseAdmin
              .from('agent_dial_metrics')
              .insert(bookedData);

            if (bookedError) {
              console.error(`❌ Error inserting booked for lead ${lead.id}:`, bookedError);
              stats.errors++;
            } else {
              stats.booked++;
            }
          } else {
            stats.duplicates++;
          }
        }

        // Progress update every 50 leads
        if (stats.processed % 50 === 0) {
          console.log(`   Processed ${stats.processed} leads: ${stats.dialed} dials, ${stats.reached} reaches, ${stats.booked} booked`);
        }
      } catch (error: any) {
        console.error(`❌ Error processing lead ${lead.id}:`, error);
        stats.errors++;
      }
    }
    
    offset += BATCH_SIZE;
    
    // If we got fewer than BATCH_SIZE, we're done
    if (leads.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(80));
  console.log(`   Leads processed: ${stats.processed}`);
  console.log(`   Dial events created: ${stats.dialed}`);
  console.log(`   Reach events created: ${stats.reached}`);
  console.log(`   Booked events created: ${stats.booked}`);
  console.log(`   Skipped (no data): ${stats.skipped}`);
  console.log(`   Duplicates (already exists): ${stats.duplicates}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log('='.repeat(80));
  console.log('\n✅ Backfill complete!');
}

backfillFromMasterlead()
  .then(() => {
    console.log('\n✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
