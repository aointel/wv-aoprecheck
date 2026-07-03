/**
 * Upload analyzed model-agent calls (MP3s >1 MB) to call analytics.
 * Transcribes, runs scorecard analysis, uploads recording to Supabase, upserts taalk_call_analytics.
 *
 * Usage: npx tsx upload-model-agent-to-analytics.ts [recordings-dir]
 * Default: ./recordings-csv-2f38de93-c56e-40da-bfc2-fe936a71f2c0
 */

import * as fs from 'fs';
import * as path from 'path';
import { supabaseAdmin } from './server/supabase';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';

const MIN_BYTES = 1024 * 1024; // 1 MB
const TAALK_API_KEY = process.env.TAALK_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
const TAALK_DB = 'michaelmandella';
const BUCKET = 'verify_agent_screenshot';
const PREFIX = 'call-analysis';

function findMp3sOver1Mb(dir: string): { path: string; sizeBytes: number; sessionId: string }[] {
  const seen = new Set<string>();
  const out: { path: string; sizeBytes: number; sessionId: string }[] = [];
  function walk(d: string) {
    const ents = fs.readdirSync(d, { withFileTypes: true });
    for (const e of ents) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.toLowerCase().endsWith('.mp3')) {
        const st = fs.statSync(full);
        if (st.size < MIN_BYTES) continue;
        const sid = (e.name.match(/([a-f0-9]{24})\.mp3$/i) || [])[1] || e.name;
        if (seen.has(sid)) continue;
        seen.add(sid);
        out.push({ path: full, sizeBytes: st.size, sessionId: sid });
      }
    }
  }
  walk(dir);
  return out;
}

async function getDurationFromTaalk(sessionId: string): Promise<number | null> {
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

async function uploadRecording(sessionId: string, buffer: Buffer): Promise<string | null> {
  const fileName = `${PREFIX}/${sessionId}.mp3`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: true });
  if (uploadErr) {
    console.error(`   ❌ Upload failed: ${uploadErr.message}`);
    return null;
  }
  const { data: urlData } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(fileName, 63072000);
  return urlData?.signedUrl ?? null;
}

async function main() {
  const recordingsDir = path.resolve(process.argv[2] || path.join(process.cwd(), 'recordings-csv-2f38de93-c56e-40da-bfc2-fe936a71f2c0'));
  if (!fs.existsSync(recordingsDir)) {
    console.error('Recordings dir not found:', recordingsDir);
    process.exit(1);
  }

  const mp3s = findMp3sOver1Mb(recordingsDir);
  console.log(`Found ${mp3s.length} MP3s over 1 MB`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < mp3s.length; i++) {
    const m = mp3s[i];
    console.log(`\n[${i + 1}/${mp3s.length}] ${m.sessionId}`);
    try {
      const buf = fs.readFileSync(m.path);
      const transcript = await callAnalyticsAnalyzer.transcribeAudio(buf, path.basename(m.path));
      if (!transcript || transcript.length < 50) {
        console.log('   skip: transcript too short');
        fail++;
        continue;
      }
      console.log(`   transcribed ${transcript.length} chars`);

      const analysis = await callAnalyticsAnalyzer.analyzeTranscriptOnly(transcript);
      const callDuration = await getDurationFromTaalk(m.sessionId);
      const recordingUrl = await uploadRecording(m.sessionId, buf);
      if (!recordingUrl) {
        console.log('   skip: could not upload recording');
        fail++;
        continue;
      }
      console.log(`   uploaded recording, duration ${callDuration ?? '?'}s`);

      const analysisData = {
        billing_transaction_id: `csv-${m.sessionId}`,
        agent_email: 'model-agent@aoglobelife.com',
        call_date: new Date().toISOString(),
        taalk_call_id: m.sessionId,
        recording_url: recordingUrl,
        call_duration: callDuration,
        transcript: analysis.transcript,
        transcript_source: 'ai_transcription',
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

      const { data: existing } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('id')
        .eq('taalk_call_id', m.sessionId)
        .maybeSingle();

      if (existing?.id) {
        const { error: updateErr } = await supabaseAdmin
          .from('taalk_call_analytics')
          .update(analysisData)
          .eq('id', existing.id);
        if (updateErr) {
          console.error(`   ❌ DB update: ${updateErr.message}`);
          fail++;
          continue;
        }
      } else {
        const { error: insertErr } = await supabaseAdmin
          .from('taalk_call_analytics')
          .insert(analysisData);
        if (insertErr) {
          console.error(`   ❌ DB insert: ${insertErr.message}`);
          fail++;
          continue;
        }
      }
      console.log(`   ✅ saved (score ${analysis.scorecard.overallScore.toFixed(0)})`);
      ok++;
      await new Promise((r) => setTimeout(r, 400));
    } catch (e: any) {
      console.error(`   ❌ ${e.message}`);
      fail++;
    }
  }

  console.log(`\n--- Done: ${ok} uploaded, ${fail} failed ---`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
