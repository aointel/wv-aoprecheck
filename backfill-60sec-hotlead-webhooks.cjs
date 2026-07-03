require('dotenv').config();
const { Client } = require('pg');

// Connect to PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function backfillHotleadWebhooks() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Find all hotlead calls over 60 seconds that haven't been processed
    const query = `
      SELECT 
        tcl.id,
        tcl.twilio_call_sid,
        tcl.owner_email,
        tcl.to_number,
        tcl.call_duration,
        tcl.call_status,
        tcl.call_started_at,
        ml.taalk_lead_id,
        ml.first_name,
        ml.last_name,
        pl.associate_id
      FROM twilio_call_logs tcl
      LEFT JOIN masterlead ml ON ml.lead_number = tcl.to_number
      LEFT JOIN producerlist pl ON pl.company_email = tcl.owner_email
      WHERE tcl.call_duration >= 60
        AND tcl.call_status = 'completed'
        AND ml.source_table = 'hotleads'
        AND ml.taalk_lead_id IS NOT NULL
        AND pl.associate_id IS NOT NULL
        AND tcl.call_started_at >= NOW() - INTERVAL '7 days'
      ORDER BY tcl.call_started_at DESC
    `;

    console.log('🔍 Searching for hotlead calls over 60 seconds...');
    const result = await client.query(query);
    
    console.log(`\n📊 Found ${result.rows.length} calls over 60 seconds`);

    if (result.rows.length === 0) {
      console.log('✅ No calls to process');
      return;
    }

    console.log('\n🚀 Sending webhooks...\n');

    let successCount = 0;
    let failCount = 0;

    for (const call of result.rows) {
      const webhookPayload = {
        lead_id: call.taalk_lead_id,
        associate_id: call.associate_id
      };

      console.log(`📤 Call ${call.twilio_call_sid} (${call.call_duration}s) - ${call.first_name} ${call.last_name}`);
      console.log(`   Agent: ${call.owner_email} (${call.associate_id})`);
      console.log(`   Payload:`, JSON.stringify(webhookPayload));

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

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 SUMMARY:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📈 Total: ${result.rows.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

backfillHotleadWebhooks();

