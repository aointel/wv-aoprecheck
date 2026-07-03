/**
 * Check what data is actually in the database
 */

import { supabaseAdmin } from './server/supabase';

async function checkData() {
  console.log('🔍 Checking actual data in database...\n');

  // Check taalk_call_analytics
  const { data: analytics, error: analyticsError } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('billing_transaction_id, agent_email, call_date, taalk_call_id, call_duration, call_score, transcript, recording_url, analysis_status')
    .limit(10);

  if (analyticsError) {
    console.error('❌ Error fetching analytics:', analyticsError);
    return;
  }

  console.log(`📊 Sample taalk_call_analytics records (${analytics?.length || 0}):`);
  analytics?.forEach((a, i) => {
    console.log(`\n${i + 1}. billing_transaction_id: ${a.billing_transaction_id}`);
    console.log(`   agent_email: ${a.agent_email}`);
    console.log(`   taalk_call_id: ${a.taalk_call_id}`);
    console.log(`   call_duration: ${a.call_duration}`);
    console.log(`   call_score: ${a.call_score}`);
    console.log(`   has_transcript: ${!!a.transcript}`);
    console.log(`   has_recording: ${!!a.recording_url}`);
    console.log(`   analysis_status: ${a.analysis_status}`);
  });

  // Check billing_transactions for these
  if (analytics && analytics.length > 0) {
    const transactionIds = analytics.map(a => a.billing_transaction_id).filter(Boolean);
    const { data: billing, error: billingError } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_id, agent_email, agent_name, lead_name, lead_phone, source_table, source_id, metadata')
      .in('transaction_id', transactionIds);

    if (billingError) {
      console.error('❌ Error fetching billing:', billingError);
    } else {
      console.log(`\n📊 Matching billing_transactions (${billing?.length || 0}):`);
      billing?.forEach((b, i) => {
        console.log(`\n${i + 1}. transaction_id: ${b.transaction_id}`);
        console.log(`   agent_email: ${b.agent_email}`);
        console.log(`   agent_name: ${b.agent_name}`);
        console.log(`   lead_name: ${b.lead_name}`);
        console.log(`   lead_phone: ${b.lead_phone}`);
        console.log(`   source_table: ${b.source_table}`);
        console.log(`   source_id: ${b.source_id}`);
        console.log(`   metadata: ${JSON.stringify(b.metadata).substring(0, 200)}`);
      });
    }
  }

  // Check vdp_calls if source_id exists
  if (analytics && analytics.length > 0) {
    const billingIds = analytics.map(a => a.billing_transaction_id).filter(Boolean);
    const { data: billing } = await supabaseAdmin
      .from('billing_transactions')
      .select('source_id, source_table')
      .in('transaction_id', billingIds);

    const vdpIds = billing?.filter(b => b.source_table === 'vdp_calls' && b.source_id).map(b => b.source_id).filter(Boolean);
    if (vdpIds && vdpIds.length > 0) {
      const { data: vdpCalls } = await supabaseAdmin
        .from('vdp_calls')
        .select('id, firstName, lastName, firstname, lastname, phone, market')
        .in('id', vdpIds);

      console.log(`\n📊 Matching vdp_calls (${vdpCalls?.length || 0}):`);
      vdpCalls?.forEach((v, i) => {
        console.log(`\n${i + 1}. id: ${v.id}`);
        console.log(`   firstName: ${v.firstName || v.firstname}`);
        console.log(`   lastName: ${v.lastName || v.lastname}`);
        console.log(`   phone: ${v.phone}`);
        console.log(`   market: ${v.market}`);
      });
    }
  }
}

checkData().catch(console.error);
