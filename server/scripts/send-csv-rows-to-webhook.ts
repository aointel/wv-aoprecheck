import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

const ZAPIER_REACH_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

async function sendCsvRowsToWebhook(csvFilePath: string, numRows: number = 5): Promise<void> {
  console.log(`📥 Reading CSV file: ${csvFilePath}`);
  
  const rows: any[] = [];
  
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        resolve();
      })
      .on('error', (error) => {
        reject(error);
      });
  });

  console.log(`📊 Found ${rows.length} rows in CSV`);
  console.log(`📤 Sending top ${numRows} rows to Zapier webhook...\n`);

  const rowsToSend = rows.slice(0, numRows);

  for (let i = 0; i < rowsToSend.length; i++) {
    const row = rowsToSend[i];
    const payload = {
      lead_id: row.taalk_lead_id || row.lead_id,
      taalk_lead_id: row.taalk_lead_id || row.lead_id,
      associate_id: Number(row.associate_id),
      agent_email: row.agent_email
    };

    console.log(`📤 Sending row ${i + 1}/${numRows}:`);
    console.log(`   lead_id: ${payload.lead_id}`);
    console.log(`   associate_id: ${payload.associate_id}`);
    console.log(`   agent_email: ${payload.agent_email}`);

    try {
      const response = await fetch(ZAPIER_REACH_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`   ✅ Success\n`);
      } else {
        const body = await response.text().catch(() => '');
        console.error(`   ❌ Failed (${response.status}): ${body.slice(0, 160)}\n`);
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error, '\n');
    }

    // Small delay between requests
    if (i < rowsToSend.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`✅ Sent ${rowsToSend.length} rows to Zapier webhook`);
}

const csvPath = process.argv[2] || 'C:\\dev\\AOIrail\\60s-calls-and-dispositions-2026-02-28T15-37-14.csv';
const numRows = Number(process.argv[3]) || 5;

sendCsvRowsToWebhook(csvPath, numRows)
  .then(() => {
    console.log('\n✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
