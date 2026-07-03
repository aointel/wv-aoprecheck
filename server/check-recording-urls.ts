/**
 * Check the format of recording URLs for 12/1 sessions
 */

import { supabaseAdmin } from './supabase';

async function checkUrls() {
  try {
    const targetDate = '2025-12-01';
    
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, first_name, last_name, recording_url, taalk_call_url')
      .gte('created_at', `${targetDate}T00:00:00.000Z`)
      .lt('created_at', `${targetDate}T23:59:59.999Z`)
      .not('recording_url', 'is', null)
      .limit(10);
    
    if (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
    
    console.log(`📊 Checking ${sessions?.length || 0} sessions with recording_url:\n`);
    
    sessions?.forEach((s, i) => {
      console.log(`${i + 1}. ${s.first_name} ${s.last_name}:`);
      console.log(`   Recording URL: ${s.recording_url?.substring(0, 100)}...`);
      console.log(`   Starts with http: ${s.recording_url?.startsWith('http') ? 'YES ✅' : 'NO ❌'}`);
      console.log(`   Taalk Call URL: ${s.taalk_call_url || 'NONE'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkUrls();
