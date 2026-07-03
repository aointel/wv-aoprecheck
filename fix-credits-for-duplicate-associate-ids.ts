/**
 * Fix credits_used for all duplicate associate_ids
 * Finds billing transactions for each duplicate associate_id and updates user_credits
 */

import { supabaseAdmin } from './server/supabase';

async function fixCreditsForDuplicates() {
  console.log(`🔧 Fixing credits_used for duplicate associate_ids\n`);
  console.log('='.repeat(70));

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  try {
    // Get ALL customers with associate_id (no limit)
    console.log('📊 Fetching ALL customers with associate_id...\n');
    
    let allCustomers: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: customers, error: fetchError } = await supabaseAdmin
        .from('customers')
        .select('id, associate_id, company_email, personal_email')
        .not('associate_id', 'is', null)
        .order('associate_id', { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (fetchError) {
        console.error('❌ Error fetching customers:', fetchError);
        return;
      }

      if (!customers || customers.length === 0) {
        hasMore = false;
        break;
      }

      allCustomers.push(...customers);
      console.log(`   Fetched ${allCustomers.length} customers so far...`);

      if (customers.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    console.log(`\n📊 Found ${allCustomers.length} total customers with associate_id\n`);

    // Group by associate_id to find duplicates
    const associateIdMap = new Map<number, Array<{
      id: string;
      associate_id: number;
      company_email: string | null;
      personal_email: string | null;
    }>>();

    allCustomers.forEach(c => {
      const associateId = Number(c.associate_id);
      if (!associateId) return;

      if (!associateIdMap.has(associateId)) {
        associateIdMap.set(associateId, []);
      }

      associateIdMap.get(associateId)!.push({
        id: c.id,
        associate_id: associateId,
        company_email: c.company_email,
        personal_email: c.personal_email
      });
    });

    // Process ALL associate_ids (not just duplicates) to ensure credits are correct
    const allAssociateIds = Array.from(associateIdMap.entries())
      .sort((a, b) => a[0] - b[0]);

    console.log(`📊 Processing ${allAssociateIds.length} associate_ids to fix credits_used\n`);

    let totalUpdated = 0;
    let totalErrors = 0;
    let totalSkipped = 0;
    let totalCreditsProcessed = 0;

    // Process each associate_id
    for (const [associateId, records] of allAssociateIds) {
      if (totalUpdated % 100 === 0 && totalUpdated > 0) {
        console.log(`\n📊 Progress: ${totalUpdated} updated, ${totalSkipped} skipped, ${totalErrors} errors...`);
      }

      // Only log details for duplicates or every 50th record
      const isDuplicate = records.length > 1;
      const shouldLog = isDuplicate || associateId % 50 === 0;

      if (shouldLog) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`\n🔍 Processing associate_id ${associateId} (${records.length} record${records.length > 1 ? 's - DUPLICATE!' : ''})`);
      }

      // Collect all unique emails for this associate_id
      const emails = new Set<string>();
      records.forEach(r => {
        if (r.company_email) emails.add(r.company_email);
        if (r.personal_email) emails.add(r.personal_email);
      });

      const emailArray = Array.from(emails);
      if (shouldLog) {
        console.log(`   📧 Found ${emailArray.length} unique email(s): ${emailArray.join(', ')}`);
      }

      if (emailArray.length === 0) {
        if (shouldLog) {
          console.log(`   ⚠️ No emails found for associate_id ${associateId}, skipping...`);
        }
        totalSkipped++;
        continue;
      }

      // Find all billing transactions for these emails
      const { data: transactions, error: txError } = await supabaseAdmin
        .from('billing_transactions')
        .select('*')
        .in('agent_email', emailArray);

      if (txError) {
        console.error(`   ❌ Error fetching billing transactions: ${txError.message}`);
        totalErrors++;
        continue;
      }

      if (!transactions || transactions.length === 0) {
        if (shouldLog) {
          console.log(`   ℹ️ No billing transactions found for associate_id ${associateId}`);
        }
        totalSkipped++;
        continue;
      }

      if (shouldLog) {
        console.log(`   📊 Found ${transactions.length} billing transaction(s)`);
      }

      // Calculate total credits used
      const totalCreditsUsed = transactions.reduce((sum, tx) => {
        // Count each transaction as 1 credit (or use actual credit amount if available)
        return sum + 1;
      }, 0);

      const aoiConnectCreditsUsed = transactions.filter(tx => 
        tx.billing_transaction_id?.startsWith('connect-') || 
        tx.billing_transaction_id?.startsWith('twilio-')
      ).length;

      if (shouldLog) {
        console.log(`   💰 Total credits used: ${totalCreditsUsed} (AOI Connect: ${aoiConnectCreditsUsed})`);
      }

      // Use the primary email (first company_email, or first personal_email)
      const primaryEmail = records.find(r => r.company_email)?.company_email || 
                          records.find(r => r.personal_email)?.personal_email ||
                          emailArray[0];

      if (!primaryEmail) {
        if (shouldLog) {
          console.log(`   ⚠️ No primary email found for associate_id ${associateId}, skipping...`);
        }
        totalSkipped++;
        continue;
      }

      if (shouldLog) {
        console.log(`   📧 Using primary email: ${primaryEmail}`);
      }

      // Get or create user_credits record
      const { data: existingCredits, error: creditsFetchError } = await supabaseAdmin
        .from('user_credits')
        .select('*')
        .eq('email', primaryEmail)
        .maybeSingle();

      if (creditsFetchError && creditsFetchError.code !== 'PGRST116') {
        console.error(`   ❌ Error fetching user_credits: ${creditsFetchError.message}`);
        totalErrors++;
        continue;
      }

      if (existingCredits) {
        // Update existing record
        const { error: updateError } = await supabaseAdmin
          .from('user_credits')
          .update({ credits_used: totalCreditsUsed })
          .eq('email', primaryEmail);

        if (updateError) {
          console.error(`   ❌ Error updating user_credits: ${updateError.message}`);
          totalErrors++;
          continue;
        }

        if (shouldLog || existingCredits.credits_used !== totalCreditsUsed) {
          console.log(`   ✅ Updated user_credits for ${primaryEmail}: ${existingCredits.credits_used} → ${totalCreditsUsed}`);
        }

        // Only verify if there was a change
        if (existingCredits.credits_used !== totalCreditsUsed) {
          const { data: verifyCredits } = await supabaseAdmin
            .from('user_credits')
            .select('credits_used, credits_remaining')
            .eq('email', primaryEmail)
            .single();

          if (verifyCredits && shouldLog) {
            console.log(`   ✅ Verified: credits_used=${verifyCredits.credits_used}, credits_remaining=${verifyCredits.credits_remaining}`);
          }
        }
      } else {
        // Create new record
        const { error: insertError } = await supabaseAdmin
          .from('user_credits')
          .insert({
            email: primaryEmail,
            credits_used: totalCreditsUsed,
            credits_total: 0 // Will need to be set separately
          });

        if (insertError) {
          console.error(`   ❌ Error creating user_credits: ${insertError.message}`);
          totalErrors++;
          continue;
        }

        if (shouldLog) {
          console.log(`   ✅ Created user_credits for ${primaryEmail}: credits_used=${totalCreditsUsed}`);
        }
      }

      totalUpdated++;
      totalCreditsProcessed += totalCreditsUsed;
    }

    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total associate_ids processed: ${allAssociateIds.length}`);
    console.log(`   Successfully updated: ${totalUpdated}`);
    console.log(`   Skipped (no transactions): ${totalSkipped}`);
    console.log(`   Errors: ${totalErrors}`);
    console.log(`   Total credits processed: ${totalCreditsProcessed}`);
    console.log(`\n${'='.repeat(70)}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

fixCreditsForDuplicates()
  .then(() => {
    console.log('\n✅ Credits fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Credits fix failed:', error);
    process.exit(1);
  });
