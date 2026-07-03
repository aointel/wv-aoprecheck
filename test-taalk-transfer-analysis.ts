/**
 * Test script to prove Taalk transfer analysis works
 * Finds a real transfer and analyzes it
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsScheduler } from './server/call-analytics-scheduler';

async function testTaalkTransferAnalysis() {
  console.log('🧪 Testing Taalk Transfer Analysis - Searching Taalk API Directly...\n');
  
  try {
    // Get a billing transaction to get phone number
    console.log('🔍 Getting a billing transaction to find phone number...');
    
    const { data: billingTransactions } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_id, agent_email, agent_name, transaction_date, source_id, source_table, lead_phone, metadata')
      .eq('transaction_type', 'connect')
      .eq('source_table', 'vdp_calls')
      .not('agent_email', 'is', null)
      .neq('agent_email', '')
      .not('lead_phone', 'is', null)
      .neq('lead_phone', '')
      .order('transaction_date', { ascending: false })
      .limit(10);
    
    if (!billingTransactions || billingTransactions.length === 0) {
      console.error('❌ No billing transactions with phone numbers found');
      process.exit(1);
    }
    
    // Find one with a phone number
    const transaction = billingTransactions.find(t => t.lead_phone) || billingTransactions[0];
    const phoneNumber = transaction.lead_phone;
    
    console.log(`📞 Using phone number: ${phoneNumber}`);
    console.log(`   Transaction: ${transaction.transaction_id}`);
    console.log(`   Agent: ${transaction.agent_email}`);
    console.log(`   Date: ${transaction.transaction_date}\n`);
    
    // Search Taalk API directly for calls with this phone number
    console.log('🔍 Searching Taalk API for calls with this phone number...');
    
    const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    
    // Get recent calls - need timezone parameter
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const recentCallsUrl = `https://api.taalk.ai/api/calls?db=michaelmandella&limit=500&timezone=${encodeURIComponent(timezone)}`;
    console.log(`🔍 Querying: ${recentCallsUrl}`);
    
    const recentCallsResponse = await fetch(recentCallsUrl, {
      headers: { 'Authorization': `Bearer ${taalkApiKey}` }
    });
    
    if (!recentCallsResponse.ok) {
      const errorText = await recentCallsResponse.text().catch(() => '');
      console.error(`❌ Failed to query Taalk API: ${recentCallsResponse.status}`);
      console.error(`   Error: ${errorText.substring(0, 500)}`);
      
      // Try with timezone
      console.log('\n🔍 Trying with timezone parameter...');
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const altUrl = `https://api.taalk.ai/api/calls?db=michaelmandella&timezone=${encodeURIComponent(timezone)}`;
      const altResponse = await fetch(altUrl, {
        headers: { 'Authorization': `Bearer ${taalkApiKey}` }
      });
      
      if (!altResponse.ok) {
        const altError = await altResponse.text().catch(() => '');
        console.error(`❌ Also failed: ${altResponse.status} - ${altError.substring(0, 500)}`);
        process.exit(1);
      }
      
      const altData = await altResponse.json();
      const calls = Array.isArray(altData) ? altData : (altData.calls || []);
      console.log(`✅ Got ${calls.length} calls from Taalk API\n`);
      
      // Continue with the rest of the logic
      const normalizePhone = (phone: string) => {
        if (!phone) return '';
        const cleaned = phone.replace(/[\s\-+()]/g, '');
        return cleaned.slice(-10);
      };
      
      const targetPhone = normalizePhone(phoneNumber);
      const matchingCalls = calls.filter((call: any) => {
        const callPhone = normalizePhone(call.phone || call.from || call.to || '');
        return callPhone === targetPhone;
      });
      
      if (matchingCalls.length === 0) {
        console.error('❌ No matching calls found');
        process.exit(1);
      }
      
      const taalkCall = matchingCalls[0];
      const taalkCallId = taalkCall.id || taalkCall._id || taalkCall.callId;
      
      console.log(`✅ Found Taalk call ID: ${taalkCallId}\n`);
      
      // Test and analyze
      const transcriptUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/transcript?db=michaelmandella`;
      const transcriptResponse = await fetch(transcriptUrl, {
        headers: { 'Authorization': `Bearer ${taalkApiKey}`, 'Accept': 'text/plain' }
      });
      
      if (transcriptResponse.ok) {
        const transcript = await transcriptResponse.text();
        console.log(`✅ Transcript: ${transcript.length} chars\n`);
      }
      
      const recordingUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;
      const recordingResponse = await fetch(recordingUrl, {
        headers: { 'Authorization': `Bearer ${taalkApiKey}`, 'Accept': 'audio/mpeg' }
      });
      
      if (recordingResponse.ok) {
        const contentLength = recordingResponse.headers.get('content-length');
        console.log(`✅ Recording: ${contentLength ? Math.round(parseInt(contentLength) / 1024) + 'KB' : 'Unknown'}\n`);
      }
      
      const mockTransaction = {
        ...transaction,
        metadata: {
          taalk_call_id: taalkCallId
        }
      };
      
      console.log('🔍 Running analysis...\n');
      const scheduler = callAnalyticsScheduler as any;
      await scheduler.analyzeCall(mockTransaction);
      console.log('\n✅ Analysis complete!');
      process.exit(0);
    }
    
    const callsData = await recentCallsResponse.json();
    const calls = Array.isArray(callsData) ? callsData : (callsData.calls || []);
    
    console.log(`📊 Found ${calls.length} calls from Taalk API\n`);
    
    // Normalize phone number for matching
    const normalizePhone = (phone: string) => {
      if (!phone) return '';
      const cleaned = phone.replace(/[\s\-+()]/g, '');
      return cleaned.slice(-10); // Last 10 digits
    };
    
    const targetPhone = normalizePhone(phoneNumber);
    const transactionTime = new Date(transaction.transaction_date).getTime();
    
    console.log(`🔍 Searching for phone: ${targetPhone} (normalized from ${phoneNumber})`);
    console.log(`   Transaction time: ${transaction.transaction_date}\n`);
    
    // Find matching call by phone
    const matchingCalls = calls.filter((call: any) => {
      const callPhone = normalizePhone(call.phone || call.from || call.to || '');
      return callPhone === targetPhone;
    });
    
    console.log(`📊 Found ${matchingCalls.length} calls matching phone number\n`);
    
    if (matchingCalls.length === 0) {
      console.error('❌ No matching calls found in Taalk API');
      process.exit(1);
    }
    
    // Use the most recent one
    const taalkCall = matchingCalls[0];
    const taalkCallId = taalkCall.id || taalkCall._id || taalkCall.callId;
    
    console.log(`✅ Found Taalk call:`);
    console.log(`   ID: ${taalkCallId}`);
    console.log(`   Phone: ${taalkCall.phone || taalkCall.from || taalkCall.to}`);
    console.log(`   Created: ${taalkCall.created_at || taalkCall.createdAt || taalkCall.time || taalkCall.date}\n`);
    
    // Test transcript fetch
    const transcriptUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/transcript?db=michaelmandella`;
    console.log(`📝 Testing transcript: ${transcriptUrl}`);
    
    const transcriptResponse = await fetch(transcriptUrl, {
      headers: { 
        'Authorization': `Bearer ${taalkApiKey}`,
        'Accept': 'text/plain, text/*, */*'
      }
    });
    
    if (transcriptResponse.ok) {
      const transcript = await transcriptResponse.text();
      console.log(`✅ Transcript: ${transcript.length} characters`);
      console.log(`   Preview: ${transcript.substring(0, 200)}...\n`);
    } else {
      console.log(`⚠️ Transcript: ${transcriptResponse.status} ${transcriptResponse.statusText}\n`);
    }
    
    // Test recording fetch
    const recordingUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;
    console.log(`🎵 Testing recording: ${recordingUrl}`);
    
    const recordingResponse = await fetch(recordingUrl, {
      headers: {
        'Authorization': `Bearer ${taalkApiKey}`,
        'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
      }
    });
    
    if (recordingResponse.ok) {
      const contentLength = recordingResponse.headers.get('content-length');
      console.log(`✅ Recording: ${contentLength ? Math.round(parseInt(contentLength) / 1024) + 'KB' : 'Unknown size'}\n`);
    } else {
      console.log(`⚠️ Recording: ${recordingResponse.status} ${recordingResponse.statusText}\n`);
    }
    
    // Now create a mock transaction with the Taalk call ID
    const mockTransaction = {
      ...transaction,
      metadata: {
        ...(typeof transaction.metadata === 'string' ? JSON.parse(transaction.metadata) : (transaction.metadata || {})),
        taalk_call_id: taalkCallId
      }
    };
    
    console.log('🔍 Now attempting actual analysis...\n');
    
    // Access private method via type casting
    const scheduler = callAnalyticsScheduler as any;
    await scheduler.analyzeCall(mockTransaction);
    
    console.log('\n✅ Analysis complete! Check the database for results.');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

testTaalkTransferAnalysis();
