/**
 * Script: Scrub ALL Plus Leads Against Federal DNC
 * 
 * Queries ALL plus leads from masterlead and checks them against Federal DNC API.
 * Updates the dnc flag to true for any leads that are on Federal DNC.
 * 
 * Run with: tsx server/scrub-all-plus-leads-federal-dnc.ts
 * 
 * Options:
 *   --batch-size N    Process in batches of N leads (default: 100)
 *   --start-offset N  Start from offset N (for resuming if script stops)
 *   --dry-run         Don't update database, just report what would be updated
 */

import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import { federalDNCService } from './federal-dnc-service';

const args = process.argv.slice(2);
const BATCH_SIZE = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '100', 10);
const START_OFFSET = parseInt(args.find(arg => arg.startsWith('--start-offset='))?.split('=')[1] || '0', 10);
const DRY_RUN = args.includes('--dry-run');

async function scrubAllPlusLeads() {
  console.log('\n🔍 SCRUBBING ALL PLUS LEADS AGAINST FEDERAL DNC\n');
  console.log('='.repeat(80));
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Starting from offset: ${START_OFFSET}`);
  console.log(`Dry run: ${DRY_RUN ? 'YES (no database updates)' : 'NO (will update database)'}\n`);

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  if (!federalDNCService.isConfigured()) {
    console.error('❌ Federal DNC service not configured');
    process.exit(1);
  }

  try {
    // First, get total count of plus leads
    console.log('🔍 Getting total count of plus leads...\n');
    
    const { count: totalCount, error: countError } = await masterleadClient.from('masterlead')
      .select('*', { count: 'exact', head: true })
      .ilike('taalk_market', '%plus%');

    if (countError) {
      console.error('❌ Error counting plus leads:', countError);
      process.exit(1);
    }

    console.log(`✅ Found ${totalCount || 0} total plus leads in database\n`);

    if (!totalCount || totalCount === 0) {
      console.log('⚠️ No plus leads found');
      process.exit(0);
    }

    let offset = START_OFFSET;
    let hasMore = true;
    let totalProcessed = 0;
    let totalOnDNC = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let totalNotOnDNC = 0;

    console.log('🚀 Starting Federal DNC scrubbing...\n');

    while (hasMore) {
      console.log(`📦 Processing batch: offset ${offset}, batch size ${BATCH_SIZE}...`);

      // Query batch of plus leads
      const { data: plusLeads, error } = await masterleadClient.from('masterlead')
        .select('id, taalk_lead_id, first_name, last_name, phone, dnc')
        .ilike('taalk_market', '%plus%')
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error('❌ Error querying plus leads:', error);
        process.exit(1);
      }

      if (!plusLeads || plusLeads.length === 0) {
        console.log('✅ No more plus leads to process');
        hasMore = false;
        break;
      }

      console.log(`   Found ${plusLeads.length} plus leads in this batch\n`);

      // Process each lead
      for (let i = 0; i < plusLeads.length; i++) {
        const lead = plusLeads[i];
        const phone = lead.phone || '';
        const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';
        const rowNumber = offset + i + 1;

        if (!phone) {
          console.log(`[${rowNumber}/${totalCount}] ⏭️ Skipping ${name} (ID ${lead.id}) - no phone number`);
          totalProcessed++;
          continue;
        }

        console.log(`[${rowNumber}/${totalCount}] Checking: ${name} (${phone})`);

        try {
          const dncResult = await federalDNCService.checkDNC(phone);

          if (dncResult.isOnDNC) {
            totalOnDNC++;
            const currentDNC = lead.dnc === true;
            
            if (!currentDNC) {
              // Need to update
              if (!DRY_RUN) {
                const { error: updateError } = await masterleadClient.from('masterlead')
                  .update({ dnc: true, updated_at: new Date().toISOString() })
                  .eq('id', lead.id);

                if (updateError) {
                  console.error(`   ❌ Failed to update DNC flag: ${updateError.message}`);
                  totalErrors++;
                } else {
                  console.log(`   🚫 ON Federal DNC - Updated dnc flag to true`);
                  totalUpdated++;
                }
              } else {
                console.log(`   🚫 ON Federal DNC - Would update dnc flag to true (DRY RUN)`);
                totalUpdated++;
              }
            } else {
              console.log(`   🚫 ON Federal DNC - Already marked as DNC`);
            }
          } else if (dncResult.error) {
            totalErrors++;
            console.log(`   ⚠️ Error: ${dncResult.error}`);
          } else {
            totalNotOnDNC++;
            console.log(`   ✅ NOT on Federal DNC`);
          }

          totalProcessed++;

          // Small delay between requests (service handles rate limiting, but extra safety)
          if (i < plusLeads.length - 1 || hasMore) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }

        } catch (error) {
          totalErrors++;
          console.error(`   ❌ Exception:`, error);
          totalProcessed++;
        }
      }

      offset += BATCH_SIZE;
      hasMore = plusLeads.length === BATCH_SIZE;

      // Progress summary
      console.log(`\n📊 Progress: ${totalProcessed}/${totalCount} processed | On DNC: ${totalOnDNC} | Updated: ${totalUpdated} | Errors: ${totalErrors}\n`);

      // Small delay between batches
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 FINAL SUMMARY\n');
    console.log(`   Total plus leads processed: ${totalProcessed}`);
    console.log(`   🚫 On Federal DNC: ${totalOnDNC}`);
    console.log(`   ✅ NOT on Federal DNC: ${totalNotOnDNC}`);
    console.log(`   📝 Database updates: ${totalUpdated}`);
    console.log(`   ⚠️ Errors: ${totalErrors}`);
    if (DRY_RUN) {
      console.log(`\n   ⚠️ DRY RUN MODE - No database updates were made`);
    }
    console.log('\n✅ Scrubbing completed\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
scrubAllPlusLeads()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });



