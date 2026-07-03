require('dotenv').config();
const { Client } = require('pg');
const fetch = require('node-fetch');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function backfillWebhooks() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Find all calls over 60 seconds to hotleads in the last 7 days
    const query = `
      SELECT 
        cl.id,
        cl.taalk_lead_id,
        cl.agent_email,
        cl.duration,
        cl.disposition,
        cl.created_at,
        ml.first_name,
        ml.last_name,
        pl.associate_id
      FROM call_logs cl
      LEFT JOIN masterlead ml ON ml.taalk_lead_id = cl.taalk_lead_id
      LEFT JOIN producerlist pl ON pl.company_email = cl.agent_email
      WHERE cl.duration >= 60
        AND ml.source_table = 'hotleads'
        AND cl.taalk_lead_id IS NOT NULL
        AND pl.associate_id IS NOT NULL
        AND cl.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY cl.created_at DESC
    `;

    console.log('🔍 Searching for hotlead calls over 60 seconds...');
    const result = await client.query(query);
    
    console.log(`\n📊 Found ${result.rows.length} calls\n`);

    if (result.rows.length === 0) {
      console.log('✅ No calls to process');
      await client.end();
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const call of result.rows) {
      const webhookPayload = {
        lead_id: call.taalk_lead_id,
        associate_id: call.associate_id
      };

      console.log(`📤 ${call.first_name} ${call.last_name} (${call.taalk_lead_id})`);
      console.log(`   Agent: ${call.agent_email} → ${call.associate_id}`);
      console.log(`   Duration: ${call.duration}s`);

      try {
        const response = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
          },
          body: JSON.stringify(webhookPayload)
        });

        if (response.ok) {
          console.log(`   ✅ SUCCESS\n`);
          successCount++;
        } else {
          const errorText = await response.text();
          console.log(`   ❌ FAILED: ${response.status} - ${errorText}\n`);
          failCount++;
        }
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}\n`);
        failCount++;
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 BACKFILL COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📈 Total: ${result.rows.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
    console.log('✅ Closed database connection');
  }
}

backfillWebhooks();

