/**
 * Fix reached events by pulling from twilio_call_logs directly
 * 
 * This script finds all calls in twilio_call_logs that:
 * - Have call_status = 'completed' or 'answered'
 * - Have call_duration >= 50 seconds
 * - Creates reach events in agent_dial_metrics for these calls
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

async function fixReachedFromTwilioLogs() {
  console.log('🔍 Creating reach events from twilio_call_logs...\n');
  console.log('   Criteria: call_status = completed/answered AND call_duration >= 50 seconds\n');

  const requiredDuration = 50; // Must be >= 50 seconds
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  try {
    // Fetch all calls from twilio_call_logs that meet the criteria in batches
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: twilioCalls, error: fetchError } = await supabase
        .from('twilio_call_logs')
        .select('twilio_call_sid, call_duration, call_status, owner_email, to_number, call_started_at, parent_call_sid')
        .in('call_status', ['completed', 'answered'])
        .gte('call_duration', requiredDuration)
        .order('call_started_at', { ascending: false })
        .range(from, from + batchSize - 1);

      if (fetchError) {
        console.error(`❌ Error fetching Twilio calls:`, fetchError);
        break;
      }

      if (!twilioCalls || twilioCalls.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`📊 Processing batch: ${from + 1} to ${from + twilioCalls.length} of Twilio calls...`);

      for (const call of twilioCalls) {
        totalProcessed++;

        if (totalProcessed % 100 === 0) {
          console.log(`   Progress: ${totalProcessed} processed, ${totalCreated} created, ${totalSkipped} skipped`);
        }

        try {
          // Handle WebRTC parent/child calls
          // Parent calls have no to_number, child calls have to_number and parent_call_sid
          // We want the child calls (they have the actual dialed number and duration)
          if (!call.to_number || call.to_number.trim() === '') {
            // This is a parent call - skip it, we'll process the child calls
            totalSkipped++;
            continue;
          }
          
          // If this is a child call, use it directly (it has the actual call data)

          // Normalize phone number
          const normalizedPhone = call.to_number?.replace(/\D/g, '') || '';
          if (!normalizedPhone) {
            totalSkipped++;
            continue;
          }

          // Find the lead by phone number
          const phoneVariations = [
            call.to_number,
            `+1${normalizedPhone}`,
            `+${normalizedPhone}`,
            normalizedPhone,
            `1${normalizedPhone}`
          ];

          const { data: lead, error: leadError } = await supabase
            .from('masterlead')
            .select('id, phone, cn_email, first_name, last_name, state, taalk_state, cnresolution')
            .in('phone', phoneVariations)
            .limit(1)
            .maybeSingle();

          if (leadError || !lead) {
            // No lead found - skip
            totalSkipped++;
            continue;
          }

          // Check if there's already a reach event for this call (by call_sid)
          const { data: existingReach, error: reachCheckError } = await supabase
            .from('agent_dial_metrics')
            .select('id, call_sid, call_duration')
            .eq('call_sid', call.twilio_call_sid)
            .eq('event_type', 'reach')
            .limit(1);

          if (reachCheckError) {
            console.error(`❌ Error checking for reach event for call ${call.twilio_call_sid}:`, reachCheckError);
            totalErrors++;
            continue;
          }

          // If we already have a reach event for this call_sid with valid duration, skip
          if (existingReach && existingReach.length > 0) {
            const reachEvent = existingReach[0];
            if (reachEvent.call_duration && reachEvent.call_duration >= requiredDuration) {
              totalSkipped++;
              continue;
            }
          }

          // Check if there's already a reach event for this lead with valid duration
          const { data: existingReachByLead, error: leadReachError } = await supabase
            .from('agent_dial_metrics')
            .select('id, call_duration, event_timestamp')
            .eq('lead_id', lead.id)
            .eq('event_type', 'reach')
            .gte('call_duration', requiredDuration)
            .order('event_timestamp', { ascending: false })
            .limit(1);

          if (!leadReachError && existingReachByLead && existingReachByLead.length > 0) {
            // Check if this call is more recent than the existing reach event
            const existingTimestamp = new Date(existingReachByLead[0].event_timestamp || 0);
            const callTimestamp = new Date(call.call_started_at || 0);
            
            // If existing reach is more recent or same, skip
            if (existingTimestamp >= callTimestamp) {
              totalSkipped++;
              continue;
            }
          }

          // Create reach event
          const { error: insertError } = await supabase
            .from('agent_dial_metrics')
            .insert({
              agent_email: call.owner_email,
              agent_name: null,
              lead_id: lead.id,
              lead_phone: lead.phone,
              lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || null,
              lead_state: lead.state || lead.taalk_state || null,
              event_type: 'reach',
              disposition: lead.cnresolution || 'connected',
              call_duration: call.call_duration,
              call_status: call.call_status,
              call_sid: call.twilio_call_sid,
              source: 'twilio_call_logs',
              notes: `Reach event created from twilio_call_logs (duration: ${call.call_duration}s)`,
              event_timestamp: call.call_started_at || new Date().toISOString()
            });

          if (insertError) {
            console.error(`❌ Error creating reach event for call ${call.twilio_call_sid}:`, insertError);
            totalErrors++;
          } else {
            totalCreated++;
            if (totalCreated % 50 === 0) {
              console.log(`   ✅ Created ${totalCreated} reach events so far...`);
            }
          }

        } catch (error) {
          console.error(`❌ Error processing call ${call.twilio_call_sid}:`, error);
          totalErrors++;
        }
      }

      from += batchSize;
      if (twilioCalls.length < batchSize) {
        hasMore = false;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY:');
    console.log(`   Total Twilio calls processed: ${totalProcessed}`);
    console.log(`   ✅ Reach events created: ${totalCreated}`);
    console.log(`   ⏭️  Skipped (already exists or no lead): ${totalSkipped}`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log('='.repeat(60));

    // Recalculate live call board stats
    if (totalCreated > 0) {
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

fixReachedFromTwilioLogs()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
