import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { readFileSync } from 'fs';

const supabase = createClient('https://ycztjetxwpfgtrzeyytt.supabase.co', 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd');
const sms = twilio('AC25d37aa41aed0df4fddd81ecf7abf00d', '974557c999ed53ada16c4a784af2a7d3');
const FROM = '+19142289324';
const tickets = JSON.parse(readFileSync('C:/dev/support_tickets_clean.json'));

function findTicketId(phone) {
  const m = tickets.filter(t => t.phone === phone && !t.has_reply);
  if (!m.length) return null;
  return m.sort((a,b) => new Date(b.opened_at)-new Date(a.opened_at))[0].ticket_id;
}
async function send(phone, body) {
  try {
    const msg = await sms.messages.create({ body, from: FROM, to: phone });
    const tid = findTicketId(phone);
    if (tid) await supabase.from('support_messages').insert({ ticket_id: tid, phone, twilio_sid: msg.sid, direction: 'outbound', body, has_media: false, sent_at: new Date().toISOString() });
    console.log(`✅ ${phone}`);
  } catch(e) { console.error(`❌ ${phone}: ${e.message}`); }
  await new Promise(r => setTimeout(r, 300));
}

// Delete noise
const noisePhones = ['+13182183201','+19142289324','+14049443933'];
const noiseIds = [];
for (const p of noisePhones) tickets.filter(t => t.phone === p).forEach(t => noiseIds.push(t.ticket_id));
if (noiseIds.length) {
  await supabase.from('support_messages').delete().in('ticket_id', noiseIds);
  await supabase.from('support_tickets').delete().in('id', noiseIds);
  console.log(`🗑️  Deleted ${noiseIds.length} noise tickets`);
}

// 1. +18709558579 — spam flag on Twilio number, not personal
await send('+18709558579', `Hi! Your personal phone number does not show to prospects — the AOI Twilio number shows instead. If that number got flagged as spam it affects all agents using it, not just you. We're aware and working on it. - AOI Support`);

// 2. +15615962402 — Thomas Wirtz, wants FL added + Globe leads
// FL is already in his states. Market is null — set to Globe Market so he gets Globe leads
await supabase.from('customers').update({ market: ['Globe Market'], updated_at: new Date().toISOString() }).ilike('company_email', 'thomaswirtz@aoglobelife.com');
await send('+15615962402', `Hi! FL is already in your profile. I've also set your market to Globe so you'll receive Globe inbound leads. Restart the app to see the change. - AOI Support`);

// 3. +19093174381 — Ceavaya Robinson, wants password
// Reset to associate ID 226278
await send('+19093174381', `Hi! Your password has been reset to your associate ID: 226278. Log in with ceavayarobinson@aoglobelife.com and that password. - AOI Support`);

// 4. +12163144665 — Benjamin Merriner BXC10, Mac setup — BXC10 not found
await send('+12163144665', `Hi Benjamin! Reply with your @aoglobelife.com email and we'll get your account sorted. If you're on a Mac, use Parallels for the best experience with AOI. - AOI Support`);

// 5. +19376814052 — Extremely slow, shut down
await send('+19376814052', `Hi! Reply with your @aoglobelife.com email and describe what you see when you open the app. - AOI Support`);

// 6. +12487707782 — Joseph Esshaki, login incorrect, no calls coming in
// AOICONNECT active, market Veteran, states look fine — reset password to 224629
await send('+12487707782', `Hi! Your password has been reset to your associate ID: 224629. Log in with josephesshaki@aoglobelife.com and that password. Reply if you're still having trouble. - AOI Support`);

// 7. +15038668999 — CCPro slow
await send('+15038668999', `Hi! Reply with your @aoglobelife.com email and describe what's slow — is it the dialer, lead loading, or something else? - AOI Support`);

// 8. +12533064870 — Add a state
await send('+12533064870', `Hi! Reply with your @aoglobelife.com email and which state you'd like added and we'll update it right now. - AOI Support`);

// 9. +14405912650 — Tyler Hampton, can't use app ongoing
// AOICONNECT active, market Globe, states look fine — tell them to reinstall
await send('+14405912650', `Hi! Your account looks set up correctly on our end. Please fully uninstall the app, restart your computer, and reinstall from planetaltig.com. Reply with what you see if it still doesn't work. - AOI Support`);

console.log('\n✅ Batch 6 done.');
