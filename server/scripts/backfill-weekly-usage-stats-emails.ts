/**
 * Backfill script to fix numeric emails in weekly_usage_stats table
 * Maps numeric emails (e.g., 103021@aoglobelife.com) to real emails (e.g., lindagojcaj@aoglobelife.com)
 * 
 * Run with: tsx server/scripts/backfill-weekly-usage-stats-emails.ts
 */

import { supabaseAdmin } from '../supabase';

async function backfillWeeklyUsageStatsEmails() {
  console.log('🔄 Starting backfill of weekly_usage_stats emails...\n');
  
  try {
    // Step 1: Find all numeric emails in weekly_usage_stats
    console.log('📊 Step 1: Finding numeric emails in weekly_usage_stats...');
    
    const { data: allStats, error: fetchError } = await supabaseAdmin
      .from('weekly_usage_stats')
      .select('agent_email, week_start_date')
      .limit(50000);
    
    if (fetchError) {
      console.error('❌ Error fetching weekly_usage_stats:', fetchError);
      return;
    }
    
    if (!allStats || allStats.length === 0) {
      console.log('⚠️ No records found in weekly_usage_stats');
      return;
    }
    
    console.log(`✅ Found ${allStats.length} total records in weekly_usage_stats`);
    
    // Identify numeric emails
    const numericEmails = new Set<string>();
    allStats.forEach((stat: any) => {
      const email = stat.agent_email?.toLowerCase().trim();
      if (!email) return;
      const emailPrefix = email.split('@')[0];
      if (/^\d+$/.test(emailPrefix) && parseInt(emailPrefix) > 0) {
        numericEmails.add(email);
      }
    });
    
    console.log(`📊 Found ${numericEmails.size} unique numeric emails in weekly_usage_stats`);
    
    if (numericEmails.size === 0) {
      console.log('✅ No numeric emails found - nothing to fix');
      return;
    }
    
    // Step 2: Look up real emails from customers table
    console.log('\n📊 Step 2: Looking up real emails from customers table...');
    
    const numericAssociateIds = new Set<number>();
    numericEmails.forEach(email => {
      const assocId = parseInt(email.split('@')[0]);
      if (!isNaN(assocId)) numericAssociateIds.add(assocId);
    });
    
    console.log(`📊 Looking up ${numericAssociateIds.size} unique associate_ids...`);
    
    const emailMapping = new Map<string, string>(); // numeric email -> real email
    
    if (numericAssociateIds.size > 0) {
      const assocIdArray = Array.from(numericAssociateIds);
      const batchSize = 100;
      
      for (let i = 0; i < assocIdArray.length; i += batchSize) {
        const batch = assocIdArray.slice(i, i + batchSize);
        const { data: customers } = await supabaseAdmin
          .from('customers')
          .select('associate_id, company_email, personal_email')
          .in('associate_id', batch);
        
        if (customers) {
          customers.forEach((customer: any) => {
            const realEmail = (customer.company_email || customer.personal_email)?.toLowerCase().trim();
            if (realEmail && customer.associate_id) {
              // Map all numeric emails with this associate_id
              numericEmails.forEach(numericEmail => {
                const numericAssocId = parseInt(numericEmail.split('@')[0]);
                if (numericAssocId === customer.associate_id) {
                  emailMapping.set(numericEmail, realEmail);
                }
              });
            }
          });
        }
      }
    }
    
    console.log(`✅ Mapped ${emailMapping.size} numeric emails to real emails`);
    
    if (emailMapping.size === 0) {
      console.log('⚠️ No mappings found - numeric emails may not exist in customers table');
      return;
    }
    
    // Step 3: Update weekly_usage_stats records
    console.log('\n📊 Step 3: Updating weekly_usage_stats records...');
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Group by real email to handle duplicates
    const updatesByRealEmail = new Map<string, Array<{ numericEmail: string; weekStartDate: string }>>();
    
    allStats.forEach((stat: any) => {
      const numericEmail = stat.agent_email?.toLowerCase().trim();
      if (!numericEmail) return;
      
      const realEmail = emailMapping.get(numericEmail);
      if (realEmail && realEmail !== numericEmail) {
        if (!updatesByRealEmail.has(realEmail)) {
          updatesByRealEmail.set(realEmail, []);
        }
        updatesByRealEmail.get(realEmail)!.push({
          numericEmail,
          weekStartDate: stat.week_start_date
        });
      }
    });
    
    console.log(`📊 Need to update ${updatesByRealEmail.size} unique real emails (${Array.from(updatesByRealEmail.values()).reduce((sum, arr) => sum + arr.length, 0)} total records)`);
    
    // For each real email, update all its numeric email records
    for (const [realEmail, records] of updatesByRealEmail.entries()) {
      for (const record of records) {
        try {
          // Check if a record with the real email already exists for this week
          const { data: existingReal } = await supabaseAdmin
            .from('weekly_usage_stats')
            .select('id, agent_email, vdp_total_minutes, vdp_available_minutes, vdp_call_minutes, total_online_minutes')
            .eq('agent_email', realEmail)
            .eq('week_start_date', record.weekStartDate)
            .maybeSingle();
          
          // Get the numeric email record
          const { data: numericRecord } = await supabaseAdmin
            .from('weekly_usage_stats')
            .select('*')
            .eq('agent_email', record.numericEmail)
            .eq('week_start_date', record.weekStartDate)
            .maybeSingle();
          
          if (!numericRecord) {
            console.log(`  ⚠️ Numeric record not found: ${record.numericEmail} for week ${record.weekStartDate}`);
            continue;
          }
          
          if (existingReal) {
            // Merge stats - use max values
            const { error: mergeError } = await supabaseAdmin
              .from('weekly_usage_stats')
              .update({
                vdp_total_minutes: Math.max(existingReal.vdp_total_minutes || 0, numericRecord.vdp_total_minutes || 0),
                vdp_available_minutes: Math.max(existingReal.vdp_available_minutes || 0, numericRecord.vdp_available_minutes || 0),
                vdp_call_minutes: Math.max(existingReal.vdp_call_minutes || 0, numericRecord.vdp_call_minutes || 0),
                total_online_minutes: Math.max(existingReal.total_online_minutes || 0, numericRecord.total_online_minutes || 0),
                updated_at: new Date().toISOString()
              })
              .eq('agent_email', realEmail)
              .eq('week_start_date', record.weekStartDate);
            
            if (mergeError) {
              console.error(`  ❌ Error merging stats for ${realEmail}:`, mergeError);
              errorCount++;
            } else {
              // Delete the numeric email record
              const { error: deleteError } = await supabaseAdmin
                .from('weekly_usage_stats')
                .delete()
                .eq('agent_email', record.numericEmail)
                .eq('week_start_date', record.weekStartDate);
              
              if (deleteError) {
                console.error(`  ❌ Error deleting numeric record ${record.numericEmail}:`, deleteError);
                errorCount++;
              } else {
                updatedCount++;
                if (updatedCount % 10 === 0) {
                  console.log(`  ✅ Updated ${updatedCount} records...`);
                }
              }
            }
          } else {
            // No existing real email record - just update the numeric email to real email
            const { error: updateError } = await supabaseAdmin
              .from('weekly_usage_stats')
              .update({
                agent_email: realEmail,
                updated_at: new Date().toISOString()
              })
              .eq('agent_email', record.numericEmail)
              .eq('week_start_date', record.weekStartDate);
            
            if (updateError) {
              console.error(`  ❌ Error updating ${record.numericEmail} -> ${realEmail}:`, updateError);
              errorCount++;
            } else {
              updatedCount++;
              if (updatedCount % 10 === 0) {
                console.log(`  ✅ Updated ${updatedCount} records...`);
              }
            }
          }
        } catch (error) {
          console.error(`  ❌ Error processing ${record.numericEmail}:`, error);
          errorCount++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 BACKFILL COMPLETE!');
    console.log('='.repeat(70));
    console.log(`✅ Successfully updated: ${updatedCount} records`);
    console.log(`❌ Errors: ${errorCount} records`);
    console.log(`📊 Total numeric emails found: ${numericEmails.size}`);
    console.log(`📊 Total mappings created: ${emailMapping.size}`);
    console.log('='.repeat(70) + '\n');
    
  } catch (error) {
    console.error('❌ Fatal error in backfill:', error);
    throw error;
  }
}

// Run the backfill
backfillWeeklyUsageStatsEmails()
  .then(() => {
    console.log('✅ Backfill script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill script failed:', error);
    process.exit(1);
  });
