/**
 * Diagnose why AMD isn't being captured for recent calls
 * Run: npx tsx server/scripts/diagnose-amd-issues.ts
 */

import { supabaseAdmin } from '../supabase';
const WEBHOOK_BASE_URL = 'https://aoirail-production.up.railway.app';

async function diagnoseAmdIssues() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured');
    process.exit(1);
  }

  console.log('🔍 Diagnosing AMD Issues...\n');
  console.log('═'.repeat(70));

  // Check webhook URL
  const webhookBaseUrl = WEBHOOK_BASE_URL;
  const amdResultUrl = `${webhookBaseUrl}/api/twilio/amd-result`;
  const amdStatusUrl = `${webhookBaseUrl}/api/twilio/amd-status`;
  
  console.log(`\n📡 Webhook URLs:`);
  console.log(`   AMD Result: ${amdResultUrl}`);
  console.log(`   AMD Status: ${amdStatusUrl}`);

  // Get recent calls without AMD (last 24 hours)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data: recentCalls, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, parent_call_sid, call_started_at, call_duration, call_status, call_direction, from_number, to_number, owner_email, answered_by')
    .gte('call_started_at', yesterday.toISOString())
    .eq('call_direction', 'outbound')
    .order('call_started_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('❌ Error fetching calls:', error);
    return;
  }

  console.log(`\n📊 Recent outbound calls (last 24 hours): ${recentCalls?.length || 0}`);
  
  if (!recentCalls || recentCalls.length === 0) {
    console.log('⚠️  No recent calls found');
    return;
  }

  // Analyze calls
  const callsWithAmd = recentCalls.filter(c => c.answered_by);
  const callsWithoutAmd = recentCalls.filter(c => !c.answered_by);
  
  console.log(`   With AMD: ${callsWithAmd.length}`);
  console.log(`   Without AMD: ${callsWithoutAmd.length}`);

  // Check patterns
  console.log(`\n🔍 Analyzing calls without AMD...`);
  
  // Group by call pattern
  const patterns = {
    hasParent: 0,
    noParent: 0,
    hasToNumber: 0,
    noToNumber: 0,
    completed: 0,
    notCompleted: 0,
  };

  callsWithoutAmd.forEach(call => {
    if (call.parent_call_sid) patterns.hasParent++;
    else patterns.noParent++;
    
    if (call.to_number) patterns.hasToNumber++;
    else patterns.noToNumber++;
    
    if (call.call_status === 'completed') patterns.completed++;
    else patterns.notCompleted++;
  });

  console.log(`\n📊 Patterns in calls without AMD:`);
  console.log(`   Has parent call: ${patterns.hasParent}`);
  console.log(`   No parent call: ${patterns.noParent}`);
  console.log(`   Has to_number: ${patterns.hasToNumber}`);
  console.log(`   No to_number: ${patterns.noToNumber}`);
  console.log(`   Completed: ${patterns.completed}`);
  console.log(`   Not completed: ${patterns.notCompleted}`);

  // Show sample calls
  console.log(`\n📞 Sample calls WITHOUT AMD (first 10):`);
  callsWithoutAmd.slice(0, 10).forEach((call, idx) => {
    console.log(`\n${idx + 1}. Call SID: ${call.twilio_call_sid}`);
    console.log(`   Parent SID: ${call.parent_call_sid || 'N/A'}`);
    console.log(`   From: ${call.from_number || 'N/A'}`);
    console.log(`   To: ${call.to_number || 'N/A'}`);
    console.log(`   Status: ${call.call_status || 'N/A'}`);
    console.log(`   Duration: ${call.call_duration || 'N/A'}s`);
    console.log(`   Started: ${call.call_started_at}`);
    console.log(`   Owner: ${call.owner_email || 'N/A'}`);
    console.log(`   ⚠️  answered_by: ${call.answered_by || 'NULL'}`);
  });

  // Check if calls have matching parent/child relationships
  console.log(`\n🔗 Checking parent/child call relationships...`);
  
  const callsWithParent = callsWithoutAmd.filter(c => c.parent_call_sid);
  if (callsWithParent.length > 0) {
    console.log(`   Found ${callsWithParent.length} calls with parent_call_sid`);
    
    // Check if parent calls exist
    const parentSids = [...new Set(callsWithParent.map(c => c.parent_call_sid))];
    const { data: parentCalls } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid, answered_by')
      .in('twilio_call_sid', parentSids);
    
    const parentCallsWithAmd = parentCalls?.filter(c => c.answered_by) || [];
    console.log(`   Parent calls found: ${parentCalls?.length || 0}`);
    console.log(`   Parent calls with AMD: ${parentCallsWithAmd.length}`);
    
    if (parentCallsWithAmd.length > 0) {
      console.log(`\n   ⚠️  ISSUE: Some parent calls have AMD but child calls don't!`);
      console.log(`   This suggests AMD is being stored on parent calls instead of child calls.`);
    }
  }

  // Check webhook accessibility
  console.log(`\n🌐 Testing webhook URL accessibility...`);
  try {
    const testResponse = await fetch(amdResultUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'test=1'
    });
    console.log(`   AMD Result URL: ${testResponse.status} ${testResponse.statusText}`);
  } catch (error: any) {
    console.log(`   ⚠️  AMD Result URL: Error - ${error.message}`);
  }

  try {
    const testResponse2 = await fetch(amdStatusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'test=1'
    });
    console.log(`   AMD Status URL: ${testResponse2.status} ${testResponse2.statusText}`);
  } catch (error: any) {
    console.log(`   ⚠️  AMD Status URL: Error - ${error.message}`);
  }

  // Recommendations
  console.log(`\n💡 Recommendations:`);
  console.log(`   1. Check server logs for "AMD RESULT WEBHOOK RECEIVED" or "AMD callback received"`);
  console.log(`   2. Verify webhook URLs are accessible from Twilio`);
  console.log(`   3. Check if calls are being logged before AMD webhook fires`);
  console.log(`   4. Verify TwiML includes machineDetection="Enable"`);
  console.log(`   5. Check if asyncAmd is enabled for Call Connector Pro calls`);
  
  console.log(`\n${'═'.repeat(70)}`);
}

diagnoseAmdIssues()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
