/**
 * One-off script: Analyze a local MP3 file using call-analytics (Whisper + GPT)
 * Usage: npx tsx analyze-one-call.ts <path-to-mp3>
 */
import fs from 'fs';
import path from 'path';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';

const mp3Path = process.argv[2] || path.join(process.cwd(), 'twilio-RE3cc501c8d82052c9dc12a30a80c69c6e.mp3');
const resolvedPath = path.resolve(mp3Path);

if (!fs.existsSync(resolvedPath)) {
  console.error('❌ File not found:', resolvedPath);
  process.exit(1);
}

async function main() {
  console.log('📂 Reading:', resolvedPath);
  const buffer = fs.readFileSync(resolvedPath);
  console.log(`   Size: ${(buffer.length / 1024).toFixed(1)} KB\n`);

  console.log('🎤 Transcribing with Whisper...');
  const transcript = await callAnalyticsAnalyzer.transcribeAudio(buffer, path.basename(resolvedPath));

  console.log('\n📝 Transcript:\n' + '-'.repeat(60));
  console.log(transcript);
  console.log('-'.repeat(60) + '\n');

  console.log('🤖 Analyzing with GPT (Chorus/Gong-style scorecard)...');
  const analysis = await callAnalyticsAnalyzer.analyzeTranscript(transcript);

  console.log('\n' + '='.repeat(60));
  console.log('CALL ANALYSIS RESULTS');
  console.log('='.repeat(60));
  console.log('\n📊 Overall Score:', analysis.scorecard.overallScore.toFixed(1), '/ 100');
  console.log('📌 Outcome:', analysis.callOutcome);
  console.log('😊 Sentiment:', analysis.sentiment, `(${analysis.sentimentScore.toFixed(2)})`);
  console.log('⏱️  Agent Talk %:', (analysis.agentTalkTimePct * 100).toFixed(1), '%');
  console.log('👤 Client Engagement:', analysis.clientEngagementLevel);
  console.log('\n📋 Summary:\n', analysis.summary);
  console.log('\n📌 Key Topics:', analysis.keyTopics?.join(', ') || 'N/A');
  console.log('🚫 Objections:', analysis.objectionsDetected?.join(', ') || 'None');
  console.log('\n💡 Coaching Notes:');
  (analysis.coachingNotes || []).forEach((n, i) => console.log(`   ${i + 1}. ${n}`));
  console.log('\n📌 Key Moments:');
  (analysis.keyMoments || []).forEach((m, i) => console.log(`   ${i + 1}. [${m.timestamp}] ${m.description}`));
  console.log('\n✅ Compliance:');
  console.log('   Disclosure:', analysis.complianceFlags?.disclosureRecorded ? '✓' : '✗');
  console.log('   Introduction:', analysis.complianceFlags?.properIntroduction ? '✓' : '✗');
  console.log('   Needs Assessed:', analysis.complianceFlags?.needsAssessed ? '✓' : '✗');
  console.log('   Objections Addressed:', analysis.complianceFlags?.objectionsAddressed ? '✓' : '✗');
  console.log('   Next Steps Set:', analysis.complianceFlags?.nextStepsSet ? '✓' : '✗');
  console.log('   Professional Tone:', analysis.complianceFlags?.professionalTone ? '✓' : '✗');
  console.log('\n' + '='.repeat(60));
  console.log(JSON.stringify({ transcript, ...analysis }, null, 2));
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
