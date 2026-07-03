/**
 * Process Taalk calls from YOUR CSV only.
 * Extracts Taalk_Session IDs from Params, fetches transcript + recording from Taalk,
 * analyzes, uploads recording to Supabase, saves to call analytics (csv-{sessionId}).
 *
 * Usage: npx tsx process-csv-taalk-calls.ts [path-to-csv]
 * Default CSV: 2f38de93-c56e-40da-bfc2-fe936a71f2c0.csv (in cwd or Downloads)
 */

import * as fs from 'fs';
import * as path from 'path';
import { supabaseAdmin } from './server/supabase';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';

const TAALK_API_KEY = process.env.TAALK_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
const TAALK_DB = 'michaelmandella';
const BUCKET = 'verify_agent_screenshot';
const PREFIX = 'call-analysis';

interface Row {
  sessionId: string;
  date: string;
  time: string;
  phone: string;
  leadName?: string;
}

function extractTaalkSessionIds(csvPath: string): Row[] {
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0];
  if (!header.toLowerCase().includes('params') && !header.toLowerCase().includes('taalk')) {
    throw new Error('Expected CSV with Params column containing Taalk_Session');
  }
  const sessionRe = /"Taalk_Session"\s*:\s*"([a-f0-9]+)"/i;
  const firstRe = /"First Name"\s*:\s*"([^"]*)"/;
  const lastRe = /"Last Name"\s*:\s*"([^"]*)"/;
  const phoneRe = /(\+\d{10,15})/;
  const dateRe = /^(\d{1,2}\/\d{1,2}\/\d{4})/;
  const timeRe = /"(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))"/i;
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(sessionRe);
    if (!m) continue;
    const sessionId = m[1];
    if (seen.has(sessionId)) continue;
    seen.add(sessionId);
    const first = firstRe.exec(line)?.[1] ?? '';
    const last = lastRe.exec(line)?.[1] ?? '';
    const leadName = [first, last].filter(Boolean).join(' ').trim() || undefined;
    const date = dateRe.exec(line)?.[1] ?? '';
    const time = timeRe.exec(line)?.[1] ?? '';
    const phone = phoneRe.exec(line)?.[1] ?? '';
    rows.push({ sessionId, date, time, phone, leadName });
  }
  return rows;
}

async function getDuration(sessionId: string): Promise<number | null> {
  try {
    const url = `https://api.taalk.ai/api/calls/${sessionId}?db=${TAALK_DB}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TAALK_API_KEY}`, Accept: 'application/json' } });
    if (!res.ok) return null;
    const d = await res.json();
    const info = d.payload ?? d;
    if (info.duration != null) return Math.round(Number(info.duration) / 1000);
  } catch (_) {}
  return null;
}

async function getTranscript(sessionId: string): Promise<string | null> {
  try {
    const url = `https://api.taalk.ai/api/calls/${sessionId}/transcript?db=${TAALK_DB}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TAALK_API_KEY}`, Accept: 'text/plain' } });
    if (!res.ok) return null;
    return await res.text();
  } catch (_) {}
  return null;
}

async function getRecording(sessionId: string): Promise<Buffer | null> {
  try {
    const url = `https://api.taalk.ai/api/calls/${sessionId}/recording?db=${TAALK_DB}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TAALK_API_KEY}`, Accept: 'audio/mpeg, audio/*, */*' },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('audio') && !ct.includes('octet-stream')) {
      const buf = Buffer.from(await res.arrayBuffer());
      const preview = buf.toString('utf-8', 0, 200);
      if (preview.includes('error') || preview.includes('<!')) return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (_) {}
  return null;
}

async function uploadRecording(sessionId: string, buffer: Buffer): Promise<string | null> {
  const fileName = `${PREFIX}/${sessionId}.mp3`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: true });
  if (uploadErr) return null;
  const { data: urlData } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(fileName, 63072000);
  return urlData?.signedUrl ?? null;
}

async function main() {
  const csvArg = process.argv[2];
  const defaultPaths = [
    path.join(process.cwd(), '2f38de93-c56e-40da-bfc2-fe936a71f2c0.csv'),
    path.join(process.env.USERPROFILE || '', 'Downloads', '2f38de93-c56e-40da-bfc2-fe936a71f2c0.csv'),
  ];
  const csvPath = csvArg
    ? path.resolve(csvArg)
    : defaultPaths.find((p) => fs.existsSync(p)) || defaultPaths[0];

  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  const rows = extractTaalkSessionIds(csvPath);
  console.log(`CSV: ${csvPath}`);
  console.log(`Sessions from CSV: ${rows.length}`);

  const { data: existing } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('taalk_call_id')
    .in('taalk_call_id', rows.map((r) => r.sessionId))
    .eq('analysis_status', 'completed');
  const doneSet = new Set((existing || []).map((r: any) => r.taalk_call_id));
  const todo = rows.filter((r) => !doneSet.has(r.sessionId));
  console.log(`Already in call analytics: ${doneSet.size}`);
  console.log(`To process: ${todo.length}`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < todo.length; i++) {
    const r = todo[i];
    console.log(`\n[${i + 1}/${todo.length}] ${r.sessionId} ${r.phone || ''} ${r.leadName || ''}`);
    try {
      let transcript = await getTranscript(r.sessionId);
      let recordingUrl: string | null = null;
      const recordingBuf = await getRecording(r.sessionId);
      if (recordingBuf && recordingBuf.length > 0) {
        recordingUrl = await uploadRecording(r.sessionId, recordingBuf);
        if (recordingUrl) console.log(`   recording ${(recordingBuf.length / 1024).toFixed(0)} KB -> Supabase`);
      }
      if (!recordingUrl) {
        console.log('   skip: no Taalk recording / upload failed');
        fail++;
        continue;
      }
      if (!transcript || transcript.trim().length < 50) {
        if (recordingBuf && recordingBuf.length > 0) {
          transcript = await callAnalyticsAnalyzer.transcribeAudio(recordingBuf, `${r.sessionId}.mp3`);
          console.log(`   transcribed ${transcript?.length || 0} chars`);
        }
      } else {
        console.log(`   transcript ${transcript.length} chars`);
      }
      if (!transcript || transcript.trim().length < 30) {
        console.log('   skip: no transcript');
        fail++;
        continue;
      }

      const analysis = await callAnalyticsAnalyzer.analyzeTranscriptOnly(transcript);
      const callDuration = await getDuration(r.sessionId);

      const analysisData = {
        billing_transaction_id: `csv-${r.sessionId}`,
        agent_email: 'model-agent@aoglobelife.com',
        call_date: new Date().toISOString(),
        taalk_call_id: r.sessionId,
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
        analysis_version: '1.0',
      };

      const { data: existingRow } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('id')
        .eq('taalk_call_id', r.sessionId)
        .maybeSingle();

      if (existingRow?.id) {
        const { error: uErr } = await supabaseAdmin.from('taalk_call_analytics').update(analysisData).eq('id', existingRow.id);
        if (uErr) throw uErr;
      } else {
        const { error: iErr } = await supabaseAdmin.from('taalk_call_analytics').insert(analysisData);
        if (iErr) throw iErr;
      }
      console.log(`   saved score ${analysis.scorecard.overallScore.toFixed(0)}`);
      ok++;
      await new Promise((x) => setTimeout(x, 300));
    } catch (e: any) {
      console.error(`   err: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} saved, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
