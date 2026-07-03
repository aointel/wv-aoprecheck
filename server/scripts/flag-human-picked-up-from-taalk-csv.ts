/**
 * Read Taalk CSV (Recording column = Taalk URL), fetch transcript per call,
 * use OpenAI to classify: did a human pick up and engage? Write CSV with new column.
 * Run: npx tsx server/scripts/flag-human-picked-up-from-taalk-csv.ts [path-to-csv] [--limit=N]
 */
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import OpenAI from 'openai';

const DEFAULT_CSV = path.join(process.cwd(), 'server', 'scripts', 'output', 'a6676ea8-2288-41c0-a93c-e16fc2c67877.csv');
const TAALK_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';
const BASIC_AUTH = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
const TAALK_TRANSCRIPT_URL = (id: string) => `https://api.taalk.ai/api/calls/${id}/transcript?db=michaelmandella`;
const OPENAI_DELAY_MS = 400;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      let s = '';
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          s += '"';
          i += 2;
          continue;
        }
        if (line[i] === '"') break;
        s += line[i];
        i++;
      }
      if (line[i] === '"') i++;
      out.push(s);
      if (line[i] === ',') i++;
      continue;
    }
    let s = '';
    while (i < line.length && line[i] !== ',') {
      s += line[i];
      i++;
    }
    out.push(s.trim());
    if (line[i] === ',') i++;
  }
  return out;
}

function escapeCsvField(val: string): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const TAALK_ID_RE = /api\.taalk\.ai\/api\/calls\/([a-f0-9]+)\/recording/;

function extractTaalkCallId(recordingUrl: string): string | null {
  const m = (recordingUrl || '').match(TAALK_ID_RE);
  return m ? m[1] : null;
}

async function fetchTranscript(taalkCallId: string): Promise<string | null> {
  const url = TAALK_TRANSCRIPT_URL(taalkCallId);
  let res = await fetch(url, { headers: { Authorization: `Bearer ${TAALK_API_KEY}` } });
  if (!res.ok) res = await fetch(url, { headers: { Authorization: `Basic ${BASIC_AUTH}` } });
  if (!res.ok) return null;
  const text = await res.text();
  const t = (text || '').trim();
  return t.length > 0 ? t : null;
}

async function classifyHumanPickedUpEngaged(openai: OpenAI, transcript: string | null): Promise<'YES' | 'NO'> {
  const content = transcript && transcript.length > 10
    ? transcript
    : '(No transcript or empty.)';
  const prompt = `You are classifying a call. Based ONLY on the transcript below, answer: Did a human pick up the phone and engage in a real two-way conversation (not voicemail, not beep, not "leave a message", not only the agent talking)?

- YES: A human prospect/recipient spoke and had a back-and-forth dialogue with the agent.
- NO: Voicemail, message machine, beep, no answer, only agent talking, or no real engagement.

Reply with exactly one word: YES or NO.

Transcript:
${content.slice(0, 12000)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You answer only YES or NO for whether a human picked up and engaged. No explanation.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 10,
    });
    const answer = (completion.choices?.[0]?.message?.content ?? '').trim().toUpperCase();
    if (answer.startsWith('YES')) return 'YES';
    return 'NO';
  } catch (e) {
    console.warn('OpenAI error:', (e as Error).message);
    return 'NO';
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  const csvPath = args[0] || DEFAULT_CSV;
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  const apiKey = process.env.OPENAI_API_KEY || (await import('../hardcoded-config.js')).OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey });

  const lines = await new Promise<string[]>((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity });
    const out: string[] = [];
    rl.on('line', (line) => out.push(line));
    rl.on('close', () => resolve(out));
    rl.on('error', reject);
  });

  if (lines.length < 2) {
    console.error('CSV has no data rows');
    process.exit(1);
  }

  const header = parseCsvLine(lines[0]);
  const recIdx = header.findIndex((h) => h.toLowerCase() === 'recording');
  if (recIdx < 0) {
    console.error('No "Recording" column found');
    process.exit(1);
  }

  const outPath = csvPath.replace(/\.csv$/i, '-human-flagged.csv');
  const newHeader = [...header, 'human_picked_up_engaged'];
  const outputLines: string[] = [newHeader.map(escapeCsvField).join(',')];

  const maxRows = limit ? Math.min(limit + 1, lines.length) : lines.length;
  let yesCount = 0;
  let noCount = 0;
  let noTranscript = 0;
  const total = maxRows - 1;
  console.log(`Processing ${total} rows${limit ? ` (--limit=${limit})` : ''}, writing to ${path.basename(outPath)}\n`);

  for (let i = 1; i < maxRows; i++) {
    const cols = parseCsvLine(lines[i]);
    const recording = (cols[recIdx] ?? '').trim();
    const taalkId = extractTaalkCallId(recording);
    let flag: 'YES' | 'NO' = 'NO';

    if (taalkId) {
      const transcript = await fetchTranscript(taalkId);
      if (transcript === null) noTranscript++;
      flag = await classifyHumanPickedUpEngaged(openai, transcript);
      if (flag === 'YES') yesCount++;
      else noCount++;
      if (i <= 5 || i % 500 === 0 || i === lines.length - 1) {
        console.log(`  ${i}/${total} taalk=${taalkId.slice(0, 8)}... => ${flag}`);
      }
      await new Promise((r) => setTimeout(r, OPENAI_DELAY_MS));
    }

    const newRow = [...cols, flag];
    outputLines.push(newRow.map(escapeCsvField).join(','));
  }

  fs.writeFileSync(outPath, outputLines.join('\n'), 'utf8');
  console.log(`\nDone. human_picked_up_engaged: YES=${yesCount} NO=${noCount} (no transcript: ${noTranscript})`);
  console.log('Output:', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
