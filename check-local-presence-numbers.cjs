/**
 * Check how many local presence numbers we have
 */

const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const authToken = process.env.TWILIO_AUTH_TOKEN || '974557c999ed53ada16c4a784af2a7d3';

const twilioClient = twilio(accountSid, authToken);

async function checkLocalPresenceNumbers() {
  console.log('\n📞 CHECKING LOCAL PRESENCE NUMBERS\n');
  console.log('='.repeat(60));

  try {
    console.log('🔍 Fetching ALL Twilio phone numbers...\n');
    
    const incomingPhoneNumbers = await twilioClient.incomingPhoneNumbers.list();
    
    console.log(`📊 TOTAL TWILIO NUMBERS: ${incomingPhoneNumbers.length}\n`);
    
    // Group by state
    const stateMap = new Map();
    
    incomingPhoneNumbers.forEach(number => {
      const phoneNumber = number.phoneNumber;
      const friendlyName = number.friendlyName || '';
      
      // Try to extract state from friendly name or use area code lookup
      let state = 'UNKNOWN';
      
      // Check if friendly name has state code (e.g., "TX", "CA", "NY")
      const stateMatch = friendlyName.match(/\b([A-Z]{2})\b/);
      if (stateMatch) {
        state = stateMatch[1];
      }
      
      if (!stateMap.has(state)) {
        stateMap.set(state, []);
      }
      stateMap.get(state).push({
        phone: phoneNumber,
        name: friendlyName,
        sid: number.sid
      });
    });
    
    console.log(`📍 NUMBERS BY STATE:\n`);
    
    const sortedStates = Array.from(stateMap.entries()).sort((a, b) => {
      if (a[0] === 'UNKNOWN') return 1;
      if (b[0] === 'UNKNOWN') return -1;
      return a[0].localeCompare(b[0]);
    });
    
    sortedStates.forEach(([state, numbers]) => {
      console.log(`   ${state}: ${numbers.length} number${numbers.length > 1 ? 's' : ''}`);
      numbers.forEach(num => {
        console.log(`      ${num.phone} - ${num.name || 'No name'}`);
      });
      console.log('');
    });
    
    console.log('='.repeat(60));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Numbers: ${incomingPhoneNumbers.length}`);
    console.log(`   States Covered: ${stateMap.size - (stateMap.has('UNKNOWN') ? 1 : 0)}`);
    console.log(`   Unknown/Unlabeled: ${stateMap.get('UNKNOWN')?.length || 0}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkLocalPresenceNumbers()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

