/**
 * Test Script: Test Federal DNC API against Plus Leads
 * 
 * Queries masterlead for plus leads and tests the Federal DNC API against 50 of them.
 * 
 * Run with: tsx server/test-federal-dnc.ts
 */

import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import { federalDNCService } from './federal-dnc-service';

async function testFederalDNC() {
  console.log('\n🧪 TESTING FEDERAL DNC API AGAINST PLUS LEADS\n');
  console.log('='.repeat(80));

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  if (!federalDNCService.isConfigured()) {
    console.error('❌ Federal DNC service not configured');
    process.exit(1);
  }

  try {
    // Query for plus leads
    console.log('\n🔍 Querying masterlead for plus leads...\n');
    
    const { data: allPlusLeads, error } = await masterleadClient.from('masterlead')
      .select('id, taalk_lead_id, first_name, last_name, phone, taalk_market, dnc')
      .ilike('taalk_market', '%plus%')
      .limit(100); // Get more than 50 in case some don't have phone numbers

    if (error) {
      console.error('❌ Error querying plus leads:', error);
      process.exit(1);
    }

    if (!allPlusLeads || allPlusLeads.length === 0) {
      console.log('⚠️ No plus leads found in masterlead table');
      process.exit(0);
    }

    console.log(`✅ Found ${allPlusLeads.length} plus leads in database\n`);

    // Filter to leads with phone numbers and take first 50
    const leadsWithPhones = allPlusLeads
      .filter(lead => lead.phone)
      .slice(0, 50);

    if (leadsWithPhones.length === 0) {
      console.log('⚠️ No plus leads with phone numbers found');
      process.exit(0);
    }

    console.log(`📞 Testing ${leadsWithPhones.length} plus leads against Federal DNC API...\n`);

    let onDNCCount = 0;
    let notOnDNCCount = 0;
    let errorCount = 0;
    const results: Array<{
      id: number;
      name: string;
      phone: string;
      isOnDNC: boolean;
      nationalDNC: string;
      error?: string;
      currentDNC: boolean;
    }> = [];

    for (let i = 0; i < leadsWithPhones.length; i++) {
      const lead = leadsWithPhones[i];
      const phone = lead.phone || '';
      const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';

      console.log(`[${i + 1}/${leadsWithPhones.length}] Testing: ${name} (${phone})`);

      try {
        const dncResult = await federalDNCService.checkDNC(phone);

        const result = {
          id: lead.id,
          name,
          phone,
          isOnDNC: dncResult.isOnDNC,
          nationalDNC: dncResult.nationalDNC,
          error: dncResult.error,
          currentDNC: lead.dnc === true
        };

        results.push(result);

        if (dncResult.isOnDNC) {
          onDNCCount++;
          console.log(`   🚫 ON Federal DNC (current dnc flag: ${lead.dnc === true ? 'true' : 'false'})`);
        } else if (dncResult.error) {
          errorCount++;
          console.log(`   ⚠️ Error: ${dncResult.error}`);
        } else {
          notOnDNCCount++;
          console.log(`   ✅ NOT on Federal DNC`);
        }

        // Small delay between requests (service handles rate limiting, but extra safety)
        if (i < leadsWithPhones.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }

      } catch (error) {
        errorCount++;
        console.error(`   ❌ Exception:`, error);
        results.push({
          id: lead.id,
          name,
          phone,
          isOnDNC: false,
          nationalDNC: '?',
          error: error instanceof Error ? error.message : 'Unknown error',
          currentDNC: lead.dnc === true
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 TEST RESULTS SUMMARY\n');
    console.log(`   Total tested: ${leadsWithPhones.length}`);
    console.log(`   🚫 On Federal DNC: ${onDNCCount}`);
    console.log(`   ✅ NOT on Federal DNC: ${notOnDNCCount}`);
    console.log(`   ⚠️ Errors: ${errorCount}`);

    // Show leads that are on DNC
    const onDNCLeads = results.filter(r => r.isOnDNC);
    if (onDNCLeads.length > 0) {
      console.log(`\n🚫 LEADS ON FEDERAL DNC (${onDNCLeads.length}):\n`);
      onDNCLeads.forEach(lead => {
        console.log(`   - ID ${lead.id}: ${lead.name} (${lead.phone}) - Current DNC flag: ${lead.currentDNC}`);
      });
    }

    // Show leads with errors
    const errorLeads = results.filter(r => r.error && !r.isOnDNC);
    if (errorLeads.length > 0) {
      console.log(`\n⚠️ LEADS WITH ERRORS (${errorLeads.length}):\n`);
      errorLeads.forEach(lead => {
        console.log(`   - ID ${lead.id}: ${lead.name} (${lead.phone}) - Error: ${lead.error}`);
      });
    }

    // Check how many need to be updated (on DNC but not marked as dnc: true)
    const needsUpdate = onDNCLeads.filter(lead => !lead.currentDNC);
    if (needsUpdate.length > 0) {
      console.log(`\n📝 LEADS THAT NEED DNC FLAG UPDATE (${needsUpdate.length}):\n`);
      needsUpdate.forEach(lead => {
        console.log(`   - ID ${lead.id}: ${lead.name} (${lead.phone})`);
      });
    }

    console.log('\n✅ Test completed\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the test
testFederalDNC()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

