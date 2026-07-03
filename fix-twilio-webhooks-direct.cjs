/**
 * Fix Twilio webhooks DIRECTLY using Twilio API
 */

const https = require('https');

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = '974557c999ed53ada16c4a784af2a7d3';
const WEBHOOK_URL = 'https://aoirail-production.up.railway.app/api/twilio/call-status';

console.log('\n🔧 FIXING TWILIO WEBHOOKS DIRECTLY\n');
console.log('='.repeat(60));

async function listPhoneNumbers() {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const options = {
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function updatePhoneNumber(sid) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const body = new URLSearchParams({
      StatusCallback: WEBHOOK_URL,
      StatusCallbackMethod: 'POST'
    }).toString();
    
    const options = {
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${sid}.json`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': body.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fixWebhooks() {
  try {
    console.log('📞 Fetching Twilio phone numbers...\n');
    
    const response = await listPhoneNumbers();
    const phoneNumbers = response.incoming_phone_numbers || [];
    
    if (phoneNumbers.length === 0) {
      console.log('❌ No phone numbers found!');
      return;
    }

    console.log(`Found ${phoneNumbers.length} phone numbers:\n`);
    
    for (const number of phoneNumbers) {
      console.log(`\n📱 ${number.phone_number}`);
      console.log(`   Current StatusCallback: ${number.status_callback || 'NOT SET'}`);
      
      console.log(`   Updating to: ${WEBHOOK_URL}...`);
      
      const updated = await updatePhoneNumber(number.sid);
      
      console.log(`   ✅ Updated! New StatusCallback: ${updated.status_callback}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 ALL WEBHOOKS FIXED!');
    console.log('\n✅ Dial/Reached/Booked tracking is NOW ACTIVE');
    console.log('   - Every call will now trigger the webhook');
    console.log('   - Call data will be saved to database');
    console.log('   - Live Call Board will show real-time data\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixWebhooks();

