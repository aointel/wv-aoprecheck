// Simple backfill test script
const http = require('http');

const testBackfill = (dryRun = true) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      limit: 100,
      dryRun: dryRun,
      batchSize: 50
    });

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/twilio-calls/backfill-owner-email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    console.log(`\n🚀 ${dryRun ? 'DRY RUN' : 'REAL RUN'} - Testing backfill endpoint...`);
    console.log(`   URL: http://${options.hostname}:${options.port}${options.path}`);
    console.log(`   Body:`, data);

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          console.log('\n✅ Response received:');
          console.log(JSON.stringify(parsed, null, 2));
          resolve(parsed);
        } catch (e) {
          console.log('\n❌ Failed to parse response:');
          console.log(responseData);
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Request error:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
};

// Run dry run first
testBackfill(true)
  .then(() => {
    console.log('\n\n⚠️  This was a DRY RUN. To actually update, run:');
    console.log('   node backfill-test.js --real');
  })
  .catch(err => {
    console.error('\n❌ Dry run failed:', err);
  });

// If --real flag is passed, also run real update
if (process.argv.includes('--real')) {
  setTimeout(() => {
    console.log('\n\n🔥 Running REAL backfill (will update database)...');
    testBackfill(false)
      .then(() => {
        console.log('\n✅ Real backfill completed!');
      })
      .catch(err => {
        console.error('\n❌ Real backfill failed:', err);
      });
  }, 2000);
}


