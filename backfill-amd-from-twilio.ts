/**
 * Backfill AMD data from Twilio API for existing calls
 * 
 * This checks if Twilio's API has AMD data (answeredBy) for calls that don't have it in our database.
 * Note: This only works if AMD was enabled when the call was made. If AMD wasn't enabled, 
 * Twilio won't have this data either.
 */

import { supabaseAdmin } from './server/supabase';
import { HARDCODED_CONFIG } from './server/hardcoded-config';
import twilio from 'twilio';

const twilioClient = twilio(
  HARDCODED_CONFIG.TWILIO_ACCOUNT_SID,
  HARDCODED_CONFIG.TWILIO_AUTH_TOKEN
);

async function backfillAmdFromTwilio() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  console.log('\n🚀 BACKFILL AMD DATA FROM TWILIO API\n');
  console.log('═'.repeat(70));

  // Get calls from last 30 days that don't have AMD data
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: callsWithoutAmd, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, to_number, owner_email, call_started_at')
    .eq('call_direction', 'outbound')
    .is('answered_by', null)
    .gte('call_started_at', thirtyDaysAgo.toISOString())
    .order('call_started_at', { ascending: false })
    .limit(1000); // Process up to 1000 calls

  if (error) {
    console.error('❌ Error fetching calls:', error);
    return;
  }

  console.log(`📊 Found ${callsWithoutAmd?.length || 0} calls without AMD data\n`);

  if (!callsWithoutAmd || callsWithoutAmd.length === 0) {
    console.log('✅ No calls to process');
    return;
  }

  const stats = {
    processed: 0,
    found: 0,
    notFound: 0,
    errors: 0
  };

  // Process each call
  for (const call of callsWithoutAmd) {
    stats.processed++;

    try {
      // Fetch call details from Twilio API
      const twilioCall = await twilioClient.calls(call.twilio_call_sid).fetch();
      
      // Check if Twilio has AMD data
      // Twilio stores this in the call object if AMD was enabled
      const answeredBy = (twilioCall as any).answeredBy || null;
      
      if (answeredBy) {
        // Update our database with AMD data
        const { error: updateError } = await supabaseAdmin
          .from('twilio_call_logs')
          .update({
            answered_by: answeredBy,
            updated_at: new Date().toISOString()
          })
          .eq('twilio_call_sid', call.twilio_call_sid);

        if (updateError) {
          console.error(`❌ Error updating AMD for ${call.twilio_call_sid}:`, updateError);
          stats.errors++;
        } else {
          stats.found++;
          console.log(`✅ Found AMD: ${call.twilio_call_sid} -> ${answeredBy}`);
        }
      } else {
        stats.notFound++;
        if (stats.notFound <= 10) {
          console.log(`⚠️ No AMD data in Twilio API for ${call.twilio_call_sid} (AMD likely not enabled for this call)`);
        }
      }

      if (stats.processed % 50 === 0) {
        console.log(`\n   Progress: ${stats.processed} processed, ${stats.found} found, ${stats.notFound} not found, ${stats.errors} errors\n`);
      }

      // Rate limit - wait 100ms between API calls
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: any) {
      stats.errors++;
      if (error.code === 20404) {
        // Call not found in Twilio (deleted or too old)
        stats.notFound++;
        if (stats.notFound <= 10) {
          console.log(`⚠️ Call ${call.twilio_call_sid} not found in Twilio API`);
        }
      } else {
        console.error(`❌ Error fetching ${call.twilio_call_sid}:`, error.message);
      }
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('📊 BACKFILL COMPLETE');
  console.log('═'.repeat(70));
  console.log(`   Processed: ${stats.processed}`);
  console.log(`   ✅ Found AMD data: ${stats.found}`);
  console.log(`   ⚠️  No AMD data: ${stats.notFound} (AMD likely not enabled for these calls)`);
  console.log(`   ❌ Errors: ${stats.errors}`);
  console.log('═'.repeat(70));
  console.log('\n💡 Note: AMD data is only available if AMD was enabled when the call was made.');
  console.log('   For calls made before AMD was enabled, this data cannot be retrieved.');
}

backfillAmdFromTwilio()
  .then(() => {
    console.log('\n✅ Backfill complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
