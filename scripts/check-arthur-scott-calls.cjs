/**
 * CHECK ARTHUR SCOTT CALL CONNECTOR PRO CALLS
 * 
 * This script counts how many calls Arthur Scott has made on Call Connector Pro
 * in the last week, separated by day.
 * 
 * Usage:
 *   node scripts/check-arthur-scott-calls.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load environment variables from multiple possible locations
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '.env.production'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

// Try to load from hardcoded-config.ts
let SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// If not found, try to read from hardcoded-config.ts directly
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  const hardcodedConfigPath = path.join(__dirname, '..', 'server', 'hardcoded-config.ts');
  
  if (fs.existsSync(hardcodedConfigPath)) {
    try {
      const configContent = fs.readFileSync(hardcodedConfigPath, 'utf-8');
      
      // Extract SUPABASE_URL (simple regex match)
      const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
      if (urlMatch && !SUPABASE_URL) {
        SUPABASE_URL = urlMatch[1];
      }
      
      // Extract SUPABASE_SERVICE_KEY (simple regex match)
      const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
      if (keyMatch && !SUPABASE_SERVICE_KEY) {
        SUPABASE_SERVICE_KEY = keyMatch[1];
      }
    } catch (e) {
      // Ignore if can't parse
    }
  }
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials.');
  console.error('   Options:');
  console.error('   1. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file');
  console.error('   2. Export as environment variables before running');
  console.error('   Example: VITE_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node script.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkArthurScottCalls() {
  try {
    const agentEmail = 'arthurscott@aoglobelife.com';
    
    // Calculate date range (last 7 days)
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    console.log(`\n📞 Checking Call Connector Pro calls for: ${agentEmail}`);
    console.log(`📅 Date range: ${sevenDaysAgo.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}\n`);
    
    // Query agent_dial_metrics for dial events in the last 7 days
    const { data: calls, error } = await supabase
      .from('agent_dial_metrics')
      .select('event_timestamp, event_type, lead_phone, lead_name')
      .eq('agent_email', agentEmail)
      .eq('event_type', 'dial') // Only count dial events (not reach/booked)
      .gte('event_timestamp', sevenDaysAgo.toISOString())
      .lte('event_timestamp', today.toISOString())
      .order('event_timestamp', { ascending: true });
    
    if (error) {
      console.error('❌ Error querying agent_dial_metrics:', error);
      return;
    }
    
    if (!calls || calls.length === 0) {
      console.log('ℹ️  No calls found in the last 7 days.');
      return;
    }
    
    console.log(`✅ Found ${calls.length} total dial events\n`);
    
    // Group calls by day
    const callsByDay = {};
    
    calls.forEach(call => {
      const callDate = new Date(call.event_timestamp);
      const dateKey = callDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!callsByDay[dateKey]) {
        callsByDay[dateKey] = [];
      }
      callsByDay[dateKey].push(call);
    });
    
    // Sort days
    const sortedDays = Object.keys(callsByDay).sort();
    
    // Display results
    console.log('='.repeat(70));
    console.log('📊 CALLS BY DAY:');
    console.log('='.repeat(70));
    console.log();
    
    let totalCalls = 0;
    sortedDays.forEach(day => {
      const dayCalls = callsByDay[day];
      const count = dayCalls.length;
      totalCalls += count;
      
      // Format day name
      const dateObj = new Date(day);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      
      console.log(`📅 ${day} (${dayName}): ${count} calls`);
      
      // Optionally show first few calls per day
      if (dayCalls.length <= 5) {
        dayCalls.forEach((call, idx) => {
          const time = new Date(call.event_timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          console.log(`   ${idx + 1}. ${time} - ${call.lead_name || 'N/A'} (${call.lead_phone || 'N/A'})`);
        });
      } else {
        const firstCall = new Date(dayCalls[0].event_timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const lastCall = new Date(dayCalls[dayCalls.length - 1].event_timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        console.log(`   First call: ${firstCall}, Last call: ${lastCall}`);
      }
      console.log();
    });
    
    console.log('='.repeat(70));
    console.log(`📊 TOTAL CALLS IN LAST 7 DAYS: ${totalCalls}`);
    console.log(`📊 AVERAGE PER DAY: ${(totalCalls / sortedDays.length).toFixed(1)}`);
    console.log('='.repeat(70));
    console.log();
    
    // Check for duplicates (same phone number called multiple times)
    // Exclude duplicates within 20 minutes (likely redials/retries)
    console.log('='.repeat(70));
    console.log('🔍 DUPLICATE CALL ANALYSIS (excluding calls within 20 min):');
    console.log('='.repeat(70));
    console.log();
    
    const phoneCallDetails = {};
    const phoneCallCounts = {};
    
    // Group calls by phone number
    calls.forEach(call => {
      const phone = call.lead_phone || 'UNKNOWN';
      if (!phoneCallDetails[phone]) {
        phoneCallDetails[phone] = [];
        phoneCallCounts[phone] = 0;
      }
      phoneCallDetails[phone].push({
        timestamp: call.event_timestamp,
        leadName: call.lead_name || 'N/A',
        date: new Date(call.event_timestamp)
      });
    });
    
    // Sort each phone's calls by timestamp
    Object.keys(phoneCallDetails).forEach(phone => {
      phoneCallDetails[phone].sort((a, b) => a.date - b.date);
    });
    
    // Filter out calls within 20 minutes (count as separate calls)
    const TWENTY_MINUTES_MS = 20 * 60 * 1000;
    const significantDuplicates = [];
    let totalSignificantDuplicateCalls = 0;
    
    Object.entries(phoneCallDetails).forEach(([phone, callList]) => {
      if (callList.length === 1) {
        phoneCallCounts[phone] = 1;
        return; // Single call, not a duplicate
      }
      
      // Filter calls: keep first call, then only calls that are > 20 min apart from previous
      const significantCalls = [callList[0]]; // Always keep first call
      let lastKeptCall = callList[0];
      
      for (let i = 1; i < callList.length; i++) {
        const currentCall = callList[i];
        const timeDiff = currentCall.date - lastKeptCall.date;
        
        if (timeDiff > TWENTY_MINUTES_MS) {
          significantCalls.push(currentCall);
          lastKeptCall = currentCall;
        }
      }
      
      phoneCallCounts[phone] = significantCalls.length;
      
      // If still has duplicates after filtering, add to significant duplicates list
      if (significantCalls.length > 1) {
        significantDuplicates.push([phone, significantCalls.length, significantCalls]);
        totalSignificantDuplicateCalls += significantCalls.length;
      }
    });
    
    // Sort by count descending
    significantDuplicates.sort((a, b) => b[1] - a[1]);
    
    const uniquePhones = Object.keys(phoneCallDetails).length;
    const duplicatePhones = significantDuplicates.length;
    const firstTimeCalls = totalCalls - totalSignificantDuplicateCalls + duplicatePhones;
    const actualDuplicates = totalSignificantDuplicateCalls - duplicatePhones; // Calls beyond the first one
    
    console.log(`📞 Unique phone numbers called: ${uniquePhones}`);
    console.log(`🔄 Phone numbers called multiple times (>20 min apart): ${duplicatePhones}`);
    console.log(`📊 Total calls to duplicate phones (after filtering): ${totalSignificantDuplicateCalls}`);
    console.log(`✅ First-time calls (unique): ${firstTimeCalls}`);
    console.log(`❌ Significant duplicate calls (>20 min apart): ${actualDuplicates}`);
    console.log();
    
    if (significantDuplicates.length > 0) {
      console.log('📋 TOP 10 MOST CALLED PHONES (>20 min apart):');
      console.log('-'.repeat(70));
      significantDuplicates.slice(0, 10).forEach(([phone, count, callList], idx) => {
        const firstCall = callList[0].date;
        const lastCall = callList[callList.length - 1].date;
        const totalOriginalCalls = phoneCallDetails[phone].length;
        console.log(`${idx + 1}. ${phone} (${callList[0].leadName}): ${count} calls (${totalOriginalCalls} total, ${totalOriginalCalls - count} filtered as <20 min)`);
        console.log(`   First: ${firstCall.toLocaleString()}, Last: ${lastCall.toLocaleString()}`);
        const hoursBetween = (lastCall - firstCall) / (1000 * 60 * 60);
        if (hoursBetween < 24) {
          console.log(`   Hours between: ${hoursBetween.toFixed(1)} hours`);
        } else {
          console.log(`   Days between: ${Math.round((lastCall - firstCall) / (1000 * 60 * 60 * 24))} days`);
        }
        console.log();
      });
    }
    
    console.log('='.repeat(70));
    console.log(`📊 SUMMARY:`);
    console.log(`   Total calls: ${totalCalls}`);
    console.log(`   Unique leads: ${uniquePhones}`);
    console.log(`   Duplicate calls: ${actualDuplicates} (${((actualDuplicates / totalCalls) * 100).toFixed(1)}%)`);
    console.log('='.repeat(70));
    console.log();
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
checkArthurScottCalls();

