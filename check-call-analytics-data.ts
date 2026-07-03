/**
 * Check what data exists in taalk_call_analytics
 */

import { supabaseAdmin } from './server/supabase';

async function checkData() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  console.log('\n🔍 CHECKING taalk_call_analytics DATA\n');
  console.log('═'.repeat(70));

  // Get recent records
  const { data: records, error } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, billing_transaction_id, agent_email, call_date, recording_url, transcript, analysis_status, call_score, taalk_call_id')
    .order('call_date', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Found ${records?.length || 0} recent records\n`);

  if (!records || records.length === 0) {
    console.log('⚠️ NO RECORDS FOUND in taalk_call_analytics!');
    return;
  }

  let hasRecording = 0;
  let hasTranscript = 0;
  let hasAnalysis = 0;
  let hasTaalkId = 0;

  records.forEach((r, i) => {
    const hasRec = !!r.recording_url;
    const hasTrans = !!r.transcript;
    const hasAnal = r.analysis_status === 'completed';
    const hasId = !!r.taalk_call_id;

    if (hasRec) hasRecording++;
    if (hasTrans) hasTranscript++;
    if (hasAnal) hasAnalysis++;
    if (hasId) hasTaalkId++;

    console.log(`${i+1}. Transaction: ${r.billing_transaction_id}`);
    console.log(`   Agent: ${r.agent_email}`);
    console.log(`   Date: ${r.call_date}`);
    console.log(`   Recording: ${hasRec ? '✅ YES' : '❌ NO'}`);
    console.log(`   Transcript: ${hasTrans ? '✅ YES' : '❌ NO'}`);
    console.log(`   Analysis: ${hasAnal ? '✅ YES' : '❌ NO'} (status: ${r.analysis_status}, score: ${r.call_score || 'N/A'})`);
    console.log(`   Taalk ID: ${hasId ? r.taalk_call_id : '❌ NO'}`);
    console.log('');
  });

  console.log('═'.repeat(70));
  console.log('📊 SUMMARY:');
  console.log(`   Total records: ${records.length}`);
  console.log(`   With recording: ${hasRecording}/${records.length}`);
  console.log(`   With transcript: ${hasTranscript}/${records.length}`);
  console.log(`   With analysis: ${hasAnalysis}/${records.length}`);
  console.log(`   With Taalk ID: ${hasTaalkId}/${records.length}`);
  console.log('═'.repeat(70));

  if (hasRecording === 0 || hasTranscript === 0) {
    console.log('\n⚠️ MISSING DATA DETECTED!');
    console.log('   Need to backfill recordings/transcripts from Taalk API');
  }
}

checkData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
