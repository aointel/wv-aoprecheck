/**
 * Fix today's Twilio calls by backfilling missing data from Twilio API
 * - Fetches missing to_number/from_number from Twilio API
 * - Updates call_duration if missing
 * - Updates call_status if incorrect
 * - Processes in batches to avoid timeouts
 */

import { supabaseAdmin } from '../supabase';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';

const BATCH_SIZE = 50; // Process 50 calls at a time

// Initialize Twilio client
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function fixTodaysTwilioCalls() {
  console.log('🚀 Starting fix for last 24 hours of Twilio calls...\n');

  try {
    // Get last 24 hours date range
    const now = new Date();
    const todayEnd = new Date(now);
    const todayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    console.log(`📅 Date range (last 24 hours): ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);
    
    // Step 1: Find calls missing to_number or from_number
    console.log('\n📋 Step 1: Finding calls with missing to_number or from_number...');
    await fixMissingPhoneNumbers(todayStart, todayEnd);
    
    // Step 2: Update call_duration from Twilio API
    console.log('\n📋 Step 2: Updating call_duration from Twilio API...');
    await updateCallDurations(todayStart, todayEnd);
    
    // Step 3: Update call_status from Twilio API
    console.log('\n📋 Step 3: Updating call_status from Twilio API...');
    await updateCallStatuses(todayStart, todayEnd);
    
    // Step 4: Fix parent_call_sid relationships
    console.log('\n📋 Step 4: Fixing parent_call_sid relationships...');
    await fixParentCallRelationships(todayStart, todayEnd);
    
    // Summary
    console.log('\n✅ Fix completed!');
    await printSummary(todayStart, todayEnd);
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
    throw error;
  }
}

async function fixMissingPhoneNumbers(todayStart: Date, todayEnd: Date) {
  // Find calls with missing to_number or from_number
  const { data: calls, error: fetchError } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, twilio_call_sid, to_number, from_number, call_status')
    .gte('call_started_at', todayStart.toISOString())
    .lte('call_started_at', todayEnd.toISOString())
    .or('to_number.is.null,from_number.is.null,to_number.eq.,from_number.eq.');
  
  if (fetchError) {
    console.error('❌ Error fetching calls:', fetchError);
    return;
  }
  
  if (!calls || calls.length === 0) {
    console.log('✅ No calls with missing phone numbers found');
    return;
  }
  
  console.log(`📊 Found ${calls.length} calls with missing phone numbers`);
  
  // Process in batches
  let fixed = 0;
  let failed = 0;
  
  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = calls.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(calls.length / BATCH_SIZE)} (${batch.length} calls)...`);
    
    for (const call of batch) {
      try {
        // Fetch call details from Twilio API
        const twilioCall = await twilioClient.calls(call.twilio_call_sid).fetch();
        
        const updateData: any = {
          updated_at: new Date().toISOString()
        };
        
        // Update to_number if missing
        if (!call.to_number || call.to_number.trim() === '') {
          updateData.to_number = twilioCall.to || null;
          console.log(`  ✅ Fixed to_number for ${call.twilio_call_sid}: ${twilioCall.to}`);
        }
        
        // Update from_number if missing
        if (!call.from_number || call.from_number.trim() === '') {
          updateData.from_number = twilioCall.from || null;
          console.log(`  ✅ Fixed from_number for ${call.twilio_call_sid}: ${twilioCall.from}`);
        }
        
        // Update call_status if available
        if (twilioCall.status) {
          updateData.call_status = twilioCall.status.toLowerCase();
        }
        
        // Update call_duration if available
        if (twilioCall.duration !== null && twilioCall.duration !== undefined) {
          updateData.call_duration = twilioCall.duration;
        }
        
        // Store full Twilio response in metadata
        const metadata = {
          ...(call.metadata || {}),
          twilio_api_response: {
            to: twilioCall.to,
            from: twilioCall.from,
            status: twilioCall.status,
            duration: twilioCall.duration,
            direction: twilioCall.direction,
            startTime: twilioCall.startTime,
            endTime: twilioCall.endTime,
            parentCallSid: twilioCall.parentCallSid,
            fetchedAt: new Date().toISOString()
          }
        };
        updateData.metadata = metadata;
        
        // Update database
        const { error: updateError } = await supabaseAdmin
          .from('twilio_call_logs')
          .update(updateData)
          .eq('id', call.id);
        
        if (updateError) {
          console.warn(`  ⚠️ Error updating call ${call.twilio_call_sid}:`, updateError.message);
          failed++;
        } else {
          fixed++;
        }
        
        // Rate limiting - wait 100ms between API calls
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.warn(`  ⚠️ Error fetching call ${call.twilio_call_sid} from Twilio:`, error.message);
        failed++;
      }
    }
  }
  
  console.log(`✅ Fixed ${fixed} calls, ${failed} failed`);
}

async function updateCallDurations(todayStart: Date, todayEnd: Date) {
  // Find calls with missing or zero duration
  const { data: calls, error: fetchError } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, twilio_call_sid, call_duration')
    .gte('call_started_at', todayStart.toISOString())
    .lte('call_started_at', todayEnd.toISOString())
    .or('call_duration.is.null,call_duration.eq.0');
  
  if (fetchError) {
    console.error('❌ Error fetching calls:', fetchError);
    return;
  }
  
  if (!calls || calls.length === 0) {
    console.log('✅ No calls with missing duration found');
    return;
  }
  
  console.log(`📊 Found ${calls.length} calls with missing or zero duration`);
  
  // Process in batches
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = calls.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(calls.length / BATCH_SIZE)} (${batch.length} calls)...`);
    
    for (const call of batch) {
      try {
        // Fetch call details from Twilio API
        const twilioCall = await twilioClient.calls(call.twilio_call_sid).fetch();
        
        if (twilioCall.duration !== null && twilioCall.duration !== undefined && twilioCall.duration > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('twilio_call_logs')
            .update({
              call_duration: twilioCall.duration,
              updated_at: new Date().toISOString()
            })
            .eq('id', call.id);
          
          if (updateError) {
            console.warn(`  ⚠️ Error updating duration for ${call.twilio_call_sid}:`, updateError.message);
            failed++;
          } else {
            updated++;
            console.log(`  ✅ Updated duration for ${call.twilio_call_sid}: ${twilioCall.duration}s`);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.warn(`  ⚠️ Error fetching call ${call.twilio_call_sid} from Twilio:`, error.message);
        failed++;
      }
    }
  }
  
  console.log(`✅ Updated ${updated} call durations, ${failed} failed`);
}

async function updateCallStatuses(todayStart: Date, todayEnd: Date) {
  // Find calls that might have incorrect status
  const { data: calls, error: fetchError } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, twilio_call_sid, call_status')
    .gte('call_started_at', todayStart.toISOString())
    .lte('call_started_at', todayEnd.toISOString())
    .in('call_status', ['initiated', 'ringing']); // Only update calls that are still in progress states
  
  if (fetchError) {
    console.error('❌ Error fetching calls:', fetchError);
    return;
  }
  
  if (!calls || calls.length === 0) {
    console.log('✅ No calls with pending status found');
    return;
  }
  
  console.log(`📊 Found ${calls.length} calls with pending status`);
  
  // Process in batches
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = calls.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(calls.length / BATCH_SIZE)} (${batch.length} calls)...`);
    
    for (const call of batch) {
      try {
        // Fetch call details from Twilio API
        const twilioCall = await twilioClient.calls(call.twilio_call_sid).fetch();
        
        if (twilioCall.status && twilioCall.status.toLowerCase() !== call.call_status?.toLowerCase()) {
          const { error: updateError } = await supabaseAdmin
            .from('twilio_call_logs')
            .update({
              call_status: twilioCall.status.toLowerCase(),
              updated_at: new Date().toISOString()
            })
            .eq('id', call.id);
          
          if (updateError) {
            console.warn(`  ⚠️ Error updating status for ${call.twilio_call_sid}:`, updateError.message);
            failed++;
          } else {
            updated++;
            console.log(`  ✅ Updated status for ${call.twilio_call_sid}: ${call.call_status} -> ${twilioCall.status.toLowerCase()}`);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.warn(`  ⚠️ Error fetching call ${call.twilio_call_sid} from Twilio:`, error.message);
        failed++;
      }
    }
  }
  
  console.log(`✅ Updated ${updated} call statuses, ${failed} failed`);
}

async function fixParentCallRelationships(todayStart: Date, todayEnd: Date) {
  // Find calls with missing parent_call_sid that might be child calls
  const { data: calls, error: fetchError } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, twilio_call_sid, parent_call_sid, from_number')
    .gte('call_started_at', todayStart.toISOString())
    .lte('call_started_at', todayEnd.toISOString())
    .is('parent_call_sid', null)
    .like('from_number', 'client:%'); // WebRTC calls that might be parent calls
  
  if (fetchError) {
    console.error('❌ Error fetching calls:', fetchError);
    return;
  }
  
  if (!calls || calls.length === 0) {
    console.log('✅ No parent calls found to check for children');
    return;
  }
  
  console.log(`📊 Found ${calls.length} potential parent calls to check`);
  
  // Process in batches
  let fixed = 0;
  let failed = 0;
  
  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = calls.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(calls.length / BATCH_SIZE)} (${batch.length} calls)...`);
    
    for (const parentCall of batch) {
      try {
        // Fetch child calls from Twilio API
        const childCalls = await twilioClient.calls.list({
          parentCallSid: parentCall.twilio_call_sid,
          limit: 20
        });
        
        if (childCalls && childCalls.length > 0) {
          for (const childCall of childCalls) {
            // Update child call with parent_call_sid
            const { error: updateError } = await supabaseAdmin
              .from('twilio_call_logs')
              .update({
                parent_call_sid: parentCall.twilio_call_sid,
                updated_at: new Date().toISOString()
              })
              .eq('twilio_call_sid', childCall.sid);
            
            if (updateError) {
              console.warn(`  ⚠️ Error updating child call ${childCall.sid}:`, updateError.message);
              failed++;
            } else {
              fixed++;
              console.log(`  ✅ Linked child call ${childCall.sid} to parent ${parentCall.twilio_call_sid}`);
            }
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.warn(`  ⚠️ Error fetching child calls for ${parentCall.twilio_call_sid}:`, error.message);
        failed++;
      }
    }
  }
  
  console.log(`✅ Fixed ${fixed} parent-child relationships, ${failed} failed`);
}

async function printSummary(todayStart: Date, todayEnd: Date) {
  const { count: totalCalls } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('*', { count: 'exact', head: true })
    .gte('call_started_at', todayStart.toISOString())
    .lte('call_started_at', todayEnd.toISOString());
  
  const { count: withToNumber } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('*', { count: 'exact', head: true })
    .gte('call_started_at', todayStart.toISOString())
    .lte('call_started_at', todayEnd.toISOString())
    .not('to_number', 'is', null)
    .neq('to_number', '');
  
  const { count: withDuration } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('*', { count: 'exact', head: true })
    .gte('call_started_at', todayStart.toISOString())
    .lte('call_started_at', todayEnd.toISOString())
    .not('call_duration', 'is', null)
    .gt('call_duration', 0);
  
  const { count: withParent } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('*', { count: 'exact', head: true })
    .gte('call_started_at', todayStart.toISOString())
    .lte('call_started_at', todayEnd.toISOString())
    .not('parent_call_sid', 'is', null);
  
  console.log('\n📊 Summary for today:');
  console.log(`  Total calls: ${totalCalls || 0}`);
  console.log(`  Calls with to_number: ${withToNumber || 0} (${Math.round(((withToNumber || 0) / (totalCalls || 1)) * 100)}%)`);
  console.log(`  Calls with duration: ${withDuration || 0} (${Math.round(((withDuration || 0) / (totalCalls || 1)) * 100)}%)`);
  console.log(`  Calls with parent_call_sid: ${withParent || 0} (${Math.round(((withParent || 0) / (totalCalls || 1)) * 100)}%)`);
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fix-todays-twilio-calls.ts');
if (isMainModule) {
  fixTodaysTwilioCalls()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { fixTodaysTwilioCalls };
