/**
 * Resend booked leads from CSV file with correct associate_id
 * This uses the associate_id directly from the CSV, not from database lookups
 */

global.fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

async function resendFromCSV() {
  console.log('\n🚀 RESENDING BOOKED LEADS FROM CSV TO ZAPIER WEBHOOK\n');
  console.log('='.repeat(60));

  const csvPath = path.join(process.cwd(), 'planet-webhooks-2025-10-29T22-29-08.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim());

  const results = [];
  let successCount = 0;
  let failCount = 0;

  // Parse CSV (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(',');
    
    if (parts.length < 3) continue;

    const leadId = parts[0];
    const associateId = parts[1];
    const agentEmail = parts[2];
    const leadName = parts[3] || 'N/A';
    
    if (!leadId || !associateId) continue;

    const webhookPayload = {
      lead_id: leadId,
      associate_id: associateId
    };

    const result = {
      lead_id: leadId,
      associate_id: associateId,
      agent_email: agentEmail,
      lead_name: leadName,
      status: 'pending',
      http_status: '',
      response: '',
      error: ''
    };

    try {
      console.log(`[${i}/${lines.length - 1}] 📤 Sending: ${leadName} (${leadId}) → Associate ID: ${associateId}`);

      const webhookResponse = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });

      const responseText = await webhookResponse.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      result.http_status = webhookResponse.status;
      result.response = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);

      if (webhookResponse.ok) {
        console.log(`   ✅ Success (${webhookResponse.status})`);
        result.status = 'success';
        successCount++;
      } else {
        console.log(`   ❌ Failed (${webhookResponse.status}): ${responseText.substring(0, 100)}`);
        result.status = 'failed';
        result.error = responseText.substring(0, 200);
        failCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (webhookError) {
      console.error(`   ❌ Error sending webhook:`, webhookError.message);
      result.status = 'error';
      result.error = webhookError.message;
      failCount++;
    }

    results.push(result);
  }

  // Generate new CSV
  const csvHeader = 'lead_id,associate_id,agent_email,lead_name,status,http_status,response,error\n';
  const csvRows = results.map(r => {
    const escapeCsv = (str) => {
      if (!str) return '';
      const s = String(str);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    
    return [
      escapeCsv(r.lead_id),
      escapeCsv(r.associate_id),
      escapeCsv(r.agent_email),
      escapeCsv(r.lead_name),
      escapeCsv(r.status),
      escapeCsv(r.http_status),
      escapeCsv(r.response),
      escapeCsv(r.error)
    ].join(',');
  }).join('\n');

  const csvOutput = csvHeader + csvRows;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const csvFilename = `planet-webhooks-from-csv-${timestamp}.csv`;
  const csvPath2 = path.join(process.cwd(), csvFilename);

  fs.writeFileSync(csvPath2, csvOutput, 'utf8');

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Leads: ${results.length}`);
  console.log(`   ✅ Successfully Sent: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`\n📄 New CSV Report saved to: ${csvFilename}`);
  console.log(`   Full path: ${csvPath2}`);
  console.log('\n✨ Done!\n');
}

resendFromCSV()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

