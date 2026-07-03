import twilio from 'twilio';

// USE HARDCODED CREDENTIALS (since env vars aren't set)
const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = '974557c999ed53ada16c4a784af2a7d3';
const TWILIO_PHONE_NUMBER = '+19142289324';

// Initialize Twilio client
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function sendTestSMS() {
  try {
    console.log('🔍 Testing Twilio SMS functionality...');
    console.log('📱 Sending test message to: +1 (503) 201-8470');
    
    const message = await client.messages.create({
      body: '🧪 ConnectNow SMS Test - Twilio is working properly! Timestamp: ' + new Date().toLocaleString(),
      from: TWILIO_PHONE_NUMBER,
      to: '+15032018470'
    });

    console.log('✅ SMS sent successfully!');
    console.log('📧 Message SID:', message.sid);
    console.log('📊 Message status:', message.status);
    console.log('💰 Message price:', message.price);
    console.log('🔗 From number:', message.from);
    console.log('📞 To number:', message.to);
    
    return message;
    
  } catch (error) {
    console.error('❌ SMS send failed:', error.message);
    console.error('📋 Error code:', error.code);
    console.error('🔍 Full error:', error);
    throw error;
  }
}

// Run the test
sendTestSMS()
  .then(() => {
    console.log('🎉 SMS test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 SMS test failed');
    process.exit(1);
  });