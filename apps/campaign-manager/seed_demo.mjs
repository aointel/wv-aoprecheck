/**
 * Seed demo call_intelligence data
 * Run from: cd C:\TaalkCenterTracker && node seed_demo.mjs
 */

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=minimal',
      ...(opts.headers || {}),
    },
  });
  return r;
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function computeGrade(res, dur) {
  const converted = ['booked', 'appointment_set'].includes(res);
  if (converted && dur > 180) return 'A';
  if (converted || dur > 180) return 'B';
  if (res === 'callback_requested') return 'C';
  if (dur < 30) return 'F';
  return 'D';
}

function computeFlags(res, dur) {
  const flags = [];
  if (dur < 30) flags.push('short_call');
  if (['booked','appointment_set'].includes(res)) flags.push('converted');
  if (['no_answer','voicemail'].includes(res)) flags.push('no_answer');
  if (res === 'callback_requested') flags.push('callback');
  if (res === 'do_not_call') flags.push('dnc');
  if (dur > 300) flags.push('long_call');
  return flags;
}

const summaries = {
  booked: [
    "Agent built strong rapport and addressed coverage concerns effectively, securing an appointment.",
    "Clean intro, good discovery questions, prospect agreed to a follow-up appointment.",
    "Agent identified the prospect's family situation and aligned benefits clearly — booked.",
    "Strong call — agent stayed on script, overcame a pricing objection, and set an appointment.",
  ],
  appointment_set: [
    "Smooth call — agent confirmed interest and locked in a time to review the policy.",
    "Prospect was warm, agent closed on an appointment after explaining Globe Life benefits.",
    "Agent asked good qualifying questions and secured a firm appointment.",
  ],
  callback_requested: [
    "Prospect showed interest but asked to be called back at a better time — warm lead.",
    "Agent reached prospect who was busy; callback scheduled for later today.",
    "Decent engagement — prospect wants to discuss with spouse first.",
  ],
  not_interested: [
    "Prospect was unresponsive to the value proposition and disengaged early.",
    "Agent struggled to establish urgency; prospect declined before needs assessment.",
    "No engagement — prospect cut off agent before benefits explanation.",
  ],
  no_answer: ["No answer — call went unanswered.", "Prospect did not pick up."],
  voicemail: ["Left a voicemail with callback number.", "Voicemail left — follow up required."],
  do_not_call: ["Prospect requested to be placed on the DNC list.", "Agent received explicit DNC request."],
};

function getSummary(res) { return pick(summaries[res] || [`Call outcome: ${res}`]); }

const agentProfiles = {
  'johndoe@aoglobelife.com':    { convRate: 0.35, avgDur: 280, callsPerDay: 12, market: 'Veteran' },
  'janesmit@aoglobelife.com':   { convRate: 0.25, avgDur: 220, callsPerDay: 10, market: 'Veteran' },
  'mikejones@aoglobelife.com':  { convRate: 0.15, avgDur: 160, callsPerDay: 8,  market: 'Globe Market' },
  'sarahlee@aoglobelife.com':   { convRate: 0.28, avgDur: 240, callsPerDay: 11, market: 'Globe Market' },
  'tomwilson@aoglobelife.com':  { convRate: 0.08, avgDur: 90,  callsPerDay: 6,  market: 'Veteran' },
};

const records = [];
let callId = 9000;

for (const [email, profile] of Object.entries(agentProfiles)) {
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const dayCallCount = rand(Math.floor(profile.callsPerDay * 0.6), Math.ceil(profile.callsPerDay * 1.2));
    for (let c = 0; c < dayCallCount; c++) {
      const callDate = new Date();
      callDate.setDate(callDate.getDate() - daysAgo);
      callDate.setHours(rand(8, 17), rand(0, 59), rand(0, 59));

      const converted = Math.random() < profile.convRate;
      let res, dur;
      if (converted) {
        res = pick(['booked', 'appointment_set']);
        dur = rand(180, 480);
      } else {
        res = pick(['callback_requested', 'not_interested', 'no_answer', 'voicemail', 'do_not_call']);
        dur = ['no_answer','voicemail'].includes(res) ? rand(5, 25) :
              res === 'do_not_call' ? rand(10, 45) :
              rand(40, 240);
      }

      const grade = computeGrade(res, dur);
      records.push({
        vdp_call_id: `demo-${callId++}`,
        agent_email: email,
        associate_id: null,
        call_date: callDate.toISOString(),
        duration_seconds: dur,
        cnresolution: res,
        intro_score: dur < 30 ? 2 : dur < 90 ? 4 : dur < 180 ? 6 : dur < 300 ? 8 : 10,
        converted,
        outcome_grade: grade,
        ai_summary: getSummary(res),
        talk_ratio_estimate: Math.min(0.9, 0.4 + Math.random() * 0.4),
        flags: computeFlags(res, dur),
        ai_raw: null,
        processed_at: new Date().toISOString(),
      });
    }
  }
}

console.log(`Inserting ${records.length} demo records...`);

const BATCH = 50;
let inserted = 0, errors = 0;
for (let i = 0; i < records.length; i += BATCH) {
  const batch = records.slice(i, i + BATCH);
  const r = await supa('/call_intelligence', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: JSON.stringify(batch),
  });
  if (r.ok || r.status === 201) {
    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${records.length}`);
  } else {
    errors++;
    const err = await r.text();
    if (i === 0) console.log('\nFirst batch error:', err.slice(0, 300));
  }
  await new Promise(r => setTimeout(r, 80));
}

console.log(`\n✓ Done. Inserted: ${inserted}, Errors: ${errors}`);
for (const [email, s] of Object.entries(
  records.reduce((acc, r) => {
    acc[r.agent_email] = acc[r.agent_email] || { total: 0, conv: 0 };
    acc[r.agent_email].total++;
    if (r.converted) acc[r.agent_email].conv++;
    return acc;
  }, {})
)) {
  console.log(`  ${email.split('@')[0]}: ${s.total} calls, ${Math.round(s.conv/s.total*100)}% conv`);
}
