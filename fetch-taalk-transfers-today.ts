/**
 * Fetch today's transfers from Taalk API and store in taalk_call_analytics
 * Same approach as AO precheck management
 * 
 * Usage: npx tsx fetch-taalk-transfers-today.ts
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';

const TAALK_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';

interface TaalkCall {
  _id: string;
  status?: string;
  name?: string;
  phone?: string;
  agent?: string;
  duration?: number;
  durationAfterTransfer?: number;
  hasRedirectCall?: boolean;
  createdAt?: string;
  created_at?: string;
  params?: {
    Taalk_ClientPhone?: string;
    Taalk_MemberPhone?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

// Fetch calls from Taalk API for today
async function fetchTaalkCallsToday(): Promise<TaalkCall[]> {
  console.log('📞 Fetching today\'s calls from Taalk API...');
  
  const allCalls: TaalkCall[] = [];
  let offset = 0;
  const pageSize = 20;
  
  // Get today's date range in PST/PDT
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  
  while (allCalls.length < 1000) {
    const url = `https://api.taalk.ai/api/calls?db=michaelmandella&limit=${pageSize}&offset=${offset}&tz=America/Los_Angeles`;
    
    console.log(`  📥 Fetching calls ${offset + 1}-${offset + pageSize}...`);
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TAALK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch calls: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText.substring(0, 300)}`);
      break;
    }
    
    const data = await response.json();
    
    // Handle different response formats
    let calls: TaalkCall[] = [];
    if (Array.isArray(data)) {
      calls = data;
    } else if (Array.isArray(data.payload)) {
      calls = data.payload;
    } else if (data.data && Array.isArray(data.data)) {
      calls = data.data;
    } else if (data.calls && Array.isArray(data.calls)) {
      calls = data.calls;
    }
    
    if (calls.length === 0) {
      break;
    }
    
    // Filter for today's calls
    const todayCalls = calls.filter(call => {
      const callDate = call.createdAt || call.created_at;
      if (!callDate) return false;
      const callTime = new Date(callDate).getTime();
      return callTime >= todayStart.getTime() && callTime <= todayEnd.getTime();
    });
    
    allCalls.push(...todayCalls);
    console.log(`  ✅ Found ${todayCalls.length} calls from today (total: ${allCalls.length})`);
    
    // If we got fewer calls than pageSize, we've reached the end
    if (calls.length < pageSize) {
      break;
    }
    
    // If the oldest call is before today, stop fetching
    const oldestCall = calls[calls.length - 1];
    const oldestDate = oldestCall?.createdAt || oldestCall?.created_at;
    if (oldestDate) {
      const oldestTime = new Date(oldestDate).getTime();
      if (oldestTime < todayStart.getTime()) {
        console.log('  ⏹️  Reached calls from before today, stopping');
        break;
      }
    }
    
    offset += pageSize;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`✅ Found ${allCalls.length} calls from today`);
  return allCalls;
}

// Get agent email from Taalk agent ID
async function getAgentEmailFromTaalkAgent(taalkAgentId: string): Promise<string> {
  if (!taalkAgentId) return 'unknown@aoglobelife.com';
  
  // Try to get from database first
  if (supabaseAdmin) {
    try {
      // Check customers table
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email')
        .or(`associate_id.eq.${taalkAgentId},company_email.ilike.%${taalkAgentId}%`)
        .maybeSingle();
      
      if (customer) {
        return (customer.company_email || customer.personal_email || 'unknown@aoglobelife.com').toLowerCase();
      }
      
      // Check producerlist
      const { data: producer } = await supabaseAdmin
        .from('producerlist')
        .select('company_email')
        .or(`associate_id.eq.${taalkAgentId},company_email.ilike.%${taalkAgentId}%`)
        .maybeSingle();
      
      if (producer?.company_email) {
        return producer.company_email.toLowerCase();
      }
    } catch (error) {
      // Fall through to default
    }
  }
  
  // Default: construct email from agent ID
  if (taalkAgentId.includes('@')) {
    return taalkAgentId.toLowerCase();
  }
  
  return `${taalkAgentId}@aoglobelife.com`;
}

// Extract phone number from call data
function extractPhoneNumber(call: TaalkCall): string | null {
  if (call.params?.Taalk_ClientPhone) {
    return call.params.Taalk_ClientPhone.replace(/[+\s-()]/g, '');
  }
  if (call.params?.Taalk_MemberPhone) {
    return call.params.Taalk_MemberPhone.replace(/[+\s-()]/g, '');
  }
  if (call.phone) {
    if (call.phone.startsWith('+')) {
      return call.phone.replace(/[+\s-()]/g, '');
    }
    // Handle complex format: "6692192599,,5897015416#,,#,,1#"
    const phoneParts = call.phone.split(',');
    for (let i = 1; i < phoneParts.length; i++) {
      const part = phoneParts[i];
      if (part && part.includes('#')) {
        const cleaned = part.split('#')[0].trim();
        if (cleaned && cleaned.length >= 10 && /^\d+$/.test(cleaned)) {
          return cleaned;
        }
      }
    }
    if (phoneParts[0]) {
      const firstPart = phoneParts[0].replace(/[+\s-()]/g, '');
      if (firstPart && firstPart.length >= 10 && /^\d+$/.test(firstPart)) {
        return firstPart;
      }
    }
  }
  return null;
}

// Look up lead information from masterlead table
async function getLeadInfoFromMasterlead(phoneNumber: string, agentEmail: string): Promise<any> {
  if (!phoneNumber || !agentEmail || !supabaseAdmin) {
    return null;
  }
  
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  // Try multiple phone formats
  const phoneVariations = [
    cleanPhone,
    `1${cleanPhone}`,
    cleanPhone.length === 11 && cleanPhone.startsWith('1') ? cleanPhone.substring(1) : null
  ].filter(Boolean);
  
  for (const phone of phoneVariations) {
    try {
      // Try with cn_phone and cn_email match
      const { data: lead } = await supabaseAdmin
        .from('masterlead')
        .select('*')
        .eq('cn_phone', phone)
        .eq('cn_email', agentEmail.toLowerCase())
        .maybeSingle();
      
      if (lead) {
        return {
          lead_id: lead.id,
          lead_name: `${lead.taalk_firstname || lead.first_name || ''} ${lead.taalk_lastname || lead.last_name || ''}`.trim(),
          lead_phone: lead.cn_phone || lead.phone,
          lead_email: lead.taalk_email || lead.email,
          lead_city: lead.taalk_city || lead.city,
          lead_state: lead.taalk_state || lead.state,
          lead_market: lead.taalk_groupname || lead.taalk_market,
          lead_address: lead.taalk_address || lead.address,
          lead_zip: lead.zip
        };
      }
      
      // Try with just phone match (broader search)
      const { data: leadByPhone } = await supabaseAdmin
        .from('masterlead')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();
      
      if (leadByPhone) {
        return {
          lead_id: leadByPhone.id,
          lead_name: `${leadByPhone.taalk_firstname || leadByPhone.first_name || ''} ${leadByPhone.taalk_lastname || leadByPhone.last_name || ''}`.trim(),
          lead_phone: leadByPhone.cn_phone || leadByPhone.phone,
          lead_email: leadByPhone.taalk_email || leadByPhone.email,
          lead_city: leadByPhone.taalk_city || leadByPhone.city,
          lead_state: leadByPhone.taalk_state || leadByPhone.state,
          lead_market: leadByPhone.taalk_groupname || leadByPhone.taalk_market,
          lead_address: leadByPhone.taalk_address || leadByPhone.address,
          lead_zip: leadByPhone.zip
        };
      }
    } catch (error) {
      // Continue to next variation
      continue;
    }
  }
  
  return null;
}

// Store transfer call in database
async function storeTransferCall(call: TaalkCall): Promise<void> {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin not initialized');
    }
    
    // Only process transfers (calls with hasRedirectCall or durationAfterTransfer)
    const isTransfer = call.hasRedirectCall === true || 
                      (call.durationAfterTransfer !== undefined && 
                       call.durationAfterTransfer !== null && 
                       call.durationAfterTransfer > 0);
    
    if (!isTransfer) {
      return; // Skip non-transfer calls
    }
    
    const transactionId = `taalk_${call._id}`;
    
    // Check if already exists
    const { data: existing } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id')
      .eq('billing_transaction_id', transactionId)
      .maybeSingle();
    
    if (existing) {
      // Update existing record with lead info and/or analysis if missing
      const { data: existingFull } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('ai_analysis, transcript, analysis_status, call_score')
        .eq('id', existing.id)
        .single();
      
      const hasLeadInfo = existingFull?.ai_analysis?.lead_info;
      const needsAnalysis = (existingFull?.analysis_status !== 'completed' || !existingFull?.call_score) && existingFull?.transcript;
      
      let updated = false;
      
      // Update lead info if missing
      if (!hasLeadInfo) {
        const clientPhone = extractPhoneNumber(call);
        const agentEmail = await getAgentEmailFromTaalkAgent(call.agent || '');
        
        if (clientPhone) {
          const leadInfo = await getLeadInfoFromMasterlead(clientPhone, agentEmail);
          if (leadInfo) {
            const leadInfoJsonb = {
              lead_id: leadInfo.lead_id,
              lead_name: leadInfo.lead_name,
              lead_phone: leadInfo.lead_phone,
              lead_email: leadInfo.lead_email,
              lead_city: leadInfo.lead_city,
              lead_state: leadInfo.lead_state,
              lead_market: leadInfo.lead_market,
              lead_address: leadInfo.lead_address,
              lead_zip: leadInfo.lead_zip
            };
            
            const currentAnalysis = existingFull?.ai_analysis || {};
            await supabaseAdmin
              .from('taalk_call_analytics')
              .update({
                ai_analysis: { ...currentAnalysis, lead_info: leadInfoJsonb }
              })
              .eq('id', existing.id);
            
            console.log(`  ✅ Updated existing call ${call._id} with lead info: ${leadInfo.lead_name}`);
            updated = true;
          }
        }
      }
      
      // Always fetch fresh transcript from Taalk and analyze
      let transcriptToAnalyze = existingFull.transcript;
      
      // Fetch fresh transcript from Taalk
      console.log(`  📝 Fetching fresh transcript from Taalk for ${call._id}...`);
      try {
        const transcriptUrl = `https://api.taalk.ai/api/calls/${call._id}/transcript?db=michaelmandella`;
        const transcriptResponse = await fetch(transcriptUrl, {
          headers: { 'Authorization': `Bearer ${TAALK_API_KEY}` }
        });
        
        if (transcriptResponse.ok) {
          const freshTranscript = await transcriptResponse.text();
          if (freshTranscript && freshTranscript.trim().length > 0) {
            transcriptToAnalyze = freshTranscript;
            // Update the transcript in database
            await supabaseAdmin
              .from('taalk_call_analytics')
              .update({ transcript: freshTranscript, transcript_source: 'taalk_api' })
              .eq('id', existing.id);
            console.log(`  ✅ Fetched fresh transcript (${freshTranscript.length} chars)`);
          } else {
            console.log(`  ⚠️  Fresh transcript is empty`);
          }
        } else {
          console.log(`  ⚠️  Could not fetch transcript: ${transcriptResponse.status}`);
        }
      } catch (error: any) {
        console.error(`  ❌ Error fetching transcript: ${error.message}`);
      }
      
      // Analyze if we have a transcript
      if (transcriptToAnalyze && transcriptToAnalyze.trim().length > 0) {
        console.log(`  🎤 Analyzing call ${call._id} with transcript (${transcriptToAnalyze.length} chars)...`);
        try {
          const analysis = await callAnalyticsAnalyzer.analyzeTranscriptOnly(transcriptToAnalyze);
          console.log(`  ✅ Analysis complete - Score: ${analysis.scorecard.overallScore.toFixed(1)}/100`);
          
          const currentAnalysis = existingFull?.ai_analysis || {};
          const updatedAnalysis = {
            ...currentAnalysis,
            ...(analysis.aiAnalysis || {}),
            lead_info: currentAnalysis.lead_info // Preserve lead_info
          };
          
          await supabaseAdmin
            .from('taalk_call_analytics')
            .update({
              call_score: analysis.scorecard.overallScore,
              scorecard_results: analysis.scorecard,
              coaching_notes: analysis.coachingNotes,
              key_topics: analysis.keyTopics,
              objections_detected: analysis.objections,
              sentiment_score: analysis.sentimentScore,
              sentiment_label: analysis.sentiment,
              agent_talk_time_pct: analysis.agentTalkTimePct,
              client_engagement_level: analysis.clientEngagementLevel,
              call_outcome: analysis.callOutcome,
              call_outcome_confidence: analysis.callOutcomeConfidence,
              compliance_flags: analysis.complianceFlags,
              key_moments: analysis.keyMoments,
              ai_analysis: updatedAnalysis,
              analysis_status: 'completed',
              analyzed_at: new Date().toISOString()
            })
            .eq('id', existing.id);
          
          console.log(`  ✅ Updated existing call ${call._id} with analysis results`);
          updated = true;
        } catch (analysisError: any) {
          console.error(`  ❌ Analysis failed: ${analysisError.message}`);
        }
      }
      
      if (!updated) {
        console.log(`  ⚠️  Call ${call._id} already exists and is up to date`);
      }
      return;
    }
    
    // Get agent email
    const agentEmail = await getAgentEmailFromTaalkAgent(call.agent || '');
    
    // Extract phone number
    const clientPhone = extractPhoneNumber(call);
    
    // Get call date
    const callDate = call.createdAt || call.created_at || new Date().toISOString();
    
    // Look up lead information from masterlead
    let leadInfo = null;
    if (clientPhone) {
      leadInfo = await getLeadInfoFromMasterlead(clientPhone, agentEmail);
      if (leadInfo) {
        console.log(`  📋 Found lead info: ${leadInfo.lead_name} (${leadInfo.lead_phone})`);
      } else {
        console.log(`  ⚠️  No lead found in masterlead for phone: ${clientPhone}`);
      }
    }
    
    // Fetch transcript from Taalk
    let transcript: string | null = null;
    try {
      const transcriptUrl = `https://api.taalk.ai/api/calls/${call._id}/transcript?db=michaelmandella`;
      console.log(`  📝 Fetching transcript from: ${transcriptUrl}`);
      const transcriptResponse = await fetch(transcriptUrl, {
        headers: { 'Authorization': `Bearer ${TAALK_API_KEY}` }
      });
      
      if (transcriptResponse.ok) {
        transcript = await transcriptResponse.text();
        console.log(`  ✅ Got transcript (${transcript.length} chars)`);
      } else {
        console.log(`  ⚠️  Transcript not available: ${transcriptResponse.status} ${transcriptResponse.statusText}`);
      }
    } catch (error: any) {
      console.error(`  ❌ Error fetching transcript: ${error.message}`);
    }
    
    // Get recording URL
    const recordingUrl = `https://api.taalk.ai/api/calls/${call._id}/recording?db=michaelmandella`;
    
    // Prepare lead info JSONB
    const leadInfoJsonb = leadInfo ? {
      lead_id: leadInfo.lead_id,
      lead_name: leadInfo.lead_name,
      lead_phone: leadInfo.lead_phone,
      lead_email: leadInfo.lead_email,
      lead_city: leadInfo.lead_city,
      lead_state: leadInfo.lead_state,
      lead_market: leadInfo.lead_market,
      lead_address: leadInfo.lead_address,
      lead_zip: leadInfo.lead_zip
    } : null;
    
    // Insert into database
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .insert({
        billing_transaction_id: transactionId,
        agent_email: agentEmail,
        call_date: callDate,
        taalk_call_id: call._id,
        recording_url: recordingUrl,
        transcript: transcript || null,
        transcript_source: transcript ? 'taalk_api' : null,
        analysis_status: 'pending',
        ai_analysis: leadInfoJsonb ? { lead_info: leadInfoJsonb } : null
      })
      .select()
      .single();
    
    if (insertError) {
      throw insertError;
    }
    
    console.log(`  ✅ Stored transfer call ${call._id} with ID: ${inserted.id}`);
    
    // If we have transcript, analyze it immediately
    if (transcript && transcript.trim().length > 0) {
      console.log(`  🎤 Auto-analyzing call ${call._id} with transcript...`);
      try {
        const analysis = await callAnalyticsAnalyzer.analyzeTranscriptOnly(transcript);
        console.log(`  ✅ Analysis complete - Score: ${analysis.scorecard.overallScore.toFixed(1)}/100`);
        
        // Preserve lead_info when updating with analysis
        const currentAnalysis = inserted.ai_analysis || {};
        const updatedAnalysis = {
          ...currentAnalysis,
          ...(analysis.aiAnalysis || {}),
          // Preserve lead_info if it exists
          lead_info: currentAnalysis.lead_info || leadInfoJsonb
        };
        
        await supabaseAdmin
          .from('taalk_call_analytics')
          .update({
            call_score: analysis.scorecard.overallScore,
            scorecard_results: analysis.scorecard,
            coaching_notes: analysis.coachingNotes,
            key_topics: analysis.keyTopics,
            objections_detected: analysis.objections,
            sentiment_score: analysis.sentimentScore,
            sentiment_label: analysis.sentiment,
            agent_talk_time_pct: analysis.agentTalkTimePct,
            client_engagement_level: analysis.clientEngagementLevel,
            call_outcome: analysis.callOutcome,
            call_outcome_confidence: analysis.callOutcomeConfidence,
            compliance_flags: analysis.complianceFlags,
            key_moments: analysis.keyMoments,
            ai_analysis: updatedAnalysis,
            analysis_status: 'completed',
            analyzed_at: new Date().toISOString()
          })
          .eq('id', inserted.id);
        
        console.log(`  ✅ Updated call ${call._id} with analysis results`);
      } catch (analysisError: any) {
        console.error(`  ❌ Auto-analysis failed: ${analysisError.message}`);
        console.error(`  ❌ Stack: ${analysisError.stack}`);
      }
    } else {
      console.log(`  ⚠️  No transcript available for analysis (transcript: ${transcript ? 'empty' : 'null'})`);
    }
  } catch (error: any) {
    console.error(`  ❌ Error storing call ${call._id}:`, error.message);
    throw error;
  }
}

// Main function
async function fetchTaalkTransfersToday() {
  console.log('🚀 Fetching today\'s Taalk transfers...\n');
  
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin not initialized');
    }
    
    // Fetch today's calls from Taalk
    const calls = await fetchTaalkCallsToday();
    
    if (calls.length === 0) {
      console.log('⚠️  No calls found for today');
      return;
    }
    
    // Filter for transfers only and deduplicate by _id
    const transferMap = new Map<string, TaalkCall>();
    calls.forEach(call => {
      const isTransfer = call.hasRedirectCall === true || 
                        (call.durationAfterTransfer !== undefined && 
                         call.durationAfterTransfer !== null && 
                         call.durationAfterTransfer > 0);
      
      if (isTransfer && call._id && !transferMap.has(call._id)) {
        transferMap.set(call._id, call);
      }
    });
    
    const transfers = Array.from(transferMap.values());
    
    console.log(`\n📊 Found ${transfers.length} unique transfers out of ${calls.length} total calls\n`);
    
    if (transfers.length === 0) {
      console.log('⚠️  No transfers found for today');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each transfer
    for (let i = 0; i < transfers.length; i++) {
      const call = transfers[i];
      console.log(`\n[${i + 1}/${transfers.length}] Processing transfer ${call._id}...`);
      
      try {
        await storeTransferCall(call);
        successCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`  ❌ Failed to process ${call._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n✨ Done!`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
fetchTaalkTransfersToday()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

export { fetchTaalkTransfersToday };
