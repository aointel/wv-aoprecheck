const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = '974557c999ed53ada16c4a784af2a7d3';

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function checkCall() {
  try {
    console.log('🔍 Looking for calls to: 2542914744');
    
    // Get calls from the last hour
    const calls = await client.calls.list({
      to: '+12542914744',
      limit: 10
    });
    
    console.log(`\n📞 Found ${calls.length} calls to 2542914744:`);
    
    calls.forEach((call, index) => {
      console.log(`\n--- Call ${index + 1} ---`);
      console.log(`SID: ${call.sid}`);
      console.log(`Status: ${call.status}`);
      console.log(`From: ${call.from}`);
      console.log(`To: ${call.to}`);
      console.log(`Duration: ${call.duration} seconds`);
      console.log(`Start Time: ${call.startTime}`);
      console.log(`End Time: ${call.endTime}`);
      console.log(`Direction: ${call.direction}`);
      console.log(`Price: ${call.price} ${call.priceUnit}`);
    });
    
    // If we found calls, get details of the most recent one
    if (calls.length > 0) {
      const mostRecent = calls[0];
      console.log(`\n🔍 Most recent call details:`);
      const fullCall = await client.calls(mostRecent.sid).fetch();
      console.log(JSON.stringify(fullCall, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkCall();


