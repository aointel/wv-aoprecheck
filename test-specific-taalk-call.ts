/**
 * Test analyzing a specific Taalk call by session ID
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsScheduler } from './server/call-analytics-scheduler';

async function testSpecificTaalkCall() {
  const sessionId = '6979854ef44cd3df56c01740';
  
  console.log(`🧪 Testing Taalk Call Analysis for Session ID: ${sessionId}\n`);
  
  try {
    const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    
    // Test transcript
    console.log('📝 Fetching transcript...');
    const transcriptUrl = `https://api.taalk.ai/api/calls/${sessionId}/transcript?db=michaelmandella`;
    const transcriptResponse = await fetch(transcriptUrl, {
      headers: { 
        'Authorization': `Bearer ${taalkApiKey}`,
        'Accept': 'text/plain, text/*, */*'
      }
    });
    
    if (transcriptResponse.ok) {
      const transcript = await transcriptResponse.text();
      console.log(`✅ Transcript: ${transcript.length} characters`);
      console.log(`   Preview: ${transcript.substring(0, 300)}...\n`);
    } else {
      const errorText = await transcriptResponse.text().catch(() => '');
      console.log(`⚠️ Transcript: ${transcriptResponse.status} - ${errorText.substring(0, 200)}\n`);
    }
    
    // Test recording
    console.log('🎵 Fetching recording...');
    const recordingUrl = `https://api.taalk.ai/api/calls/${sessionId}/recording?db=michaelmandella`;
    const recordingResponse = await fetch(recordingUrl, {
      headers: {
        'Authorization': `Bearer ${taalkApiKey}`,
        'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
      }
    });
    
    if (recordingResponse.ok) {
      const contentLength = recordingResponse.headers.get('content-length');
      console.log(`✅ Recording: ${contentLength ? Math.round(parseInt(contentLength) / 1024) + 'KB' : 'Unknown size'}`);
      console.log(`   Content-Type: ${recordingResponse.headers.get('content-type')}\n`);
    } else {
      const errorText = await recordingResponse.text().catch(() => '');
      console.log(`⚠️ Recording: ${recordingResponse.status} - ${errorText.substring(0, 200)}\n`);
    }
    
    // Find matching billing transaction
    console.log('🔍 Finding matching billing transaction...');
    
    // Try to find a billing transaction that might match this call
    // Or create a mock one for testing
    const { data: recentTransactions } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_id, agent_email, agent_name, transaction_date, source_id, source_table, metadata')
      .eq('transaction_type', 'connect')
      .eq('source_table', 'vdp_calls')
      .not('agent_email', 'is', null)
      .order('transaction_date', { ascending: false })
      .limit(1);
    
    let transaction: any;
    
    if (recentTransactions && recentTransactions.length > 0) {
      transaction = recentTransactions[0];
      console.log(`✅ Using transaction: ${transaction.transaction_id}`);
      console.log(`   Agent: ${transaction.agent_email}\n`);
    } else {
      // Create a mock transaction
      transaction = {
        transaction_id: `test-${sessionId}`,
        agent_email: 'test@aoglobelife.com',
        agent_name: 'Test Agent',
        transaction_date: new Date().toISOString(),
        source_id: null,
        source_table: 'vdp_calls',
        metadata: {
          taalk_call_id: sessionId
        }
      };
      console.log(`⚠️ No billing transaction found, using mock transaction\n`);
    }
    
    // Add the Taalk call ID to metadata
    transaction.metadata = {
      ...(typeof transaction.metadata === 'string' ? JSON.parse(transaction.metadata) : (transaction.metadata || {})),
      taalk_call_id: sessionId
    };
    
    console.log('🔍 Running analysis...\n');
    
    // Access private method
    const scheduler = callAnalyticsScheduler as any;
    await scheduler.analyzeCall(transaction);
    
    console.log('\n✅ Analysis complete! Check taalk_call_analytics table for results.');
    
    // Check the result
    const { data: analysis } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('*')
      .eq('taalk_call_id', sessionId)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (analysis) {
      console.log('\n📊 Analysis Results:');
      console.log(`   Status: ${analysis.analysis_status}`);
      console.log(`   Score: ${analysis.call_score || 'N/A'}`);
      console.log(`   Sentiment: ${analysis.sentiment_label || 'N/A'}`);
      console.log(`   Outcome: ${analysis.call_outcome || 'N/A'}`);
      console.log(`   Has Transcript: ${!!analysis.transcript}`);
      console.log(`   Has Recording: ${!!analysis.recording_url}`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

testSpecificTaalkCall();
