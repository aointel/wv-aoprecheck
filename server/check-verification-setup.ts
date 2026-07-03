/**
 * Check verification automation setup
 */

import { supabaseAdmin } from './supabase';

async function checkSetup() {
  console.log('🔍 Checking Verification Automation Setup...\n');
  
  // Check 1: IP analysis columns
  console.log('1️⃣ Checking IP analysis columns...');
  try {
    const { data, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('ip_analysis, ip_flag_status, ip_flag_reason')
      .limit(1);
    
    if (error) {
      if (error.message.includes('column') || error.code === '42703') {
        console.log('   ❌ IP analysis columns are MISSING');
        console.log('   ✅ ACTION NEEDED: Run server/ensure-ip-analysis-columns.sql in Supabase SQL Editor\n');
      } else {
        console.log('   ⚠️ Error checking columns:', error.message);
      }
    } else {
      console.log('   ✅ IP analysis columns exist\n');
    }
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Check 2: Sessions with IP data
  console.log('2️⃣ Checking sessions with IP data...');
  try {
    const { count: withIPs } = await supabaseAdmin
      .from('verification_sessions')
      .select('*', { count: 'exact', head: true })
      .not('client_ip_address', 'is', null)
      .not('agent_ip_address', 'is', null);
    
    const { count: withAnalysis } = await supabaseAdmin
      .from('verification_sessions')
      .select('*', { count: 'exact', head: true })
      .not('ip_flag_status', 'is', null);
    
    console.log(`   📊 Sessions with both IPs: ${withIPs || 0}`);
    console.log(`   📊 Sessions with IP analysis: ${withAnalysis || 0}`);
    console.log(`   ${(withIPs || 0) > (withAnalysis || 0) ? '⚠️ Some sessions need IP analysis' : '✅ All IPs analyzed'}\n`);
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Check 3: Sessions with transcripts
  console.log('3️⃣ Checking transcript/summary data...');
  try {
    const { count: withCallId } = await supabaseAdmin
      .from('verification_sessions')
      .select('*', { count: 'exact', head: true })
      .not('taalk_call_id', 'is', null);
    
    const { count: withTranscript } = await supabaseAdmin
      .from('verification_sessions')
      .select('*', { count: 'exact', head: true })
      .not('call_transcript', 'is', null);
    
    const { count: withSummary } = await supabaseAdmin
      .from('verification_sessions')
      .select('*', { count: 'exact', head: true })
      .not('taalk_ai_summary', 'is', null);
    
    console.log(`   📊 Sessions with taalk_call_id: ${withCallId || 0}`);
    console.log(`   📊 Sessions with transcript: ${withTranscript || 0}`);
    console.log(`   📊 Sessions with summary: ${withSummary || 0}`);
    
    const missingTranscript = (withCallId || 0) - (withTranscript || 0);
    const missingSummary = (withCallId || 0) - (withSummary || 0);
    
    if (missingTranscript > 0 || missingSummary > 0) {
      console.log(`   ⚠️ Missing transcripts: ${missingTranscript}, Missing summaries: ${missingSummary}`);
      console.log(`   ✅ Scheduler will fetch these automatically (runs every 15 minutes)\n`);
    } else {
      console.log(`   ✅ All sessions have transcripts and summaries\n`);
    }
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log('✅ Setup check complete!');
}

checkSetup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

