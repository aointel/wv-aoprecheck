/**
 * Process Taalk transfer CSVs and analyze all calls
 * Extracts sessionIDs from Recording URLs and analyzes them
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsScheduler } from './server/call-analytics-scheduler';
import * as fs from 'fs';
import * as path from 'path';

interface CSVRow {
  Date: string;
  Time: string;
  Phone: string;
  Name: string;
  Recording: string;
  [key: string]: string | undefined;
}

function extractSessionID(recordingUrl: string): string | null {
  // Extract sessionID from URL like: https://api.taalk.ai/api/calls/6979854ef44cd3df56c01740/recording?db=michaelmandella
  const match = recordingUrl.match(/\/calls\/([a-f0-9]{24})\//);
  return match ? match[1] : null;
}

function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parsing (handles quoted fields)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row: CSVRow = {} as CSVRow;
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    
    if (row.Recording) {
      rows.push(row);
    }
  }
  
  return rows;
}

async function processCSVFiles() {
  console.log('🚀 Processing Taalk Transfer CSVs...\n');
  
  const csvFiles = [
    '8c1000c3-93ef-4e96-a701-4ec2a6189cb7.csv',
    '8e01ed9b-54a8-4524-8dd5-bf90673c1bd7.csv',
    '643ba479-0181-4d19-9034-91ef6ecbb589.csv',
    '6660fef8-d882-4fe9-af55-242265fed36b.csv'
  ];
  
  const allTransfers: Array<{ sessionID: string; phone: string; name: string; date: string; time: string }> = [];
  
  // Parse all CSV files
  for (const csvFile of csvFiles) {
    const filePath = path.join(process.cwd(), csvFile);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${csvFile}`);
      continue;
    }
    
    console.log(`📄 Processing ${csvFile}...`);
    const rows = parseCSV(filePath);
    
    for (const row of rows) {
      if (!row.Recording) continue;
      
      const sessionID = extractSessionID(row.Recording);
      if (!sessionID) {
        console.warn(`⚠️ Could not extract sessionID from: ${row.Recording}`);
        continue;
      }
      
      allTransfers.push({
        sessionID,
        phone: row.Phone || '',
        name: row.Name || '',
        date: row.Date || '',
        time: row.Time || ''
      });
    }
    
    console.log(`   ✅ Found ${rows.length} transfers in ${csvFile}`);
  }
  
  console.log(`\n📊 Total transfers found: ${allTransfers.length}\n`);
  
  // Check which ones are already analyzed
  const sessionIDs = allTransfers.map(t => t.sessionID);
  const { data: existingAnalyses } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('taalk_call_id, analysis_status')
    .in('taalk_call_id', sessionIDs);
  
  const analyzedSessionIDs = new Set(
    (existingAnalyses || [])
      .filter(a => a.analysis_status === 'completed')
      .map(a => a.taalk_call_id)
  );
  
  const unanalyzed = allTransfers.filter(t => !analyzedSessionIDs.has(t.sessionID));
  
  console.log(`📊 Already analyzed: ${analyzedSessionIDs.size}`);
  console.log(`📊 Need analysis: ${unanalyzed.length}\n`);
  
  // Clean up failed analyses
  console.log('🧹 Cleaning up failed analyses...');
  const { data: failedAnalyses } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, taalk_call_id, analysis_status')
    .eq('analysis_status', 'failed')
    .in('taalk_call_id', sessionIDs);
  
  if (failedAnalyses && failedAnalyses.length > 0) {
    console.log(`   🗑️ Deleting ${failedAnalyses.length} failed analysis records...`);
    const failedIds = failedAnalyses.map(a => a.id);
    await supabaseAdmin
      .from('taalk_call_analytics')
      .delete()
      .in('id', failedIds);
    console.log(`   ✅ Deleted ${failedAnalyses.length} failed records\n`);
  }
  
  // Process unanalyzed transfers
  console.log(`🔍 Processing ${unanalyzed.length} unanalyzed transfers...\n`);
  
  const scheduler = callAnalyticsScheduler as any;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  
  for (const transfer of unanalyzed.slice(0, 50)) { // Process first 50
    try {
      console.log(`\n🔍 Processing: ${transfer.name} (${transfer.phone}) - SessionID: ${transfer.sessionID}`);
      
      // Analyze directly using sessionID - skip vdp_calls lookup
      console.log(`   🎤 Analyzing Taalk call ${transfer.sessionID} directly...`);
      
      const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
      
      // Get call duration from Taalk API
      let callDuration: number | null = null;
      try {
        const detailsUrl = `https://api.taalk.ai/api/calls/${transfer.sessionID}?db=michaelmandella`;
        const detailsRes = await fetch(detailsUrl, { headers: { 'Authorization': `Bearer ${taalkApiKey}`, 'Accept': 'application/json' } });
        if (detailsRes.ok) {
          const d = await detailsRes.json();
          const info = d.payload ?? d;
          if (info.duration != null) callDuration = Math.round(Number(info.duration) / 1000);
        }
      } catch (_) {}
      
      // Get transcript
      let transcript: string | null = null;
      const transcriptUrl = `https://api.taalk.ai/api/calls/${transfer.sessionID}/transcript?db=michaelmandella`;
      const transcriptResponse = await fetch(transcriptUrl, {
        headers: { 'Authorization': `Bearer ${taalkApiKey}`, 'Accept': 'text/plain' }
      });
      
      if (transcriptResponse.ok) {
        transcript = await transcriptResponse.text();
        console.log(`   ✅ Transcript: ${transcript.length} chars`);
      }
      
      // Get recording
      let recordingUrl: string | null = null;
      const taalkRecordingUrl = `https://api.taalk.ai/api/calls/${transfer.sessionID}/recording?db=michaelmandella`;
      const recordingResponse = await fetch(taalkRecordingUrl, {
        headers: { 'Authorization': `Bearer ${taalkApiKey}`, 'Accept': 'audio/mpeg' }
      });
      
      if (recordingResponse.ok) {
        const arrayBuffer = await recordingResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Upload to Supabase
        const fileName = `call-analysis/${transfer.sessionID}.mp3`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('verify_agent_screenshot')
          .upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: true });
        
        if (!uploadError) {
          const { data: urlData } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .createSignedUrl(fileName, 63072000);
          recordingUrl = urlData?.signedUrl || null;
          console.log(`   ✅ Recording uploaded: ${Math.round(buffer.length / 1024)}KB`);
        }
      }
      
      if (!transcript && !recordingUrl) {
        throw new Error('No transcript or recording available');
      }
      
      // Analyze
      const { callAnalyticsAnalyzer } = await import('./server/call-analytics-analyzer');
      let analysis;
      
      if (transcript && transcript.trim().length > 0) {
        analysis = await callAnalyticsAnalyzer.analyzeTranscriptOnly(transcript);
      } else if (recordingUrl) {
        analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl(recordingUrl, null);
      } else {
        throw new Error('No data available for analysis');
      }
      
      // Save to database
      const analysisData = {
        billing_transaction_id: `csv-${transfer.sessionID}`,
        agent_email: 'unknown@aoglobelife.com',
        call_date: new Date().toISOString(),
        taalk_call_id: transfer.sessionID,
        recording_url: recordingUrl,
        call_duration: callDuration,
        transcript: analysis.transcript,
        transcript_source: transcript ? 'taalk_api' : 'ai_transcription',
        ai_analysis: analysis,
        call_score: analysis.scorecard.overallScore,
        scorecard_results: analysis.scorecard,
        coaching_notes: analysis.coachingNotes?.join('\n') || null,
        key_topics: analysis.keyTopics,
        objections_detected: analysis.objectionsDetected,
        sentiment_score: analysis.sentimentScore,
        sentiment_label: analysis.sentiment,
        agent_talk_time_pct: analysis.agentTalkTimePct,
        client_engagement_level: analysis.clientEngagementLevel,
        call_outcome: analysis.callOutcome,
        call_outcome_confidence: analysis.callOutcomeConfidence,
        compliance_flags: analysis.complianceFlags,
        key_moments: analysis.keyMoments,
        analyzed_at: new Date().toISOString(),
        analysis_status: 'completed',
        analysis_model: 'gpt-4o-mini',
        analysis_version: '1.0'
      };
      
      // Upsert
      const { error: upsertError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .upsert(analysisData, { onConflict: 'taalk_call_id' });
      
      if (upsertError) {
        throw new Error(`Database error: ${upsertError.message}`);
      }
      
      console.log(`   ✅ Analysis saved - Score: ${analysis.scorecard.overallScore}`);
      succeeded++;
      processed++;
      console.log(`✅ Successfully analyzed ${transfer.sessionID}`);
    } catch (error: any) {
      console.error(`❌ Failed to analyze ${transfer.sessionID}:`, error.message);
      failed++;
      processed++;
    }
  }
  
  console.log(`\n✅ Processing complete: ${succeeded} succeeded, ${failed} failed, ${processed} total`);
}

processCSVFiles().catch(console.error);
