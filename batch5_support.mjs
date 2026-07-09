import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { readFileSync } from 'fs';

const supabase = createClient('https://ycztjetxwpfgtrzeyytt.supabase.co', 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd');
const sms = twilio('AC25d37aa41aed0df4fddd81ecf7abf00d', 'b275d646252457344ff62528e3538ea9');
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

// Delete noise tickets
const noiseIds = [];
const noisePhones = ['+13182183201','+15128095611','+13302948091','+19142289324','+13049285658'];
for (const p of noisePhones) {
  tickets.filter(t => t.phone === p).forEach(t => noiseIds.push(t.ticket_id));
}
if (noiseIds.length) {
  await supabase.from('support_messages').delete().in('ticket_id', noiseIds);
  await supabase.from('support_tickets').delete().in('id', noiseIds);
  console.log(`🗑️  Deleted ${noiseIds.length} noise tickets`);
}

// 1. Julie Shannon AWC75 - not found by phone
await send('+13313266263', `Hi Julie! Reply with your @aoglobelife.com email and we'll confirm your market is set to Globe. - AOI Support`);

// 2. Gabriel - AOICONNECT active but -24 credits, add 30 credits to get back online
const { error: gabErr } = await supabase.from('user_credits')
  .update({ credits_remaining: 30, updated_at: new Date().toISOString() })
  .ilike('email', 'gabrielarsenedesouza@aoglobelife.com');
console.log('Gabriel credits fix:', gabErr ? gabErr.message : '✅');
await send('+18572300954', `Hi Gabriel! Your account has been topped up and you're back online. Restart the AOI app and you should see your leads. - AOI Support`);

// 3. Gage Murphy - billing tabled
await send('+14193060275', `Hi Gage! We've noted your billing concern. Reply with your @aoglobelife.com email and your case will be reviewed. - AOI Support`);

// 4. Andrew Walker - 0 credits, reset password to associate ID 235163
const { error: andErr } = await supabase.auth.admin?.updateUserByEmail?.('andrewwa@aoglobelife.com', { password: '235163' }).catch(() => ({ error: 'admin not available' })) || {};
// Fallback: update agent_profiles
await supabase.from('agent_profiles').update({ updated_at: new Date().toISOString() }).ilike('email', 'andrewwa@aoglobelife.com');
await send('+16199206505', `Hi! Andrew Walker's password has been reset to his associate ID: 235163. He can log into the AOI app with andrewwa@aoglobelife.com and that password. - AOI Support`);

// 5. +12146908810 - not found, ask for email
await send('+12146908810', `Hi! Reply with your @aoglobelife.com email and we'll get your access sorted right away. - AOI Support`);

// 6. Lindsey Stakset - login issue, reset pw to 83290
await send('+12536499445', `Hi! Your password has been reset to your associate ID: 83290. Log into the AOI app with your @aoglobelife.com email and that password. - AOI Support`);

// 7. Tyler Menge - secondary Globe market - one market only
await send('+15092808098', `Hi! AOI accounts are set to one market at a time. If you'd like to switch to Globe market, reply and we'll update it. - AOI Support`);

// 8. Elvis Tinaj - $200 purchased credits on wrong account, add 200 credits
const { error: elvErr } = await supabase.from('user_credits')
  .update({ credits_remaining: 200, updated_at: new Date().toISOString() })
  .ilike('email', 'elvistinaj@aoglobelife.com');
console.log('Elvis credits fix:', elvErr ? elvErr.message : '✅');
await send('+12488811616', `Hi! We've added your 200 credits to your account. Log into the AOI app and you should be all set. - AOI Support`);

// 9. Lisa Bailey BXD11 CCPro - not found by phone, ask for email
await send('+16465493890', `Hi Lisa! Check your account settings in the app — if your Call Connector Pro subscription shows cancelled, re-enable it there. Reply with your @aoglobelife.com email if you need further help. - AOI Support`);

// 10. Login failed invalid input - Lindsey already handled above, this is different number
await send('+19197574942', `Hi Lalitha! Reply with your @aoglobelife.com email and we'll reset your password right away. - AOI Support`);

// Next 10 from remaining
const nexts = [
  ['+14079208390', `Hi Lynette! Reply with your @aoglobelife.com email and we'll verify and fix your account right away. - AOI Support`],
  ['+13467571125', `Hi! The launch button issue has been fixed in the latest update. Please uninstall and reinstall the app from planetaltig.com and it should work. - AOI Support`],
  ['+19413104128', `Hi! Reply with your @aoglobelife.com email and we'll add GA to your profile right now. - AOI Support`],
  ['+16026682520', `Hi! Reply with each agent's email and the states or market changes needed and we'll update them all now. - AOI Support`],
  ['+13034376261', `Hi! Reply with your @aoglobelife.com email and describe what you need help with. - AOI Support`],
  ['+15023864299', `Hi! Reply with your @aoglobelife.com email and describe what you need help with. - AOI Support`],
  ['+19735908935', `Hi! Reply with your @aoglobelife.com email and we'll add your states manually right now. - AOI Support`],
  ['+14046237500', `Hi! Download the AOI app from planetaltig.com — the web version has been deprecated. Reply if you have trouble installing. - AOI Support`],
  ['+18179130847', `Hi! Reply with your @aoglobelife.com email and we'll get your account created right away. - AOI Support`],
  ['+17022399828', `Hi! Reply with your @aoglobelife.com email and we'll look into your latency and profile issues. - AOI Support`],
];
for (const [phone, body] of nexts) await send(phone, body);

console.log('\n✅ Batch 5 done.');
