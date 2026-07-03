/**
 * Pull Taalk_Session IDs from CSV only. No downloads.
 * Usage: npx tsx pull-sessions-from-csv.ts <path-to-csv>
 */

import * as fs from 'fs';
import * as path from 'path';

const sessionRe = /"Taalk_Session"\s*:\s*"([a-f0-9]+)"/gi;

function pullSessions(csvPath: string): string[] {
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    let m: RegExpExecArray | null;
    sessionRe.lastIndex = 0;
    while ((m = sessionRe.exec(lines[i])) !== null) {
      const id = m[1];
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

const csvPath = process.argv[2];
if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('Usage: npx tsx pull-sessions-from-csv.ts <path-to-csv>');
  process.exit(1);
}

const sessions = pullSessions(csvPath);
const outPath = path.join(path.dirname(csvPath), 'sessions.txt');
fs.writeFileSync(outPath, sessions.join('\n'), 'utf-8');
console.log(sessions.length, 'sessions ->', outPath);
sessions.forEach((s) => console.log(s));
