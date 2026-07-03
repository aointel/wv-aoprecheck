/**
 * Backfill script to extract RecordingUrl from metadata and update recording_url column
 * This fixes calls that were logged before the dial-action webhook was fixed
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Import from server config
const { supabaseAdmin } = await import('./server/supabase');

if (!supabaseAdmin) {
  console.error('❌ Failed to initialize supabaseAdmin');
  process.exit(1);
}

async function backfillRecordingUrls() {
  console.log('🔄 Starting backfill of recording URLs from metadata...');
  
  try {
    // Process in batches to avoid memory issues
    let offset = 0;
    const batchSize = 1000;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data: calls, error: fetchError } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, metadata, recording_url')
        .is('recording_url', null)
        .not('metadata', 'is', null)
        .range(offset, offset + batchSize - 1);
      
      if (fetchError) {
        console.error('❌ Error fetching calls:', fetchError);
        break;
      }
      
      if (!calls || calls.length === 0) {
        hasMore = false;
        break;
      }
      
      console.log(`📊 Processing batch: ${offset} to ${offset + calls.length - 1} (${calls.length} calls)`);
      
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      
      for (const call of calls) {
        try {
          let metadata: any = {};
          
          // Parse metadata if it's a string
          if (typeof call.metadata === 'string') {
            try {
              metadata = JSON.parse(call.metadata);
            } catch (e) {
              skipped++;
              continue;
            }
          } else if (typeof call.metadata === 'object' && call.metadata !== null) {
            metadata = call.metadata;
          } else {
            skipped++;
            continue;
          }
          
          // Look for RecordingUrl in metadata (case-insensitive, check various formats)
          const recordingUrl = metadata.RecordingUrl || metadata.recording_url || metadata.RecordingURL || 
                              (metadata.metadata && (metadata.metadata.RecordingUrl || metadata.metadata.recording_url)) || null;
          
          if (!recordingUrl || typeof recordingUrl !== 'string') {
            skipped++;
            continue;
          }
          
          // Update the recording_url column
          const { error: updateError } = await supabaseAdmin
            .from('twilio_call_logs')
            .update({ 
              recording_url: recordingUrl,
              updated_at: new Date().toISOString()
            })
            .eq('twilio_call_sid', call.twilio_call_sid);
          
          if (updateError) {
            console.error(`❌ Failed to update ${call.twilio_call_sid}:`, updateError);
            errors++;
          } else {
            updated++;
            if (updated % 100 === 0) {
              console.log(`   ✅ Updated ${updated} calls in this batch...`);
            }
          }
        } catch (error) {
          console.error(`❌ Error processing ${call.twilio_call_sid}:`, error);
          errors++;
        }
      }
      
      totalUpdated += updated;
      totalSkipped += skipped;
      totalErrors += errors;
      
      console.log(`   Batch complete: Updated=${updated}, Skipped=${skipped}, Errors=${errors}`);
      
      if (calls.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }
    
    console.log('\n📊 Backfill Summary:');
    console.log(`   ✅ Total Updated: ${totalUpdated}`);
    console.log(`   ⏭️  Total Skipped (no RecordingUrl in metadata): ${totalSkipped}`);
    console.log(`   ❌ Total Errors: ${totalErrors}`);
    
  } catch (error) {
    console.error('❌ Fatal error in backfill:', error);
  }
}

// Run the backfill
backfillRecordingUrls()
  .then(() => {
    console.log('✅ Backfill completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  });
