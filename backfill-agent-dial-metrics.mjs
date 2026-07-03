/**
 * BACKFILL AGENT DIAL METRICS FROM MASTERLEAD
 * 
 * This script migrates historical dial/reach/booked data from masterlead
 * to the agent_dial_metrics table so you have historical stats.
 */

import { createClient } from '@supabase/supabase-js';

// Use hardcoded Supabase config (same as server)
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

console.log('✅ Using hardcoded Supabase config');
console.log(`   URL: ${SUPABASE_URL}`);
console.log(`   Key: ${SUPABASE_SERVICE_KEY.substring(0, 30)}...\n`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Determine if a disposition qualifies as "reached" (human contact)
 */
function isReachedDisposition(disposition, status, duration) {
  if (!disposition && !status) return false;
  
  const disp = (disposition || status || '').toLowerCase().trim();
  
  // These dispositions indicate human contact
  const reachedDispositions = [
    'contacted', 'connected', 'talked', 'qualified', 'interested', 
    'not_interested', 'transfer', 'appointment', 'booked', 
    'callback_scheduled', 'call_back', 'callback', 'sale', 'aointel'
  ];
  
  // These dispositions indicate no human contact
  const notReachedDispositions = [
    'no_answer', 'busy', 'failed', 'voicemail', 'bad_number',
    'no_answer_vm', 'no_answer_voicemail', 'pending'
  ];
  
  if (notReachedDispositions.includes(disp)) {
    return false;
  }
  
  if (reachedDispositions.includes(disp)) {
    // If duration is provided and > 0, require at least 15 seconds for "reached"
    // If duration is 0/null/undefined, still count as reached if disposition matches
    if (duration !== undefined && duration !== null && duration > 0) {
      return duration >= 15;
    }
    // If disposition indicates reached and no duration, still count it
    return true;
  }
  
  // Default: if duration >= 15 seconds, consider it reached
  if (duration !== undefined && duration !== null && duration > 0) {
    return duration >= 15;
  }
  
  return false;
}

/**
 * Determine if a disposition qualifies as "booked" (appointment set)
 */
function isBookedDisposition(disposition, status, duration) {
  if (!disposition && !status) return false;
  
  const disp = (disposition || status || '').toLowerCase().trim();
  
  // These dispositions indicate booking/appointment
  const bookedDispositions = [
    'appointment', 'booked', 'qualified', 'callback_scheduled',
    'instant_presentation', 'sale'
  ];
  
  if (bookedDispositions.includes(disp)) {
    // If duration is provided and > 0, require at least 60 seconds for "booked"
    // If duration is 0/null/undefined, still count as booked if disposition matches
    if (duration !== undefined && duration !== null && duration > 0) {
      return duration >= 60;
    }
    // If disposition is 'booked' and no duration, still count it
    return true;
  }
  
  // Special case: "interested" with duration >= 60 seconds
  if (disp === 'interested' && duration !== undefined && duration !== null && duration > 0) {
    return duration >= 60;
  }
  
  return false;
}

async function backfillMetrics() {
  console.log('🔄 Starting backfill of agent_dial_metrics from masterlead...\n');

  let processed = 0;
  let dialed = 0;
  let reached = 0;
  let booked = 0;
  let errors = 0;
  let skipped = 0;

  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`📊 Processing batch: offset ${offset}, batch size ${batchSize}...`);

    // Get leads with last_contacted (these are dialed leads)
    const { data: leads, error: fetchError } = await supabase
      .from('masterlead')
      .select('id, cn_email, phone, first_name, last_name, state, last_contacted, cnresolution, status, duration, duration_after_transfer')
      .not('last_contacted', 'is', null)
      .not('cn_email', 'is', null)
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
          skipped++;
          continue;
        }

        const agentEmail = lead.cn_email.toLowerCase().trim();
        const cleanPhone = String(lead.phone).replace(/\D/g, '');
        
        if (!cleanPhone || cleanPhone.length < 10) {
          skipped++;
          continue;
        }

        const totalDuration = (lead.duration || 0) + (lead.duration_after_transfer || 0);
        const disposition = lead.cnresolution || lead.status || null;
        const eventTimestamp = lead.last_contacted;

        // Always log dial event (they contacted this lead)
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

        const { error: dialError } = await supabase
          .from('agent_dial_metrics')
          .insert(dialData);

        if (dialError) {
          console.error(`❌ Error inserting dial for lead ${lead.id}:`, dialError);
          errors++;
        } else {
          dialed++;
        }

        // Log reach if human contact was made
        if (isReachedDisposition(disposition, lead.status, totalDuration)) {
          const reachData = {
            ...dialData,
            event_type: 'reach',
          };

          const { error: reachError } = await supabase
            .from('agent_dial_metrics')
            .insert(reachData);

          if (reachError) {
            console.error(`❌ Error inserting reach for lead ${lead.id}:`, reachError);
            errors++;
          } else {
            reached++;
          }
        }

        // Log booked if appointment was set
        if (isBookedDisposition(disposition, lead.status, totalDuration)) {
          const bookedData = {
            ...dialData,
            event_type: 'booked',
          };

          const { error: bookedError } = await supabase
            .from('agent_dial_metrics')
            .insert(bookedData);

          if (bookedError) {
            console.error(`❌ Error inserting booked for lead ${lead.id}:`, bookedError);
            errors++;
          } else {
            booked++;
          }
        }

        processed++;

        if (processed % 100 === 0) {
          console.log(`   ✅ Processed ${processed} leads... (dialed: ${dialed}, reached: ${reached}, booked: ${booked})`);
        }

      } catch (error) {
        console.error(`❌ Error processing lead ${lead.id}:`, error);
        errors++;
      }
    }

    offset += batchSize;
    
    if (leads.length < batchSize) {
      hasMore = false;
    }
  }

  console.log('\n✅ Backfill complete!');
  console.log(`📊 Summary:`);
  console.log(`   Total processed: ${processed}`);
  console.log(`   Dial events: ${dialed}`);
  console.log(`   Reach events: ${reached}`);
  console.log(`   Booked events: ${booked}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

// Run the backfill
backfillMetrics().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

