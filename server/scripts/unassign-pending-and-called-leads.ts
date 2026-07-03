/**
 * Unassign All Pending and Called Leads
 * 
 * Finds all leads with cnresolution = 'pending' or 'called' that are currently assigned,
 * unassigns them, and resets their resolution to 'pending' so they can be reassigned.
 */

import { supabaseAdmin } from '../supabase';

async function unassignPendingAndCalledLeads() {
  try {
    console.log('🔄 Starting unassign process for pending and called leads...\n');

    // 1. Find ALL pending leads (assigned OR unassigned) - with pagination to get ALL leads
    console.log('📋 Finding ALL pending leads...');
    let pendingLeads: any[] = [];
    let pendingOffset = 0;
    const pendingPageSize = 1000;
    let hasMorePending = true;

    while (hasMorePending) {
      const { data: batch, error: pendingError } = await supabaseAdmin
        .from('masterlead')
        .select('id, cn_email, TaalkResolve, dnc')
        .eq('cnresolution', 'pending')
        .or('TaalkResolve.is.null,TaalkResolve.eq.false') // Exclude frozen leads
        .eq('dnc', false) // Exclude DNC leads
        .range(pendingOffset, pendingOffset + pendingPageSize - 1);

      if (pendingError) {
        console.error('❌ Error fetching pending leads:', pendingError);
        throw pendingError;
      }

      if (batch && batch.length > 0) {
        pendingLeads = [...pendingLeads, ...batch];
        pendingOffset += pendingPageSize;
        hasMorePending = batch.length === pendingPageSize;
        if (pendingLeads.length % 5000 === 0 || !hasMorePending) {
          console.log(`   Found ${pendingLeads.length} pending leads so far...`);
        }
      } else {
        hasMorePending = false;
      }
    }

    console.log(`   ✅ Total: ${pendingLeads.length} pending leads found\n`);

    // 2. Find ALL called leads (assigned OR unassigned) - with pagination to get ALL leads
    console.log('📋 Finding ALL called leads...');
    let calledLeads: any[] = [];
    let calledOffset = 0;
    const calledPageSize = 1000;
    let hasMoreCalled = true;

    while (hasMoreCalled) {
      const { data: batch, error: calledError } = await supabaseAdmin
        .from('masterlead')
        .select('id, cn_email, TaalkResolve, dnc')
        .eq('cnresolution', 'called')
        .or('TaalkResolve.is.null,TaalkResolve.eq.false') // Exclude frozen leads
        .eq('dnc', false) // Exclude DNC leads
        .range(calledOffset, calledOffset + calledPageSize - 1);

      if (calledError) {
        console.error('❌ Error fetching called leads:', calledError);
        throw calledError;
      }

      if (batch && batch.length > 0) {
        calledLeads = [...calledLeads, ...batch];
        calledOffset += calledPageSize;
        hasMoreCalled = batch.length === calledPageSize;
        if (calledLeads.length % 5000 === 0 || !hasMoreCalled) {
          console.log(`   Found ${calledLeads.length} called leads so far...`);
        }
      } else {
        hasMoreCalled = false;
      }
    }

    console.log(`   ✅ Total: ${calledLeads.length} called leads found\n`);

    // 3. Combine all leads to unassign
    const allLeadsToUnassign = [
      ...(pendingLeads || []),
      ...(calledLeads || [])
    ];

    if (allLeadsToUnassign.length === 0) {
      console.log('✅ No leads to unassign. All done!');
      return;
    }

    console.log(`📊 Total leads to unassign: ${allLeadsToUnassign.length}`);
    console.log(`   - Pending: ${pendingLeads?.length || 0}`);
    console.log(`   - Called: ${calledLeads?.length || 0}\n`);

    // 4. Unassign all leads in batches (Supabase has limits)
    // We need to preserve each lead's current cn_email in previous_cn_email
    // So we'll update each lead individually to preserve the cn_email value
    const batchSize = 100; // Smaller batches for individual updates
    let totalUnassigned = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < allLeadsToUnassign.length; i += batchSize) {
      const batch = allLeadsToUnassign.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(allLeadsToUnassign.length / batchSize);

      console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} leads)...`);

      // Update each lead individually to preserve its current cn_email (if assigned)
      const updatePromises = batch.map(async (lead) => {
        const updateData: any = {
          cnresolution: null // Reset to null so they can be reassigned
        };

        // Only unassign if currently assigned
        if (lead.cn_email) {
          updateData.previous_cn_email = lead.cn_email; // Preserve who had it
          updateData.last_assigned_date = now;
          updateData.cn_email = null;
          updateData.assigned_date = null;
        }

        const { error: updateError } = await supabaseAdmin
          .from('masterlead')
          .update(updateData)
          .eq('id', lead.id);

        if (updateError) {
          console.error(`❌ Error updating lead ${lead.id}:`, updateError);
          return false;
        }
        return true;
      });

      // Wait for all updates in this batch to complete
      const results = await Promise.all(updatePromises);
      const batchUnassigned = results.filter(r => r === true).length;
      totalUnassigned += batchUnassigned;

      console.log(`   ✅ Batch ${batchNumber} complete: ${batchUnassigned}/${batch.length} leads unassigned`);
    }

    console.log(`\n✅ Unassign complete!`);
    console.log(`   Total unassigned: ${totalUnassigned}`);
    console.log(`   - Pending leads: ${pendingLeads?.length || 0}`);
    console.log(`   - Called leads: ${calledLeads?.length || 0}`);
    console.log(`\n🔄 Leads are now unassigned and ready for reassignment when agents refresh.`);

  } catch (error) {
    console.error('❌ Fatal error in unassign script:', error);
    throw error;
  }
}

// Run the script if executed directly
unassignPendingAndCalledLeads()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

export { unassignPendingAndCalledLeads };
