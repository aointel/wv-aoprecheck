/**
 * Remove duplicate associate_id entries from customers table
 * Keeps the record with the most complete data (or oldest if equal)
 */

import { supabaseAdmin } from './server/supabase';

async function removeDuplicateAssociateIds() {
  console.log(`🗑️ Removing duplicate associate_id entries from customers table\n`);
  console.log('='.repeat(70));

  try {
    // Get ALL customers with associate_id (no limit)
    console.log('📊 Fetching ALL customers with associate_id (this may take a moment)...\n');
    
    let allCustomers: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: customers, error: fetchError } = await supabaseAdmin
        .from('customers')
        .select('id, associate_id, company_email, personal_email, first_name, last_name, created_at')
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

    console.log(`\n📊 Found ${allCustomers.length} total customers with associate_id`);

    // Find duplicates
    const associateIdMap = new Map<number, Array<{
      id: string;
      associate_id: number;
      company_email: string | null;
      personal_email: string | null;
      first_name: string | null;
      last_name: string | null;
      created_at: string | null;
      updated_at: string | null;
      completeness: number; // Score for how complete the data is
    }>>();

    allCustomers?.forEach(c => {
      const associateId = Number(c.associate_id);
      if (!associateId) return;

      if (!associateIdMap.has(associateId)) {
        associateIdMap.set(associateId, []);
      }

      // Calculate completeness score (higher = more complete)
      let completeness = 0;
      if (c.company_email) completeness += 2;
      if (c.personal_email) completeness += 1;
      if (c.first_name) completeness += 1;
      if (c.last_name) completeness += 1;

      associateIdMap.get(associateId)!.push({
        id: c.id,
        associate_id: associateId,
        company_email: c.company_email,
        personal_email: c.personal_email,
        first_name: c.first_name,
        last_name: c.last_name,
        created_at: c.created_at,
        updated_at: null,
        completeness
      });
    });

    // Filter to only duplicates
    const duplicates = Array.from(associateIdMap.entries())
      .filter(([_, records]) => records.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`\n❌ Found ${duplicates.length} duplicate associate_ids affecting ${duplicates.reduce((sum, [_, records]) => sum + records.length, 0)} records\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    let deleted = 0;
    let errors = 0;
    const toDelete: string[] = [];

    // For each duplicate set, determine which to keep and which to delete
    for (const [associateId, records] of duplicates) {
      // Sort by completeness (highest first), then by created_at (oldest first)
      const sorted = [...records].sort((a, b) => {
        if (b.completeness !== a.completeness) {
          return b.completeness - a.completeness;
        }
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aDate - bDate;
      });

      const keep = sorted[0];
      const deleteThese = sorted.slice(1);

      console.log(`\n${'='.repeat(70)}`);
      console.log(`\nAssociate ID: ${associateId} (${records.length} records)`);
      console.log(`   ✅ KEEPING: ${keep.id}`);
      console.log(`      Email: ${keep.company_email || keep.personal_email || 'NO EMAIL'}`);
      console.log(`      Completeness: ${keep.completeness}, Created: ${keep.created_at || 'N/A'}`);

      for (const del of deleteThese) {
        const email = del.company_email || del.personal_email || 'NO EMAIL';
        console.log(`   🗑️ DELETING: ${del.id} (${email})`);
        toDelete.push(del.id);
      }
    }

    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`\n⚠️ About to delete ${toDelete.length} duplicate customer records`);
    console.log(`   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n`);

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete duplicates
    for (const id of toDelete) {
      const { error } = await supabaseAdmin
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`   ❌ Error deleting ${id}: ${error.message}`);
        errors++;
      } else {
        deleted++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Duplicate associate_ids found: ${duplicates.length}`);
    console.log(`   Records deleted: ${deleted}`);
    console.log(`   Errors: ${errors}`);
    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

removeDuplicateAssociateIds()
  .then(() => {
    console.log('\n✅ Cleanup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });
