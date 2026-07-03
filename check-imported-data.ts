/**
 * Check what was actually imported
 */

import { supabaseAdmin } from './server/supabase';

async function checkImportedData() {
  console.log('🔍 Checking imported data...\n');

  try {
    // Get the 5 transactions we just imported
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_id, transaction_date, lead_name, lead_phone, metadata')
      .like('transaction_id', 'csv-%')
      .order('transaction_date', { ascending: false })
      .limit(5);

    if (txError) {
      console.error('❌ Error fetching transactions:', txError);
      return;
    }

    console.log(`📊 Found ${transactions?.length || 0} CSV transactions\n`);

    if (!transactions || transactions.length === 0) {
      console.log('❌ No transactions found!');
      return;
    }

    // Get analytics for these transactions
    const transactionIds = transactions.map(t => t.transaction_id);
    const { data: analytics, error: analyticsError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('*')
      .in('billing_transaction_id', transactionIds);

    if (analyticsError) {
      console.error('❌ Error fetching analytics:', analyticsError);
      return;
    }

    console.log(`📊 Found ${analytics?.length || 0} analytics records\n`);

    for (const transaction of transactions) {
      console.log(`\n📞 Transaction: ${transaction.transaction_id}`);
      console.log(`   Lead: ${transaction.lead_name || 'N/A'}`);
      console.log(`   Phone: ${transaction.lead_phone || 'N/A'}`);
      
      const meta = typeof transaction.metadata === 'string' 
        ? JSON.parse(transaction.metadata) 
        : (transaction.metadata || {});
      console.log(`   SessionID: ${meta.sessionID || meta.taalk_call_id || 'N/A'}`);

      const analysis = analytics?.find(a => a.billing_transaction_id === transaction.transaction_id);
      if (analysis) {
        console.log(`   ✅ Analysis exists (ID: ${analysis.id})`);
        console.log(`   Status: ${analysis.analysis_status || 'N/A'}`);
        console.log(`   Score: ${analysis.call_score || 'N/A'}`);
        console.log(`   Has Transcript: ${!!analysis.transcript}`);
        console.log(`   Transcript Length: ${analysis.transcript?.length || 0} chars`);
        console.log(`   Has Recording URL: ${!!analysis.recording_url}`);
        console.log(`   Recording URL: ${analysis.recording_url || 'N/A'}`);
        console.log(`   Taalk Call ID: ${analysis.taalk_call_id || 'N/A'}`);
      } else {
        console.log(`   ❌ NO ANALYSIS FOUND`);
      }
    }

    // Test fetching a recording URL
    if (analytics && analytics.length > 0) {
      const firstAnalytic = analytics[0];
      if (firstAnalytic.recording_url) {
        console.log(`\n🔍 Testing recording URL: ${firstAnalytic.recording_url}`);
        try {
          const response = await fetch(firstAnalytic.recording_url);
          console.log(`   Status: ${response.status}`);
          console.log(`   Content-Type: ${response.headers.get('content-type')}`);
          console.log(`   Content-Length: ${response.headers.get('content-length') || 'Unknown'}`);
          if (response.ok) {
            console.log(`   ✅ Recording URL is accessible`);
          } else {
            console.log(`   ❌ Recording URL returned error: ${response.statusText}`);
          }
        } catch (error: any) {
          console.log(`   ❌ Error fetching recording: ${error.message}`);
        }
      }
    }

  } catch (error: any) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

checkImportedData();
