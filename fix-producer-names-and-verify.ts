/**
 * Fix producer names and verify recordings/transcripts
 */

import { supabaseAdmin } from './server/supabase';

async function fixProducerNames() {
  console.log('🔧 Fixing producer names and verifying data...\n');

  try {
    // Get all CSV transactions
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_id, agent_email, agent_associate_id, agent_name, lead_phone, source_id, metadata')
      .like('transaction_id', 'csv-%');

    if (txError) {
      console.error('❌ Error fetching transactions:', txError);
      return;
    }

    console.log(`📊 Found ${transactions?.length || 0} CSV transactions\n`);

    if (!transactions || transactions.length === 0) {
      console.log('❌ No transactions found!');
      return;
    }

    // Get analytics
    const transactionIds = transactions.map(t => t.transaction_id);
    const { data: analytics } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('billing_transaction_id, recording_url, transcript, analysis_status, call_score')
      .in('billing_transaction_id', transactionIds);

    const analyticsMap = new Map((analytics || []).map(a => [a.billing_transaction_id, a]));

    for (const transaction of transactions) {
      console.log(`\n📞 Transaction: ${transaction.transaction_id}`);
      console.log(`   Lead Phone: ${transaction.lead_phone || 'N/A'}`);
      console.log(`   Current Agent: ${transaction.agent_email || 'N/A'} (ID: ${transaction.agent_associate_id || 'N/A'})`);
      console.log(`   Current Name: ${transaction.agent_name || 'N/A'}`);

      // Look up vdp_call by phone or source_id
      let vdpCall = null;
      if (transaction.source_id) {
        const { data: vdp } = await supabaseAdmin
          .from('vdp_calls')
          .select('id, phone, company_email, agent, firstName, lastName, sessionID')
          .eq('id', transaction.source_id)
          .maybeSingle();
        vdpCall = vdp;
      }

      if (!vdpCall && transaction.lead_phone) {
        const normalizedPhone = transaction.lead_phone.replace(/[\s\-+()]/g, '').slice(-10);
        const { data: vdpCalls } = await supabaseAdmin
          .from('vdp_calls')
          .select('id, phone, company_email, agent, firstName, lastName, sessionID')
          .or(`phone.ilike.%${normalizedPhone}%`)
          .order('updated_at', { ascending: false })
          .limit(1);
        vdpCall = vdpCalls?.[0] || null;
      }

      if (vdpCall) {
        console.log(`   ✅ Found vdp_call: ID ${vdpCall.id}, agent: ${vdpCall.agent}`);

        // Resolve agent name from customers/agent_hierarchy
        let agentName = transaction.agent_name;
        let agentEmail = transaction.agent_email;

        if (transaction.agent_associate_id) {
          // Try customers table
          const { data: customer } = await supabaseAdmin
            .from('customers')
            .select('company_email, personal_email, first_name, last_name, associate_id')
            .eq('associate_id', transaction.agent_associate_id)
            .limit(1)
            .maybeSingle();

          if (customer) {
            agentEmail = (customer.company_email || customer.personal_email || agentEmail)?.toLowerCase();
            if (customer.first_name || customer.last_name) {
              agentName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
            }
            console.log(`   ✅ Found in customers: ${agentName} (${agentEmail})`);
          }

          // Try agent_hierarchy
          if (!agentName || agentName === 'Unknown Agent') {
            const { data: hierarchy } = await supabaseAdmin
              .from('agent_hierarchy')
              .select('agent_email, agent_name, agent_associate_id')
              .eq('agent_associate_id', transaction.agent_associate_id)
              .limit(1)
              .maybeSingle();

            if (hierarchy) {
              if (!agentEmail || agentEmail === 'unknown@aoglobelife.com') {
                agentEmail = hierarchy.agent_email?.toLowerCase() || agentEmail;
              }
              if (!agentName || agentName === 'Unknown Agent') {
                agentName = hierarchy.agent_name || agentName;
              }
              console.log(`   ✅ Found in agent_hierarchy: ${agentName} (${agentEmail})`);
            }
          }
        }

        // Update transaction with correct name
        if (agentName && agentName !== transaction.agent_name) {
          const { error: updateError } = await supabaseAdmin
            .from('billing_transactions')
            .update({
              agent_name: agentName,
              agent_email: agentEmail
            })
            .eq('transaction_id', transaction.transaction_id);

          if (updateError) {
            console.error(`   ❌ Error updating: ${updateError.message}`);
          } else {
            console.log(`   ✅ Updated agent_name to: ${agentName}`);
          }
        }
      } else {
        console.log(`   ⚠️ No vdp_call found`);
      }

      // Check analytics
      const analysis = analyticsMap.get(transaction.transaction_id);
      if (analysis) {
        console.log(`   📊 Analysis Status: ${analysis.analysis_status}`);
        console.log(`   📊 Score: ${analysis.call_score || 'N/A'}`);
        console.log(`   📝 Transcript: ${analysis.transcript ? `${analysis.transcript.length} chars` : 'MISSING'}`);
        console.log(`   🎵 Recording URL: ${analysis.recording_url ? 'EXISTS' : 'MISSING'}`);
        
        if (analysis.recording_url) {
          // Test the URL
          try {
            const response = await fetch(analysis.recording_url);
            console.log(`   🎵 Recording Status: ${response.status} ${response.statusText}`);
            if (response.ok) {
              const contentType = response.headers.get('content-type');
              const contentLength = response.headers.get('content-length');
              console.log(`   🎵 Recording Type: ${contentType}, Size: ${contentLength ? Math.round(parseInt(contentLength) / 1024) + 'KB' : 'Unknown'}`);
            } else {
              console.log(`   ❌ Recording URL is NOT accessible!`);
            }
          } catch (error: any) {
            console.log(`   ❌ Error testing recording: ${error.message}`);
          }
        }
      } else {
        console.log(`   ❌ NO ANALYSIS FOUND`);
      }
    }

  } catch (error: any) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

fixProducerNames();
