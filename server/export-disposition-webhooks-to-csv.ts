/**
 * Script: Export All Disposition Webhooks to CSV
 * 
 * This script queries the masterlead table for all leads with dispositions
 * that would be sent to the Producer Resolutions webhook and exports them to CSV.
 * Processes in batches to handle 80k+ leads efficiently.
 * 
 * Run with: tsx server/export-disposition-webhooks-to-csv.ts
 * 
 * Options:
 *   --batch-size N    Number of leads to process per batch (default: 1000)
 *   --output FILE     Output CSV filename (default: disposition-webhooks.csv)
 */

import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import * as fs from 'fs';
import * as path from 'path';

const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '1000', 10);
const OUTPUT_FILE = process.argv.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'disposition-webhooks.csv';

// Map dispositions to Producer Resolutions format
// 1 = Pres, No Sale | 2 = Pres Refused | 3 = Bad Phone | 4 = Duplicate | 5 = Over Age | 6 = DNC
const dispositionMap: Record<string, number | null> = {
  'booked': 1, // Pres, No Sale - presentation resulted in booking
  'instant_presentation': 1, // Pres, No Sale - presentation happened
  'sale': 1, // Pres, No Sale - presentation happened, resulted in sale
  'call_back': 1, // Pres, No Sale - likely had a presentation, requesting callback
  'callback': 1, // Pres, No Sale - callback requested (alternative spelling)
  'already_been_sold': 1, // Pres, No Sale - presentation happened but already sold
  'not_interested': 2, // Pres Refused - refused presentation
  'wrong_number': 3, // Bad Phone - wrong/bad phone number
  'duplicate': 4, // Duplicate - duplicate lead
  'over_age': 5, // Over Age - over age limit
  'do_not_call': 6, // DNC - do not call
  'dnc': 6, // DNC - do not call (alternative spelling)
};

function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCsvRow(values: any[]): string {
  return values.map(escapeCsvValue).join(',');
}

async function exportDispositionsToCsv() {
  console.log('\n📊 EXPORTING DISPOSITION WEBHOOKS TO CSV\n');
  console.log('='.repeat(80));
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Output file: ${OUTPUT_FILE}\n`);

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  // Create CSV file and write header
  const csvPath = path.join(process.cwd(), OUTPUT_FILE);
  const writeStream = fs.createWriteStream(csvPath, { encoding: 'utf8' });

  // CSV Header
  const header = [
    'taalk_lead_id',
    'code',
    'phone',
    'leadId',
    'lead_id',
    'firstName',
    'lastName',
    'email',
    'city',
    'state',
    'zip',
    'disposition',
    'producerResolution',
    'agentEmail',
    'associateId',
    'callDuration',
    'notes',
    'market',
    'timestamp'
  ];
  
  writeStream.write(formatCsvRow(header) + '\n');
  console.log('✅ CSV header written\n');

  let totalProcessed = 0;
  let totalExported = 0;
  let offset = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`📦 Processing batch starting at offset ${offset}...`);

      // Query batch of leads with dispositions (we'll filter for valid ones in JavaScript)
      const { data: leads, error } = await masterleadClient.from('masterlead')
        .select('*')
        .not('cnresolution', 'is', null)
        .neq('cnresolution', '')
        .neq('cnresolution', 'pending')
        .order('id', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error('❌ Error querying masterlead:', error);
        writeStream.end();
        process.exit(1);
      }

      if (!leads || leads.length === 0) {
        console.log('✅ No more leads to process');
        hasMore = false;
        break;
      }

      console.log(`   Found ${leads.length} leads in this batch`);

      // Process each lead and write to CSV (filter for valid dispositions)
      let batchExported = 0;
      for (const lead of leads) {
        const disposition = lead.cnresolution;
        const producerResolution = dispositionMap[disposition?.toLowerCase()];

        // Skip if disposition doesn't map to a Producer Resolution code
        if (producerResolution === undefined || producerResolution === null) {
          continue;
        }

        batchExported++;

        const trackingPhone = lead.phone || lead.phone_number || '';
        const leadState = lead.state || lead.taalk_state || 'Unknown';
        const trackingName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown Lead';

        const row = [
          lead.taalk_lead_id || lead.taalkLeadId || '',
          producerResolution, // code
          trackingPhone,
          lead.id,
          lead.lead_id || lead.id,
          lead.first_name || '',
          lead.last_name || '',
          lead.email || lead.taalk_email || '',
          lead.city || lead.taalk_city || '',
          leadState,
          lead.zip || lead.taalk_zip || '',
          disposition,
          producerResolution, // producerResolution (backward compatibility)
          lead.cn_email || '',
          lead.associate_id ?? '',
          lead.duration || 0,
          lead.disposition_notes || lead.resolution_notes || '',
          lead?.market || lead?.taalk_market || lead?.taalk_groupname || 'Unknown',
          new Date().toISOString(),
        ];

        writeStream.write(formatCsvRow(row) + '\n');
        totalExported++;
      }

      totalProcessed += leads.length;
      offset += BATCH_SIZE;
      hasMore = leads.length === BATCH_SIZE; // If we got a full batch, there might be more

      console.log(`   ✅ Processed ${leads.length} leads, exported ${batchExported} webhook records from this batch`);
      console.log(`   📊 Total progress: ${totalProcessed} processed, ${totalExported} exported\n`);

      // Small delay between batches to avoid overwhelming the database
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    writeStream.end();
    console.log('='.repeat(80));
    console.log('\n📊 EXPORT COMPLETE\n');
    console.log(`   ✅ Total leads processed: ${totalProcessed}`);
    console.log(`   ✅ Total webhook records exported: ${totalExported}`);
    console.log(`   📄 CSV file: ${csvPath}`);
    console.log(`   💾 File size: ${(fs.statSync(csvPath).size / 1024 / 1024).toFixed(2)} MB\n`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    writeStream.end();
    process.exit(1);
  }
}

// Run the script
exportDispositionsToCsv()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

