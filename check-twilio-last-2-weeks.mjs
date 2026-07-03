/**
 * Check Twilio usage for last 2 weeks
 */

import twilio from 'twilio';

// Current credentials from hardcoded-config.ts
const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = '974557c999ed53ada16c4a784af2a7d3';

console.log('\n📊 TWILIO USAGE - LAST 2 WEEKS\n');
console.log('='.repeat(60));

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

try {
  // Get date 2 weeks ago
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
  
  console.log(`\n📅 Period: ${twoWeeksAgo.toLocaleDateString()} to ${now.toLocaleDateString()}\n`);
  
  console.log('🔍 Fetching all calls from last 2 weeks...\n');
  
  // Fetch all calls from last 2 weeks (no limit)
  const calls = await client.calls.list({
    startTimeAfter: twoWeeksAgo,
    limit: 10000 // Get as many as possible
  });
  
  console.log(`📞 Found ${calls.length} total calls\n`);
  
  // Calculate statistics
  let totalSeconds = 0;
  let totalMinutes = 0;
  let completedCalls = 0;
  let failedCalls = 0;
  let noAnswerCalls = 0;
  let busyCalls = 0;
  let inProgressCalls = 0;
  
  const callsByDay = {};
  const callsByStatus = {};
  
  calls.forEach(call => {
    const duration = parseInt(call.duration) || 0;
    totalSeconds += duration;
    totalMinutes += duration / 60;
    
    // Count by status
    const status = call.status;
    callsByStatus[status] = (callsByStatus[status] || 0) + 1;
    
    if (status === 'completed') completedCalls++;
    else if (status === 'failed') failedCalls++;
    else if (status === 'no-answer') noAnswerCalls++;
    else if (status === 'busy') busyCalls++;
    else if (status === 'in-progress') inProgressCalls++;
    
    // Group by day
    const callDate = new Date(call.startTime).toLocaleDateString();
    if (!callsByDay[callDate]) {
      callsByDay[callDate] = {
        count: 0,
        minutes: 0,
        completed: 0
      };
    }
    callsByDay[callDate].count++;
    callsByDay[callDate].minutes += duration / 60;
    if (status === 'completed') callsByDay[callDate].completed++;
  });
  
  console.log('='.repeat(60));
  console.log('\n💰 SUMMARY:\n');
  console.log(`   Total Calls: ${calls.length}`);
  console.log(`   Completed: ${completedCalls} (${((completedCalls / calls.length) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failedCalls}`);
  console.log(`   No Answer: ${noAnswerCalls}`);
  console.log(`   Busy: ${busyCalls}`);
  console.log(`   In Progress: ${inProgressCalls}`);
  console.log('');
  console.log(`   Total Minutes: ${totalMinutes.toFixed(2)} minutes`);
  console.log(`   Total Hours: ${(totalMinutes / 60).toFixed(2)} hours`);
  console.log(`   Total Time: ${Math.floor(totalMinutes / 60)} hours ${Math.floor(totalMinutes % 60)} minutes`);
  console.log('');
  console.log(`   Average Duration: ${completedCalls > 0 ? (totalMinutes / completedCalls).toFixed(2) : 0} minutes/call`);
  console.log(`   Average per Day: ${(calls.length / 14).toFixed(0)} calls/day`);
  console.log(`   Average Minutes/Day: ${(totalMinutes / 14).toFixed(2)} minutes/day`);
  
  // Estimate cost (Twilio averages ~$0.013 per minute for US calls)
  const estimatedCost = totalMinutes * 0.013;
  console.log(`   Estimated Cost: $${estimatedCost.toFixed(2)}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 DAILY BREAKDOWN:\n');
  
  // Sort by date
  const sortedDays = Object.keys(callsByDay).sort((a, b) => new Date(a) - new Date(b));
  
  sortedDays.forEach(date => {
    const stats = callsByDay[date];
    console.log(`   ${date}:`);
    console.log(`      Calls: ${stats.count} (${stats.completed} completed)`);
    console.log(`      Minutes: ${stats.minutes.toFixed(2)}`);
    console.log('');
  });
  
  console.log('='.repeat(60));
  console.log('\n📈 STATUS BREAKDOWN:\n');
  
  Object.entries(callsByStatus)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      const percentage = ((count / calls.length) * 100).toFixed(1);
      console.log(`   ${status.padEnd(15)} ${count.toString().padStart(6)} (${percentage}%)`);
    });
  
  console.log('\n' + '='.repeat(60));
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (error.code) console.error('   Code:', error.code);
  if (error.status) console.error('   Status:', error.status);
}


