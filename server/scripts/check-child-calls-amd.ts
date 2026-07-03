/**
 * Check child calls (actual dials to leads) for AMD data
 * Run: npx tsx server/scripts/check-child-calls-amd.ts
 */

import { supabaseAdmin } from '../supabase';

async function checkChildCalls() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured');
    process.exit(1);
  }

  console.log('🔍 Checking child calls (actual dials to leads) for AMD...\n');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Get calls WITH to_number (these are the actual dials to leads)
  const { data: childCalls, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, parent_call_sid, call_started_at, call_duration, call_status, from_number, to_number, owner_email, answered_by')
    .gte('call_started_at', yesterday.toISOString())
    .eq('call_direction', 'outbound')
    .not('to_number', 'is', null)
    .order('call_started_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Child calls (with to_number) in last 24 hours: ${childCalls?.length || 0}`);

  if (!childCalls || childCalls.length === 0) {
    console.log('⚠️  No child calls found! This is the problem - child calls are not being logged.');
    return;
  }

  const withAmd = childCalls.filter(c => c.answered_by);
  const withoutAmd = childCalls.filter(c => !c.answered_by);

  console.log(`   With AMD: ${withAmd.length}`);
  console.log(`   Without AMD: ${withoutAmd.length}`);

  if (withAmd.length > 0) {
    console.log(`\n✅ Calls WITH AMD (first 5):`);
    withAmd.slice(0, 5).forEach((call, idx) => {
      console.log(`\n${idx + 1}. Call SID: ${call.twilio_call_sid}`);
      console.log(`   Parent: ${call.parent_call_sid || 'N/A'}`);
      console.log(`   To: ${call.to_number}`);
      console.log(`   Answered By: ${call.answered_by}`);
      console.log(`   Status: ${call.call_status}`);
    });
  }

  if (withoutAmd.length > 0) {
    console.log(`\n⚠️  Calls WITHOUT AMD (first 10):`);
    withoutAmd.slice(0, 10).forEach((call, idx) => {
      console.log(`\n${idx + 1}. Call SID: ${call.twilio_call_sid}`);
      console.log(`   Parent: ${call.parent_call_sid || 'N/A'}`);
      console.log(`   To: ${call.to_number}`);
      console.log(`   Status: ${call.call_status}`);
      console.log(`   Duration: ${call.call_duration || 'N/A'}s`);
      console.log(`   Started: ${call.call_started_at}`);
    });
  }

  // Check if parent calls have AMD when child doesn't
  console.log(`\n🔗 Checking if parent calls have AMD when child doesn't...`);
  const childCallsWithoutAmd = childCalls.filter(c => !c.answered_by && c.parent_call_sid);
  
  if (childCallsWithoutAmd.length > 0) {
    const parentSids = [...new Set(childCallsWithoutAmd.map(c => c.parent_call_sid))];
    const { data: parentCalls } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid, answered_by')
      .in('twilio_call_sid', parentSids);
    
    const parentsWithAmd = parentCalls?.filter(c => c.answered_by) || [];
    if (parentsWithAmd.length > 0) {
      console.log(`   ⚠️  Found ${parentsWithAmd.length} parent calls with AMD but child calls without!`);
      console.log(`   This suggests AMD is being stored on parent calls instead of child calls.`);
    } else {
      console.log(`   ✅ No parent calls have AMD when child doesn't.`);
    }
  }
}

checkChildCalls()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
