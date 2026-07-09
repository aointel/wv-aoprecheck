const https = require('https');
const ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

function twilioGet(path) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
    const url = new URL(`https://api.twilio.com${path}`);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const data = await twilioGet(`/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json?Direction=outbound-api&StartTime>=${TODAY}&PageSize=5`);
  console.log('Sample calls:');
  (data.calls || []).forEach((c, i) => {
    console.log(`\nCall ${i+1}:`);
    Object.entries(c).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  });
}
run().catch(console.error);
