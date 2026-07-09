import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { readFileSync } from 'fs';

const supabase = createClient('https://ycztjetxwpfgtrzeyytt.supabase.co', 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd');
const sms = twilio('AC25d37aa41aed0df4fddd81ecf7abf00d', 'b275d646252457344ff62528e3538ea9');
const FROM = '+19142289324';

async function send(phone, body) {
  try {
    const msg = await sms.messages.create({ body, from: FROM, to: phone });
    console.log(`✅ ${phone}`);
  } catch(e) { console.error(`❌ ${phone}: ${e.message}`); }
  await new Promise(r => setTimeout(r, 300));
}

// 1. Ashley Warren +19726543396 - already switched to Veteran previously, confirm
await send('+19726543396', `Hi Ashley! Your market is set to Veteran. Restart the app and you should be all set. - AOI Support`);

// 2. Craig Matthew +12533064870 - wants RI added (found as craigmatthew@aoglobelife.com)
const { data: craig } = await supabase.from('customers').select('states').ilike('company_email','craigmatthew@aoglobelife.com').maybeSingle();
const craigStates = [...new Set([...(Array.isArray(craig?.states) ? craig.states : []), 'RI'])];
await supabase.from('customers').update({ states: craigStates, updated_at: new Date().toISOString() }).ilike('company_email','craigmatthew@aoglobelife.com');
await send('+12533064870', `Hi! RI has been added to your AOI account. Restart the app to see it. - AOI Support`);

// 3. Craig Matthew also had the secret key question (+19407656594) - ask what they need
await send('+19407656594', `Hi! Reply and describe what you're trying to do and we'll help. - AOI Support`);

// 4. Marissa Martinez +18179130847 - replied with martinezmarissa@aoglobelife.com, create profile
const { data: marissa } = await supabase.from('customers').select('associate_id,company_email').ilike('company_email','martinezmarissa@aoglobelife.com').maybeSingle();
if (marissa) {
  // Check agent_profiles
  const { data: apExists } = await supabase.from('agent_profiles').select('email').ilike('email','martinezmarissa@aoglobelife.com').maybeSingle();
  if (!apExists) {
    await supabase.from('agent_profiles').insert({ email: 'martinezmarissa@aoglobelife.com', first_name: 'Marissa', last_name: 'Martinez', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
  const pw = String(marissa.associate_id);
  await send('+18179130847', `Hi Marissa! Your profile has been created. Log into the AOI app with martinezmarissa@aoglobelife.com — your temporary password is your associate ID: ${pw}. - AOI Support`);
} else {
  await send('+18179130847', `Hi! We couldn't find martinezmarissa@aoglobelife.com in our system. Please confirm your email and we'll get your profile created. - AOI Support`);
}

// 5. Dominick White +13134021570 - add WA
const { data: dom } = await supabase.from('customers').select('states').ilike('company_email','dominickwhite@aoglobelife.com').maybeSingle();
const domStates = [...new Set([...(Array.isArray(dom?.states) ? dom.states : []), 'WA'])];
await supabase.from('customers').update({ states: domStates, updated_at: new Date().toISOString() }).ilike('company_email','dominickwhite@aoglobelife.com');
await send('+13134021570', `Hi! WA has been added to your AOI account. Restart the app to see it. - AOI Support`);

// 6. Kayla Rodriguez +15126478441 - locked out, not found by phone
await send('+15126478441', `Hi Kayla! Reply with your @aoglobelife.com email and we'll reset your password right away. - AOI Support`);

// 7. Mohamed Abed - AOICONNECT INACTIVE, market null - activate + set market + create agent_profile
await supabase.from('customers').update({ AOICONNECT: 'ACTIVE', market: ['Globe Market'], updated_at: new Date().toISOString() }).ilike('company_email','mohammadabed@aoglobelife.com');
const { data: moExists } = await supabase.from('agent_profiles').select('email').ilike('email','mohammadabed@aoglobelife.com').maybeSingle();
if (!moExists) {
  await supabase.from('agent_profiles').insert({ email: 'mohammadabed@aoglobelife.com', first_name: 'Mohamed', last_name: 'Abed', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
}
await send('+17863080615', `Hi! Mohamed Abed's account has been activated and his profile is set up. He can now log into the AOI app with mohammadabed@aoglobelife.com — his temporary password is his associate ID: 225666. - AOI Support`);

// 8. Globe switch +17864584127 - not found by phone
await send('+17864584127', `Hi! Reply with your @aoglobelife.com email and we'll switch your market to Globe right now. - AOI Support`);

// 9. +17032019480 - number showing as spam
await send('+17032019480', `Hi! Your personal number does not show to prospects — the AOI Twilio number shows instead. If that number got flagged it affects all agents on it. We're aware and working on it. - AOI Support`);

// 10. +18184160617 - Mac audio won't connect
await send('+18184160617', `Hi! Mac audio issues with AOI are a known limitation — Parallels (Windows on Mac) is the fix for reliable audio. - AOI Support`);

// 11. +15126478441 already sent above

// 12. +18182240237 - CCPro in billing settings
await send('+18182240237', `Hi! Go to your billing settings in the app and re-enable your Call Connector Pro subscription from there. Reply if you still can't access it after that. - AOI Support`);

// 13. +18433682555 - still can't load
await send('+18433682555', `Hi! Reply with your @aoglobelife.com email and we'll check your account. - AOI Support`);

console.log('\n✅ Batch 7 done.');
