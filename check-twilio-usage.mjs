/**
 * Check Twilio usage and total minutes
 */

import twilio from 'twilio';

// Current credentials from hardcoded-config.ts
const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

console.log('\n📊 CHECKING TWILIO USAGE...\n');
console.log('='.repeat(60));

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

try {
  // Get today's date range
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  // Get this month's date range
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  console.log(`\n🗓️  Today: ${today.toLocaleDateString()}`);
  console.log(`📅 Month: ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}\n`);
  
  // Fetch usage records for voice calls
  console.log('🔍 Fetching voice call usage...\n');
  
  const usageRecords = await client.usage.records.list({
    category: 'calls',
    limit: 50
  });
  
  if (usageRecords.length === 0) {
    console.log('❌ No usage records found');
  } else {
    console.log('📊 USAGE SUMMARY:\n');
    
    let totalMinutes = 0;
    let totalCalls = 0;
    let totalCost = 0;
    
    usageRecords.forEach(record => {
      const minutes = parseFloat(record.usage) || 0;
      const count = parseInt(record.count) || 0;
      const price = parseFloat(record.price) || 0;
      
      totalMinutes += minutes;
      totalCalls += count;
      totalCost += Math.abs(price);
      
      console.log(`   Period: ${record.startDate} to ${record.endDate}`);
      console.log(`   Category: ${record.category}`);
      console.log(`   Minutes: ${minutes.toFixed(2)}`);
      console.log(`   Calls: ${count}`);
      console.log(`   Cost: $${Math.abs(price).toFixed(2)}`);
      console.log('');
    });
    
    console.log('='.repeat(60));
    console.log('\n💰 TOTALS:');
    console.log(`   Total Minutes: ${totalMinutes.toFixed(2)} minutes`);
    console.log(`   Total Hours: ${(totalMinutes / 60).toFixed(2)} hours`);
    console.log(`   Total Calls: ${totalCalls}`);
    console.log(`   Total Cost: $${totalCost.toFixed(2)}`);
    console.log('');
  }
  
  // Get call records from today
  console.log('='.repeat(60));
  console.log('\n📞 TODAY\'S CALL DETAILS:\n');
  
  const todaysCalls = await client.calls.list({
    startTimeAfter: startOfToday,
    limit: 100
  });
  
  console.log(`   Total calls today: ${todaysCalls.length}`);
  
  if (todaysCalls.length > 0) {
    let todayMinutes = 0;
    let completedCalls = 0;
    
    todaysCalls.forEach(call => {
      const duration = parseInt(call.duration) || 0;
      todayMinutes += duration / 60; // Convert seconds to minutes
      if (call.status === 'completed') completedCalls++;
    });
    
    console.log(`   Completed calls: ${completedCalls}`);
    console.log(`   Total minutes: ${todayMinutes.toFixed(2)} minutes`);
    console.log(`   Average duration: ${completedCalls > 0 ? (todayMinutes / completedCalls).toFixed(2) : 0} minutes/call`);
    console.log('');
    
    // Show recent calls
    console.log('   Recent calls:');
    todaysCalls.slice(0, 10).forEach((call, i) => {
      const duration = parseInt(call.duration) || 0;
      console.log(`   ${i + 1}. ${call.to} - ${call.status} - ${(duration / 60).toFixed(2)} min - ${new Date(call.startTime).toLocaleTimeString()}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (error.code) console.error('   Code:', error.code);
  if (error.status) console.error('   Status:', error.status);
}


