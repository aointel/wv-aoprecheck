/**
 * Pull real vdp_calls, score them, upsert to call_intelligence
 * Run: cd C:\TaalkCenterTracker && node score_real_calls.mjs
 */

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const OPENAI_KEY = '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';

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=minimal',
      ...(opts.headers || {}),
    },
  });
  return r;
}

// ── Real resolution values from vdp_calls ──
function computeGrade(res, durSecs) {
  const dur = parseFloat(durSecs) || 0;
  const converted = ['appointment_set', 'sold'].includes(res);
  if (converted && dur > 180) return 'A';
  if (converted) return 'B';
  if (res === 'in_progress' && dur > 180) return 'B';  // long engaged call
  if (res === 'in_progress') return 'C';
  if (dur < 30) return 'F';
  return 'D';
}

function computeConverted(res) {
  return ['appointment_set', 'sold'].includes(res);
}

function computeFlags(res, durSecs) {
  const dur = parseFloat(durSecs) || 0;
  const flags = [];
  if (dur < 30) flags.push('short_call');
  if (computeConverted(res)) flags.push('converted');
  if (res === 'not_interested') flags.push('not_interested');
  if (res === 'in_progress') flags.push('callback');
  if (dur > 300) flags.push('long_call');
  if (res === 'sold') flags.push('sale');
  return flags;
}

function buildSummary(call, grade) {
  const dur = parseFloat(call.duration) || 0;
  const name = [call.firstName, call.lastName].filter(Boolean).map(s => s.charAt(0)+s.slice(1).toLowerCase()).join(' ') || 'prospect';
  const durStr = dur >= 60 ? `${Math.round(dur/60)}m` : `${Math.round(dur)}s`;
  const mkt = call.market || '';
  if (call.cnresolution === 'sold') return `Agent closed a sale with ${name} (${mkt}) after ${durStr}. Grade ${grade}.`;
  if (call.cnresolution === 'appointment_set') return `Appointment set with ${name} (${mkt}) after ${durStr} call. Grade ${grade}.`;
  if (call.cnresolution === 'in_progress' && dur > 180) return `Strong engagement with ${name} for ${durStr} — marked in-progress, callback expected. Grade ${grade}.`;
  if (call.cnresolution === 'in_progress') return `Call with ${name} marked in-progress after ${durStr}. Grade ${grade}.`;
  if (dur < 30) return `Very brief contact with ${name} (${durStr}) — no meaningful engagement. Grade ${grade}.`;
  return `Agent contacted ${name} (${mkt}) for ${durStr} — outcome: ${call.cnresolution || 'unresolved'}. Grade ${grade}.`;
}

// ── Fetch all scoreable vdp_calls ──
console.log('Fetching vdp_calls...');
let allCalls = [];
let offset = 0;
const PAGE = 1000;
while (true) {
  const r = await supa(
    `/vdp_calls?select=id,time,company_email,agent,duration,cnresolution,firstName,lastName,mga,market,state&cnresolution=not.is.null&event=eq.END&order=time.desc&limit=${PAGE}&offset=${offset}`
  );
  const batch = await r.json();
  if (!Array.isArray(batch) || batch.length === 0) break;
  allCalls = allCalls.concat(batch);
  if (batch.length < PAGE) break;
  offset += PAGE;
}

// Also grab lowercase 'end' events
const r2 = await supa(`/vdp_calls?select=id,time,company_email,agent,duration,cnresolution,firstName,lastName,mga,market,state&cnresolution=not.is.null&event=eq.end&order=time.desc&limit=2000`);
const batch2 = await r2.json();
if (Array.isArray(batch2)) allCalls = allCalls.concat(batch2);

console.log(`Fetched ${allCalls.length} calls with resolutions`);

// ── Get already-scored IDs ──
const scoredR = await supa('/call_intelligence?select=vdp_call_id&limit=5000&order=processed_at.desc');
const scoredIds = new Set((await scoredR.json()).map(r => String(r.vdp_call_id)));
console.log(`Already scored: ${scoredIds.size}`);

const toScore = allCalls.filter(c => !scoredIds.has(String(c.id)));
console.log(`To score: ${toScore.length}`);

// ── Score and upsert in batches ──
const BATCH = 50;
let scored = 0;
const records = [];

for (const call of toScore) {
  const dur = parseFloat(call.duration) || 0;
  const res = call.cnresolution || '';
  const grade = computeGrade(res, dur);
  const converted = computeConverted(res);

  records.push({
    vdp_call_id: String(call.id),
    agent_email: call.company_email || '',
    associate_id: call.agent ? parseInt(call.agent) : null,
    call_date: call.time,
    duration_seconds: Math.round(dur),
    cnresolution: res,
    intro_score: dur < 30 ? 2 : dur < 90 ? 4 : dur < 180 ? 6 : dur < 300 ? 8 : 10,
    converted,
    outcome_grade: grade,
    ai_summary: buildSummary(call, grade),
    talk_ratio_estimate: Math.min(0.9, 0.5 + (dur / 600) * 0.3),
    flags: computeFlags(res, dur),
    ai_raw: null,
    processed_at: new Date().toISOString(),
  });
}

console.log(`Upserting ${records.length} records...`);
let errors = 0;
for (let i = 0; i < records.length; i += BATCH) {
  const batch = records.slice(i, i + BATCH);
  const r = await supa('/call_intelligence', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: JSON.stringify(batch),
  });
  if (r.ok || r.status === 201) {
    scored += batch.length;
    process.stdout.write(`\r  Scored ${scored}/${records.length}`);
  } else {
    errors++;
    if (errors === 1) console.log('\nFirst error:', (await r.text()).slice(0, 200));
  }
  await new Promise(r => setTimeout(r, 80));
}

console.log(`\n✓ Done. Scored: ${scored}, Errors: ${errors}`);

// ── Summary breakdown ──
const byAgent = {};
for (const r of records) {
  if (!r.agent_email) continue;
  byAgent[r.agent_email] = byAgent[r.agent_email] || { total: 0, conv: 0, grades: {} };
  byAgent[r.agent_email].total++;
  if (r.converted) byAgent[r.agent_email].conv++;
  byAgent[r.agent_email].grades[r.outcome_grade] = (byAgent[r.agent_email].grades[r.outcome_grade]||0)+1;
}

const sorted = Object.entries(byAgent).sort((a,b) => b[1].total - a[1].total).slice(0, 15);
console.log('\nTop agents by call volume:');
for (const [email, s] of sorted) {
  const name = email.split('@')[0];
  const conv = Math.round(s.conv/s.total*100);
  const grades = Object.entries(s.grades).map(([g,n])=>`${g}:${n}`).join(' ');
  console.log(`  ${name}: ${s.total} calls, ${conv}% conv | ${grades}`);
}
