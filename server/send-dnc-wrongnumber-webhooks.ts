/**
 * Script: Send All Disposition Webhooks to Zapier
 * 
 * Queries masterlead table directly for all leads with dispositions
 * and sends each to the Producer Resolutions webhook.
 * Sends all disposition codes (1, 2, 3, 4, 5, 6) - not just DNC and Wrong Number.
 * Includes rate limiting to respect Zapier limits (100 requests/min typical).
 * 
 * Run with: tsx server/send-dnc-wrongnumber-webhooks.ts
 * 
 * Options:
 *   --delay-ms N      Delay between requests in milliseconds (default: 700ms = ~85 requests/min)
 *   --batch-size N    Number of requests per batch before longer pause (default: 50)
 *   --batch-delay N   Delay after each batch in seconds (default: 2)
 *   --db-batch N      Number of leads to fetch from database per batch (default: 1000)
 *   --start-offset N  Start from database offset N (for resuming if script stops)
 */

import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";

const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/15730596/um82e8j/';

// Parse command line arguments
const args = process.argv.slice(2);
const DELAY_MS = parseInt(args.find(arg => arg.startsWith('--delay-ms='))?.split('=')[1] || '700', 10);
const BATCH_SIZE = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50', 10);
const BATCH_DELAY_SEC = parseInt(args.find(arg => arg.startsWith('--batch-delay='))?.split('=')[1] || '2', 10);
const DB_BATCH_SIZE = parseInt(args.find(arg => arg.startsWith('--db-batch='))?.split('=')[1] || '1000', 10);
const START_OFFSET = parseInt(args.find(arg => arg.startsWith('--start-offset='))?.split('=')[1] || '0', 10);

// Map dispositions to Producer Resolutions format
// 1 = Pres, No Sale | 2 = Pres Refused | 3 = Bad Phone | 4 = Duplicate | 5 = Over Age | 6 = DNC
const dispositionMap: Record<string, number | null> = {
  'booked': 1, // Pres, No Sale - presentation resulted in booking
  'instant_presentation': 1, // Pres, No Sale - presentation happened
  'sale': 1, // Pres, No Sale - presentation happened, resulted in sale
  'call_back': 1, // Pres, No Sale - likely had a presentation, requesting callback
  'callback': 1, // Pres, No Sale - callback requested (alternative spelling)
  'already_been_sold': 1, // Pres, No Sale - presentation happened but already sold
  'Meet': 1, // Pres, No Sale - meeting scheduled
  'not_interested': 2, // Pres Refused - refused presentation
  'wrong_number': 3, // Bad Phone - wrong/bad phone number
  'duplicate': 4, // Duplicate - duplicate lead
  'over_age': 5, // Over Age - over age limit
  'do_not_call': 6, // DNC - do not call
  'dnc': 6, // DNC - do not call (alternative spelling)
};

interface WebhookPayload {
  taalk_lead_id: string;
  code: number;
  phone: string;
  leadId: string;
  lead_id: string;
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  state: string;
  zip: string;
  disposition: string;
  producerResolution: number;
  agentEmail: string;
  associateId: string;
  callDuration: number;
  notes: string;
  market: string;
  timestamp: string;
}

async function sendWebhook(payload: WebhookPayload): Promise<boolean> {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return true;
    } else {
      const errorText = await response.text();
      console.error(`   ❌ Webhook failed: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error sending webhook:`, error);
    return false;
  }
}

function leadToPayload(lead: any): WebhookPayload | null {
  const disposition = lead.cnresolution;
  const producerResolution = dispositionMap[disposition?.toLowerCase()];

  // Skip if disposition doesn't map to a Producer Resolution code
  if (producerResolution === undefined || producerResolution === null) {
    return null;
  }

  const trackingPhone = lead.phone || lead.phone_number || '';
  const leadState = lead.state || lead.taalk_state || 'Unknown';

  return {
    taalk_lead_id: lead.taalk_lead_id || lead.taalkLeadId || '',
    code: producerResolution,
    phone: trackingPhone,
    leadId: lead.id.toString(),
    lead_id: lead.lead_id?.toString() || lead.id.toString(),
    firstName: lead.first_name || '',
    lastName: lead.last_name || '',
    email: lead.email || lead.taalk_email || '',
    city: lead.city || lead.taalk_city || '',
    state: leadState,
    zip: lead.zip || lead.taalk_zip || '',
    disposition: disposition,
    producerResolution: producerResolution,
    agentEmail: lead.cn_email || '',
    associateId: lead.associate_id ?? '',
    callDuration: lead.duration || 0,
    notes: lead.disposition_notes || lead.resolution_notes || '',
    market: lead?.market || lead?.taalk_market || lead?.taalk_groupname || 'Unknown',
    timestamp: new Date().toISOString(),
  };
}

async function sendWebhooksFromMasterlead() {
  console.log('\n📤 SENDING ALL DISPOSITION WEBHOOKS TO ZAPIER\n');
  console.log('='.repeat(80));
  console.log(`Querying masterlead table directly`);
  console.log(`Delay between requests: ${DELAY_MS}ms (~${Math.round(60000 / DELAY_MS)} requests/min)`);
  console.log(`Batch size: ${BATCH_SIZE} requests`);
  console.log(`Batch delay: ${BATCH_DELAY_SEC} seconds`);
  console.log(`Database batch size: ${DB_BATCH_SIZE} leads`);
  console.log(`Starting from offset: ${START_OFFSET}\n`);

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let processedCount = 0;
  let totalLeadsProcessed = 0;
  let offset = START_OFFSET;
  let hasMore = true;
  let requestIndex = 0; // For rate limiting batches

  console.log('🚀 Starting webhook sends...\n');

  try {
    while (hasMore) {
      console.log(`📦 Fetching leads from database (offset ${offset}, batch size ${DB_BATCH_SIZE})...`);

      // Query batch of leads with dispositions
      const { data: leads, error } = await masterleadClient.from('masterlead')
        .select('*')
        .not('cnresolution', 'is', null)
        .neq('cnresolution', '')
        .neq('cnresolution', 'pending')
        .order('id', { ascending: true })
        .range(offset, offset + DB_BATCH_SIZE - 1);

      if (error) {
        console.error('❌ Error querying masterlead:', error);
        process.exit(1);
      }

      if (!leads || leads.length === 0) {
        console.log('✅ No more leads to process');
        hasMore = false;
        break;
      }

      console.log(`   Found ${leads.length} leads in this batch\n`);

      // Process each lead and send webhook
      for (const lead of leads) {
        const payload = leadToPayload(lead);

        if (!payload) {
          skipCount++;
          totalLeadsProcessed++;
          continue;
        }

        const leadName = `${payload.firstName} ${payload.lastName}`.trim() || 'Unknown';
        const rowNumber = totalLeadsProcessed + 1;

        console.log(`[${rowNumber}] Sending: ${leadName} (${payload.phone}) - Code ${payload.code} (${payload.disposition})`);

        const success = await sendWebhook(payload);

        if (success) {
          successCount++;
          console.log(`   ✅ Success`);
        } else {
          failCount++;
        }

        processedCount++;
        totalLeadsProcessed++;
        requestIndex++;

        // Rate limiting: delay between requests
        // Batch pause: longer delay after every BATCH_SIZE requests
        if (requestIndex % BATCH_SIZE === 0) {
          console.log(`\n⏸️  Batch complete (${processedCount} processed). Pausing for ${BATCH_DELAY_SEC} seconds...\n`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_SEC * 1000));
        } else {
          // Regular delay between requests
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      offset += DB_BATCH_SIZE;
      hasMore = leads.length === DB_BATCH_SIZE; // If we got a full batch, there might be more

      // Small delay between database batches to avoid overwhelming the database
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 FINAL SUMMARY\n');
    console.log(`   ✅ Successfully sent: ${successCount}`);
    console.log(`   ⏭️  Skipped (no mapping): ${skipCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📦 Total leads processed: ${totalLeadsProcessed}`);
    console.log(`   📤 Total webhooks sent: ${processedCount}`);
    if (processedCount > 0) {
      console.log(`   📈 Success rate: ${((successCount / processedCount) * 100).toFixed(2)}%\n`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
sendWebhooksFromMasterlead()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
