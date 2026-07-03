/**
 * Check the state of 12/1 verification sessions to see why recordings might be missing
 */

import { supabaseAdmin } from './supabase';

async function checkSessions() {
  try {
    console.log('🔍 Checking 12/1 verification sessions...\n');
    
    const targetDate = '2025-12-01';
    
    // Get ALL sessions from 12/1
    const { data: allSessions, error: allError } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, first_name, last_name, taalk_call_id, taalk_call_url, recording_url, created_at, status')
      .gte('created_at', `${targetDate}T00:00:00.000Z`)
      .lt('created_at', `${targetDate}T23:59:59.999Z`)
      .order('created_at', { ascending: true });
    
    if (allError) {
      console.error('❌ Database error:', allError);
      process.exit(1);
    }
    
    console.log(`📊 Total 12/1 sessions: ${allSessions?.length || 0}\n`);
    
    if (!allSessions || allSessions.length === 0) {
      console.log('⚠️ No sessions found for 12/1/2025');
      process.exit(0);
    }
    
    // Categorize sessions
    const withCallId = allSessions.filter(s => s.taalk_call_id);
    const withRecordingUrl = allSessions.filter(s => s.recording_url);
    const withTaalkUrl = allSessions.filter(s => s.taalk_call_url);
    const missingBoth = allSessions.filter(s => !s.recording_url && !s.taalk_call_url && s.taalk_call_id);
    
    console.log(`📞 Sessions with taalk_call_id: ${withCallId.length}`);
    console.log(`🔗 Sessions with recording_url: ${withRecordingUrl.length}`);
    console.log(`📁 Sessions with taalk_call_url: ${withTaalkUrl.length}`);
    console.log(`❌ Sessions missing BOTH URLs (but have call_id): ${missingBoth.length}\n`);
    
    if (missingBoth.length > 0) {
      console.log('⚠️ Sessions missing recordings:');
      missingBoth.forEach(s => {
        console.log(`   - ${s.first_name} ${s.last_name} (${s.session_id})`);
        console.log(`     Call ID: ${s.taalk_call_id}`);
        console.log(`     Status: ${s.status}`);
      });
    }
    
    // Show sample of sessions
    console.log('\n📋 Sample of first 5 sessions:');
    allSessions.slice(0, 5).forEach(s => {
      console.log(`\n   ${s.first_name} ${s.last_name}:`);
      console.log(`     Session ID: ${s.session_id}`);
      console.log(`     Taalk Call ID: ${s.taalk_call_id || 'NONE'}`);
      console.log(`     Recording URL: ${s.recording_url ? 'YES' : 'NO'}`);
      console.log(`     Taalk Call URL: ${s.taalk_call_url || 'NONE'}`);
      console.log(`     Status: ${s.status}`);
    });
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkSessions();

