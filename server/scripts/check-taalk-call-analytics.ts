/**
 * Check taalk_call_analytics table - count rows, verify Supabase connection
 */
import { supabaseAdmin } from '../supabase';

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'NOT SET';
  console.log('Supabase URL:', url.replace(/^https:\/\/([^.]+)\./, 'https://***.'));

  const { count, error: countErr } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('*', { count: 'exact', head: true });
  console.log('taalk_call_analytics count:', countErr ? 'ERROR: ' + countErr.message : count);

  const { count: twilioCount, error: twErr } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('*', { count: 'exact', head: true });
  console.log('twilio_call_logs count:', twErr ? 'ERROR: ' + twErr.message : twilioCount);

  const { data: sample, error: sampleErr } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, billing_transaction_id, call_date')
    .limit(3);
  console.log('Sample rows:', sampleErr ? 'ERROR: ' + sampleErr.message : sample);
}

main().catch(console.error);
