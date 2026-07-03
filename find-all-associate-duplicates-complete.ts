/**
 * Find ALL duplicate associate_ids - comprehensive check
 * Checks for:
 * 1. Multiple customer records with same associate_id
 * 2. Same email with different associate_ids
 */

import { supabaseAdmin } from './server/supabase';

async function findAllDuplicates() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  console.log('🔍 Finding ALL duplicate associate_ids in customers table...\n');
  console.log('='.repeat(70));

  // Get ALL customers with associate_id (no limit)
  console.log('📊 Fetching ALL customers with associate_id (this may take a moment)...\n');
  
  let allCustomers: any[] = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: customers, error } = await supabaseAdmin
      .from('customers')
      .select('id, associate_id, company_email, personal_email')
      .not('associate_id', 'is', null)
      .order('associate_id', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Error:', error);
      process.exit(1);
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

  const customers = allCustomers;
  
  if (!customers || customers.length === 0) {
    console.log('❌ No customers found');
    process.exit(0);
  }

  console.log(`📊 Total customers with associate_id: ${customers?.length || 0}\n`);

  // Group by associate_id to find duplicates
  const associateIdMap = new Map<number, Array<{
    id: string;
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

  // Find duplicates (same associate_id, multiple records)
  const duplicates = Array.from(associateIdMap.entries())
    .filter(([_, records]) => records.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`❌ Found ${duplicates.length} duplicate associate_ids (same ID, multiple records):\n`);

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

  // Also check for same email with different associate_ids
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('🔍 Checking for same email with different associate_ids...\n');

  const emailMap = new Map<string, Array<{
    id: string;
    associate_id: number;
    email: string;
  }>>();

  customers?.forEach(c => {
    const emails = [c.company_email, c.personal_email].filter(e => e) as string[];
    emails.forEach(email => {
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email)!.push({
        id: c.id,
        associate_id: Number(c.associate_id),
        email: email
      });
    });
  });

  // Find emails with multiple associate_ids
  const emailDuplicates = Array.from(emailMap.entries())
    .filter(([_, records]) => {
      const uniqueAssociateIds = new Set(records.map(r => r.associate_id));
      return uniqueAssociateIds.size > 1;
    })
    .sort((a, b) => {
      const aIds = new Set(a[1].map(r => r.associate_id)).size;
      const bIds = new Set(b[1].map(r => r.associate_id)).size;
      return bIds - aIds;
    });

  console.log(`❌ Found ${emailDuplicates.length} emails with multiple associate_ids:\n`);

  emailDuplicates.forEach(([email, records]) => {
    const uniqueAssociateIds = [...new Set(records.map(r => r.associate_id))];
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Email: ${email}`);
    console.log(`   Has ${uniqueAssociateIds.length} different associate_ids: ${uniqueAssociateIds.join(', ')}`);
    records.forEach((r, i) => {
      console.log(`  ${i + 1}. Customer ID: ${r.id}, Associate ID: ${r.associate_id}`);
    });
  });


  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`📊 SUMMARY:`);
  console.log(`   Total customers with associate_id: ${customers?.length || 0}`);
  console.log(`   Unique associate_ids: ${associateIdMap.size}`);
  console.log(`   Duplicate associate_ids (same ID, multiple records): ${duplicates.length}`);
  console.log(`   Emails with multiple associate_ids: ${emailDuplicates.length}`);
  console.log(`   Total duplicate records: ${duplicates.reduce((sum, [_, records]) => sum + records.length, 0)}`);
}

findAllDuplicates().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
