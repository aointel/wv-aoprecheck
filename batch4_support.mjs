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
async function findByPhone(phone) {
  const d = phone.replace(/\D/g,'').slice(-10);
  const { data } = await supabase.from('customers').select('company_email,associate_id,states,market').eq('phone', d).maybeSingle();
  return data;
}

// Delete noise tickets
const noiseIds = [];
const noisePhones = ['+13364836346','+15407424436','+19843129665','+13182183201','+12135870375','+19795756108','+13214232456','+16062731765','+16067767608','+18284122757','+19102241676','+15055899761','+18702755111','+19106031547','+19842817861'];
for (const p of noisePhones) {
  const m = tickets.filter(t => t.phone === p);
  m.forEach(t => noiseIds.push(t.ticket_id));
}
if (noiseIds.length) {
  await supabase.from('support_messages').delete().in('ticket_id', noiseIds);
  await supabase.from('support_tickets').delete().in('id', noiseIds);
  console.log(`🗑️  Deleted ${noiseIds.length} noise tickets`);
}

// 1. Can't get in / scroll
await send('+13373427244', `Hi! Reply with your @aoglobelife.com email and we'll get you sorted. - AOI Support`);

// 2. Can't find Edward Bussell
await send('+14077494105', `Hi! If you're trying to disposition a lead, open their record in the app and select the disposition from the lead detail screen. Reply with your email if you're still stuck. - AOI Support`);

// 3. Screenshot not accepted
await send('+16174618048', `Hi! Reply with your @aoglobelife.com email and we'll add your states manually right now. - AOI Support`);

// 4. Cancel spot
await send('+13524617526', `Hi! Reply with your @aoglobelife.com email and what you'd like cancelled and we'll take care of it. - AOI Support`);

// 5. Robert Speed - profile error
await send('+13072213512', `Hi Robert! Reply with your @aoglobelife.com email and we'll fix your profile right now. - AOI Support`);

// 6. Need help vague
await send('+12102407505', `Hi! Reply with your @aoglobelife.com email and describe what you're running into and we'll help. - AOI Support`);

// 7. Credits -8 (tabled)
await send('+18605025757', `Hi! We've noted your credit concern. Reply with your @aoglobelife.com email and your case will be reviewed. - AOI Support`);

// 8. Nolangie - account created?
const c8 = await findByPhone('+18134307036');
if (c8) {
  await send('+18134307036', `Hi Nolangie! Your account is set up. Download the AOI app and log in with your @aoglobelife.com email. Reply if you run into any issues. - AOI Support`);
} else {
  await send('+18134307036', `Hi Nolangie! Reply with your @aoglobelife.com email and we'll confirm your account is ready. - AOI Support`);
}

// 9. Download help
await send('+17047795880', `Hi! Reply with your @aoglobelife.com email and describe what's happening when you try to download and we'll help. - AOI Support`);

// 10. Secret key
await send('+19407656594', `Hi! Can you describe what you're trying to do? Reply with your @aoglobelife.com email and we'll point you in the right direction. - AOI Support`);

// 11. White blank page
await send('+14406917149', `Hi! Uninstall the app, restart your computer, then reinstall from planetaltig.com. That should clear it. Reply if still happening. - AOI Support`);

// 12. No connect 36hrs / download broken
await send('+16105292605', `Hi! Can you describe what you see when you open the app — are you able to get online at all? Reply with your @aoglobelife.com email too. - AOI Support`);

// 13. VDP error still not working - look up and fix
const c13 = await findByPhone('+13133986164');
if (c13 && c13.associate_id && c13.states && c13.market) {
  await send('+13133986164', `Hi! We've checked your account and it looks set up correctly. Please fully uninstall the app, restart your computer, and reinstall from planetaltig.com. Reply if the VDP error continues. - AOI Support`);
} else if (c13) {
  // Missing data - fix what we can
  const fix = {};
  if (!c13.states || !c13.states.length) fix.states = [];
  if (!c13.market) fix.market = ['Veteran'];
  if (Object.keys(fix).length) await supabase.from('customers').update(fix).ilike('company_email', c13.company_email);
  await send('+13133986164', `Hi! We've updated your account. Please fully close and reopen the AOI app. Reply if you're still seeing the VDP error. - AOI Support`);
} else {
  await send('+13133986164', `Hi! Reply with your @aoglobelife.com email and we'll fix your VDP configuration right now. - AOI Support`);
}

// 14. Down all day frustrated
await send('+12193138372', `Hi! We want to get this sorted. Reply with your @aoglobelife.com email and describe what you're seeing in the app right now. - AOI Support`);

// 15. Sent screenshot no response
await send('+18327993279', `Hi! Reply with your @aoglobelife.com email and describe your issue and we'll help right away. - AOI Support`);

// 16-20: Next batch from remaining
await send('+19712409204', `Hi! Reply with your @aoglobelife.com email and we'll get you sorted. - AOI Support`);
await send('+14243553785', `Hi! Reply with your @aoglobelife.com email and describe what you're running into and we'll help. - AOI Support`);
await send('+12482388782', `Hi! Reply with your @aoglobelife.com email and describe what you need help with and we'll get you sorted. - AOI Support`);
await send('+13612075561', `Hi! Reply with your @aoglobelife.com email and describe what you need help with on AO Intelligence. - AOI Support`);
await send('+15024579550', `Hi! Reply with your @aoglobelife.com email and describe what you need help with and we'll get on it. - AOI Support`);

console.log('\n✅ Batch 4 done.');
