/**
 * Check billing transactions for associate_id 205404
 */

import { supabaseAdmin } from './server/supabase';

async function checkAssociate() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  const associateId = 205404;

  console.log(`🔍 Checking associate_id: ${associateId}\n`);

  // First, get all customers with this associate_id
  const { data: customers, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('id, associate_id, company_email, personal_email')
    .eq('associate_id', associateId);

  if (customerError) {
    console.error('❌ Error fetching customers:', customerError);
    process.exit(1);
  }

  console.log(`📊 Found ${customers?.length || 0} customer records with associate_id ${associateId}\n`);

  if (!customers || customers.length === 0) {
    console.log('❌ No customers found with this associate_id');
    process.exit(0);
  }

  // Get all emails for this associate
  const emails = customers
    .map(c => [c.company_email, c.personal_email])
    .flat()
    .filter(e => e) as string[];

  console.log(`📧 Emails associated with this associate_id: ${emails.join(', ')}\n`);

  // Get all billing transactions for these emails
  const { data: transactions, error } = await supabaseAdmin
    .from('billing_transactions')
    .select('*')
    .in('agent_email', emails)
    .order('transaction_date', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`📊 Total billing transactions: ${transactions?.length || 0}\n`);

  if (transactions && transactions.length > 0) {
    // Group by transaction_type
    const byType: Record<string, number> = {};
    transactions.forEach(t => {
      byType[t.transaction_type] = (byType[t.transaction_type] || 0) + 1;
    });

    console.log('📊 By transaction type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    console.log('\n📋 Sample transactions (first 10):');
    transactions.slice(0, 10).forEach((t, i) => {
      console.log(`\n   ${i + 1}. ${t.transaction_id}`);
      console.log(`      Type: ${t.transaction_type}`);
      console.log(`      Date: ${t.transaction_date}`);
      console.log(`      Agent: ${t.agent_email || 'N/A'}`);
      console.log(`      Source: ${t.source_table || 'N/A'}`);
      if (t.metadata) {
        console.log(`      Metadata keys: ${Object.keys(typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata).join(', ')}`);
      }
    });
  }
}

checkAssociate().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
