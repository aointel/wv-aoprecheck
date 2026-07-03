/**
 * Fix Twilio webhooks so dial/reached/booked tracking works
 */

const https = require('https');

const url = 'https://aoirail-production.up.railway.app/api/fix-twilio-webhooks';

console.log('\n🔧 FIXING TWILIO WEBHOOKS FOR CALL TRACKING\n');
console.log('='.repeat(60));

const requestBody = JSON.stringify({});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': requestBody.length
  }
};

const req = https.request(url, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('\n✅ WEBHOOK FIX RESULT:\n');
      console.log(JSON.stringify(result, null, 2));
      console.log('\n' + '='.repeat(60));
      console.log('\n🎉 Webhooks should now be configured!');
      console.log('Dial/Reached/Booked tracking will work for new calls.\n');
    } catch (error) {
      console.error('❌ Error parsing response:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
});

req.write(requestBody);
req.end();

