/**
 * Find ALL duplicate associate_ids in customers table
 */

import { supabaseAdmin } from './server/supabase';

async function findAllDuplicates() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  console.log('🔍 Finding ALL duplicate associate_ids in customers table...\n');

  // Get all customers with associate_id
  const { data: customers, error } = await supabaseAdmin
    .from('customers')
    .select('associate_id, company_email, personal_email, id')
    .not('associate_id', 'is', null);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  // Group by associate_id
  const associateIdMap = new Map<number, Array<{
    id: number;
    associate_id: number;
    company_email: string | null;
    personal_email: string | null;
  }>>();

  customers?.forEach(c => {
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

  // Find duplicates
  const duplicates = Array.from(associateIdMap.entries())
    .filter(([_, records]) => records.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`❌ Found ${duplicates.length} duplicate associate_ids:\n`);

  // Show all duplicates
  duplicates.forEach(([associateId, records]) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Associate ID: ${associateId} (${records.length} duplicate records)`);
    records.forEach((r, i) => {
      console.log(`  ${i + 1}. Customer ID: ${r.id}`);
      console.log(`     Company Email: ${r.company_email || 'N/A'}`);
      console.log(`     Personal Email: ${r.personal_email || 'N/A'}`);
    });
  });

  console.log(`\n\n📊 Summary: ${duplicates.length} duplicate associate_ids found`);
  console.log(`   Total duplicate records: ${duplicates.reduce((sum, [_, records]) => sum + records.length, 0)}`);
}

findAllDuplicates().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
