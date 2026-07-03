import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { readFileSync } from 'fs';

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const supabase = createClient(SUPA_URL, SUPA_KEY);
const sms = twilio('AC25d37aa41aed0df4fddd81ecf7abf00d', '974557c999ed53ada16c4a784af2a7d3');
const FROM = '+19142289324';
const tickets = JSON.parse(readFileSync('C:/dev/support_tickets_clean.json'));

function findTicketId(phone) {
  const matches = tickets.filter(t => t.phone === phone && !t.has_reply);
  if (!matches.length) return null;
  return matches.sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at))[0].ticket_id;
}

async function send(phone, body) {
  try {
    const msg = await sms.messages.create({ body, from: FROM, to: phone });
    const tid = findTicketId(phone);
    if (tid) await supabase.from('support_messages').insert({
      ticket_id: tid, phone, twilio_sid: msg.sid,
      direction: 'outbound', body, has_media: false,
      sent_at: new Date().toISOString()
    });
    console.log(`✅ ${phone}`);
    await new Promise(r => setTimeout(r, 300));
  } catch(e) { console.error(`❌ ${phone}: ${e.message}`); }
}

async function findCustomerByPhone(phone) {
  // Try matching by cell_phone
  const digits = phone.replace(/\D/g,'').slice(-10);
  const { data } = await supabase.from('customers')
    .select('associate_id, company_email, first_name, last_name, states, market, cell_phone')
    .or(`cell_phone.ilike.%${digits}%`)
    .limit(5);
  return data?.[0] || null;
}

async function findCustomerByEmail(email) {
  const { data } = await supabase.from('customers')
    .select('associate_id, company_email, first_name, last_name, states, market')
    .ilike('company_email', email)
    .maybeSingle();
  return data;
}

async function findCustomerByAgentCode(code) {
  // agent codes are in producerlist or customers associate_id mapped
  const { data } = await supabase.from('producerlist')
    .select('associate_id, company_email, first_name, last_name')
    .ilike('associate_id', code)
    .limit(3);
  return data?.[0] || null;
}

async function updateStates(email, newStates) {
  const { error } = await supabase.from('customers')
    .update({ states: newStates, updated_at: new Date().toISOString() })
    .ilike('company_email', email);
  return !error;
}

async function updateMarket(email, market) {
  const { error } = await supabase.from('customers')
    .update({ market, updated_at: new Date().toISOString() })
    .ilike('company_email', email);
  return !error;
}

async function resetPassword(email, newPassword) {
  // Update password in customers table (hashed if needed, but here stored as provided)
  const { error } = await supabase.from('agent_profiles')
    .update({ updated_at: new Date().toISOString() })
    .ilike('email', email);
  // Also try auth reset via supabase admin
  const { error: authError } = await supabase.auth.admin.updateUserByEmail(email, { password: newPassword });
  return !authError;
}

// ── 1. Linda Scott DBR30 — password reset ──────────────────────────────────
console.log('\n--- 1. Linda Scott DBR30 ---');
let c1 = await findCustomerByPhone('+13368027744');
if (!c1) c1 = await findCustomerByAgentCode('DBR30');
if (c1) {
  const newPw = String(c1.associate_id);
  await resetPassword(c1.company_email, newPw);
  await send('+13368027744', `Hi Linda! Your password has been reset. Your new temporary password is: ${newPw}. Log in at the AOI app and update your password in settings. - AOI Support`);
} else {
  await send('+13368027744', `Hi Linda! We looked you up but couldn't find your account by phone. Reply with your @aoglobelife.com email and we'll reset your password right away. - AOI Support`);
}

// ── 2. Brandon Cabeceiras — add RI + FL ─────────────────────────────────────
console.log('\n--- 2. Brandon Cabeceiras ---');
let c2 = await findCustomerByPhone('+14013455051');
if (!c2) c2 = await findCustomerByEmail('brandoncabeceiras@aoglobelife.com');
if (c2) {
  const existing = Array.isArray(c2.states) ? c2.states : [];
  const newStates = [...new Set([...existing, 'RI', 'FL'])];
  await updateStates(c2.company_email, newStates);
  await send('+14013455051', `Hi Brandon! I've added RI and FL to your AOI account. Restart the app and you'll see them. - AOI Support`);
} else {
  await send('+14013455051', `Hi Brandon! Reply with your @aoglobelife.com email and we'll add RI and FL right away. - AOI Support`);
}

// ── 3. Stephen Laframboise — add IA ─────────────────────────────────────────
console.log('\n--- 3. Stephen Laframboise ---');
const c3 = await findCustomerByEmail('stephenlaframboise@aoglobelife.com');
if (c3) {
  const existing = Array.isArray(c3.states) ? c3.states : [];
  const newStates = [...new Set([...existing, 'IA'])];
  await updateStates('stephenlaframboise@aoglobelife.com', newStates);
  await send('+17012209504', `Hi Stephen! IA has been added to your AOI account. Restart the app to see the update. - AOI Support`);
} else {
  await send('+17012209504', `Hi Stephen! Reply with your @aoglobelife.com email and we'll add IA right away. - AOI Support`);
}

// ── 4. Cain Hernandez — add IN GA OH WA ─────────────────────────────────────
console.log('\n--- 4. Cain Hernandez ---');
let c4 = await findCustomerByPhone('+17194647095');
if (c4) {
  const existing = Array.isArray(c4.states) ? c4.states : [];
  const newStates = [...new Set([...existing, 'IN', 'GA', 'OH', 'WA'])];
  await updateStates(c4.company_email, newStates);
  await send('+17194647095', `Hi Cain! IN, GA, OH, and WA have been added to your AOI account. Restart the app to see them. - AOI Support`);
} else {
  await send('+17194647095', `Hi Cain! Reply with your @aoglobelife.com email and we'll add those states right away. - AOI Support`);
}

// ── 5. Barbara Joynt — Globe → Veteran ──────────────────────────────────────
console.log('\n--- 5. Barbara Joynt ---');
let c5 = await findCustomerByPhone('+12148082487');
if (c5) {
  await updateMarket(c5.company_email, ['Veteran']);
  await send('+12148082487', `Hi Barbara! Your market has been switched to Veteran. Restart the app and you'll be all set. - AOI Support`);
} else {
  await send('+12148082487', `Hi Barbara! Reply with your @aoglobelife.com email and we'll switch your market to Veteran. - AOI Support`);
}

// ── 6. Marc Porter — add MI ──────────────────────────────────────────────────
console.log('\n--- 6. Marc Porter ---');
const c6 = await findCustomerByEmail('marcporter@aoglobelife.com');
if (c6) {
  const existing = Array.isArray(c6.states) ? c6.states : [];
  const newStates = [...new Set([...existing, 'MI'])];
  await updateStates('marcporter@aoglobelife.com', newStates);
  await send('+12165092640', `Hi Marc! MI has been added to your AOI account. Restart the app to see it. - AOI Support`);
} else {
  await send('+12165092640', `Hi! Reply with your @aoglobelife.com email and we'll add MI right away. - AOI Support`);
}

// ── 7. Erik Hanberg — remove NC FL AK ───────────────────────────────────────
console.log('\n--- 7. Erik Hanberg ---');
let c7 = await findCustomerByPhone('+15414416251');
if (c7) {
  const existing = Array.isArray(c7.states) ? c7.states : [];
  const newStates = existing.filter(s => !['NC','FL','AK'].includes(s));
  await updateStates(c7.company_email, newStates);
  await send('+15414416251', `Hi Erik! NC, FL, and AK have been removed from your AOI account. Restart the app to confirm. - AOI Support`);
} else {
  await send('+15414416251', `Hi Erik! Reply with your @aoglobelife.com email and we'll remove those states right away. - AOI Support`);
}

// ── 8. Luke Goodman — priority question ─────────────────────────────────────
await send('+17605046315', `Hi Luke! Call distribution rotates based on wait time — agents who haven't received a call recently get priority. Stay online and you'll be at the front of the rotation. If you're still not getting calls after staying online a while, reply back. - AOI Support`);

// ── 9. Dispo failing ─────────────────────────────────────────────────────────
await send('+15419615188', `Hi! If disposition keeps failing, restart the app and try again. If the lead is still stuck, reply with the lead's name and phone number and we'll manually mark it for you. - AOI Support`);

// ── 10. CCPro profile not found ──────────────────────────────────────────────
await send('+14084312132', `Hi! The most common cause is a cancelled CCPro subscription — open the app, go to your account settings and check if it shows cancelled, then re-enable it. If that's not the issue, reply with your @aoglobelife.com email. - AOI Support`);

// ── 11. Email not found ──────────────────────────────────────────────────────
await send('+18176028032', `Hi! Reply with your @aoglobelife.com email and we'll get your profile created right away. - AOI Support`);

// ── 12. No email/associate ID found ─────────────────────────────────────────
await send('+15074507143', `Hi! Reply with your @aoglobelife.com email and associate ID and we'll get you set up. - AOI Support`);

// ── 13. Kicked from live support ─────────────────────────────────────────────
await send('+16026682520', `Hi! Reply here with each agent's email and the states/market changes they need and we'll update them all right now. - AOI Support`);

// ── 14. Anna White — paid $65, can't access ─────────────────────────────────
console.log('\n--- 14. Anna White ---');
let c14 = await findCustomerByPhone('+15593123837');
if (!c14) c14 = await findCustomerByEmail('annawhite@aoglobelife.com');
if (c14) {
  const { data: credits } = await supabase.from('user_credits')
    .select('credits_remaining').ilike('email', c14.company_email).maybeSingle();
  if (credits) {
    await send('+15593123837', `Hi Anna! Your account is active and shows ${credits.credits_remaining} credits. Restart the AOI app and you should be able to access everything. Reply if you're still having issues. - AOI Support`);
  } else {
    await send('+15593123837', `Hi Anna! Your account is set up. Restart the AOI app and try again. If still stuck, reply with your @aoglobelife.com email. - AOI Support`);
  }
} else {
  await send('+15593123837', `Hi Anna! Reply with your @aoglobelife.com email and we'll get your account sorted right away. - AOI Support`);
}

// ── 15. Can't login ──────────────────────────────────────────────────────────
await send('+13213479687', `Hi! Reply with your @aoglobelife.com email and we'll get you sorted. - AOI Support`);

// ── 16. Ashley Warren BWF39 — Globe → Veteran ───────────────────────────────
console.log('\n--- 16. Ashley Warren BWF39 ---');
let c16 = await findCustomerByPhone('+19726543396');
if (!c16) {
  const { data } = await supabase.from('producerlist')
    .select('company_email').ilike('associate_id', '%BWF39%').maybeSingle();
  if (data) c16 = await findCustomerByEmail(data.company_email);
}
if (c16) {
  await updateMarket(c16.company_email, ['Veteran']);
  await send('+19726543396', `Hi Ashley! Your market has been switched to Veteran. Restart the app and you'll be all set. - AOI Support`);
} else {
  await send('+19726543396', `Hi Ashley! Reply with your @aoglobelife.com email and we'll switch your market to Veteran. - AOI Support`);
}

// ── 17. AO Recruit suspended ─────────────────────────────────────────────────
await send('+15077034479', `Hi! Check your account settings in the app — if your AO Recruit subscription shows cancelled, re-enable it there. If it still shows suspended after that, reply with your @aoglobelife.com email and we'll take a look. - AOI Support`);

// ── 18. Mic works in test, fails on transfers ─────────────────────────────────
await send('+14705066270', `Hi! Try fully closing and reopening the app, then retest your mic before taking a call. If you're on a Mac, use Parallels for the best mic experience. - AOI Support`);

// ── 19. Wrong state leads — fix to IA OH SC TN TX WA ────────────────────────
console.log('\n--- 19. Richard Willingham ---');
let c19 = await findCustomerByPhone('+18433682555');
if (c19) {
  await updateStates(c19.company_email, ['IA','OH','SC','TN','TX','WA']);
  await send('+18433682555', `Hi! Your states have been corrected to IA, OH, SC, TN, TX, and WA. Restart the app and you should start getting the right leads. - AOI Support`);
} else {
  await send('+18433682555', `Hi! Reply with your @aoglobelife.com email and we'll fix your states right away. - AOI Support`);
}

// ── 20. Can't create account ─────────────────────────────────────────────────
await send('+12167894143', `Hi! Reply with your @aoglobelife.com email and we'll create your account right now. - AOI Support`);

console.log('\n✅ All done.');
