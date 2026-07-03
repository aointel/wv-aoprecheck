/**
 * Analyze model-agent recordings (veteran appointment-setting).
 * Only processes MP3s over 1 MB. Transcribes, extracts script + objection handling,
 * then aggregates into a veteran appointment-setting standard.
 *
 * Usage: npx tsx analyze-model-agent-over-1mb.ts [recordings-dir]
 * Default dir: ./recordings-csv-2f38de93-c56e-40da-bfc2-fe936a71f2c0
 */

import * as fs from 'fs';
import * as path from 'path';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';
import { OPENAI_API_KEY } from './server/hardcoded-config';
import OpenAI from 'openai';

const MIN_BYTES = 1024 * 1024; // 1 MB
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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

async function extractScriptAndObjections(transcript: string, label: string): Promise<{
  scriptOutline: string[];
  objections: Array<{ objection: string; howAgentHandled: string }>;
  keyPhrases: string[];
  summary: string;
}> {
  const prompt = `You are analyzing a sales call where an agent sets appointments with veterans (insurance / benefits). Extract structure and objection handling to build a reusable standard.

**Transcript (${label}):**
${transcript.slice(0, 12000)}

**Extract and respond in JSON only:**
{
  "scriptOutline": ["opening: what agent said", "agenda/consent: how they got buy-in", "qualification: questions asked", "objection handling: how they responded", "close: how they set appointment", "next steps: what was agreed"],
  "objections": [{"objection": "what prospect said", "howAgentHandled": "exact or paraphrase of agent response"}],
  "keyPhrases": ["verbatim or near-verbatim phrases the agent used that work well"],
  "summary": "2-3 sentences on flow and what worked"
}`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You extract script structure and objection handling from call transcripts. Respond only with valid JSON.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 1500,
    temperature: 0.1
  });
  const raw = res.choices[0]?.message?.content || '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  return {
    scriptOutline: Array.isArray(parsed.scriptOutline) ? parsed.scriptOutline : [],
    objections: Array.isArray(parsed.objections) ? parsed.objections : [],
    keyPhrases: Array.isArray(parsed.keyPhrases) ? parsed.keyPhrases : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary : ''
  };
}

async function aggregateStandard(extractions: Array<{ label: string; scriptOutline: string[]; objections: any[]; keyPhrases: string[]; summary: string }>): Promise<string> {
  const payload = JSON.stringify(extractions, null, 2);
  const prompt = `You are creating the official **Veteran Appointment-Setting Standard** from ${extractions.length} model-agent call extractions.

**Per-call extractions:**
${payload.slice(0, 18000)}

**Produce a single markdown document with:**
1. **Script** – Recommended flow (opening, agenda, qualification, close, next steps) with example phrases drawn from the extractions.
2. **Objection handling playbook** – Common objections and how the model agent handles them. Use "Objection" / "Response" pairs.
3. **Key phrases** – 10–15 best phrases to use, verbatim or lightly edited.

Write only the markdown, no preamble.`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You create clear, actionable playbooks from call analyses. Output valid markdown only.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 3000,
    temperature: 0.2
  });
  return res.choices[0]?.message?.content || '';
}

// DISABLED - OpenAI usage disabled for this script (set to false to re-enable)
const ANALYZE_MODEL_AGENT_DISABLED = true;

async function main() {
  if (ANALYZE_MODEL_AGENT_DISABLED) {
    console.error('This script is disabled (OpenAI usage disabled).');
    process.exit(1);
  }

  const recordingsDir = path.resolve(process.argv[2] || path.join(process.cwd(), 'recordings-csv-2f38de93-c56e-40da-bfc2-fe936a71f2c0'));
  if (!fs.existsSync(recordingsDir)) {
    console.error('Recordings dir not found:', recordingsDir);
    process.exit(1);
  }

  const mp3s = findMp3sOver1Mb(recordingsDir);
  console.log(`Found ${mp3s.length} MP3s over 1 MB`);
  mp3s.forEach((m) => console.log(`  ${(m.sizeBytes / 1024).toFixed(0)} KB  ${path.basename(m.path)}`));

  const outDir = path.join(recordingsDir, 'analysis-over-1mb');
  fs.mkdirSync(outDir, { recursive: true });
  const extractions: Array<{ label: string; scriptOutline: string[]; objections: any[]; keyPhrases: string[]; summary: string }> = [];

  for (let i = 0; i < mp3s.length; i++) {
    const m = mp3s[i];
    const label = path.basename(m.path, '.mp3');
    console.log(`\n[${i + 1}/${mp3s.length}] ${label}`);
    try {
      const buf = fs.readFileSync(m.path);
      const transcript = await callAnalyticsAnalyzer.transcribeAudio(buf, path.basename(m.path));
      if (!transcript || transcript.length < 50) {
        console.log('  skip: transcript too short');
        continue;
      }
      console.log(`  transcribed ${transcript.length} chars`);
      const ex = await extractScriptAndObjections(transcript, label);
      extractions.push({ label, ...ex });
      fs.writeFileSync(path.join(outDir, `${m.sessionId}.json`), JSON.stringify({ label, ...ex }, null, 2));
      await new Promise((r) => setTimeout(r, 500));
    } catch (e: any) {
      console.log('  error:', e.message);
    }
  }

  if (extractions.length === 0) {
    console.log('No extractions; skipping aggregate.');
    process.exit(0);
  }

  console.log(`\nAggregating ${extractions.length} extractions into standard...`);
  const standard = await aggregateStandard(extractions);
  const mdPath = path.join(outDir, 'veteran-appointment-setting-standard.md');
  fs.writeFileSync(mdPath, standard, 'utf-8');
  console.log('Wrote', mdPath);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
