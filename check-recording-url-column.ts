/**
 * Verify twilio_call_logs.recording_url column exists.
 * Run this to confirm the migration was applied. If not, run add-recording-url-column-twilio-call-logs.sql
 */
import { supabaseAdmin } from './server/supabase';

async function main() {
  const { data, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('recording_url')
    .limit(1);
  if (error) {
    if (error.message?.includes('recording_url') || error.code === '42703') {
      console.error('❌ Column twilio_call_logs.recording_url does NOT exist.');
      console.error('   Run: add-recording-url-column-twilio-call-logs.sql');
      console.error('   Example: psql $DATABASE_URL -f add-recording-url-column-twilio-call-logs.sql');
      process.exit(1);
    }
    console.error('❌ Error checking column:', error);
    process.exit(1);
  }
  console.log('✅ twilio_call_logs.recording_url column exists.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
