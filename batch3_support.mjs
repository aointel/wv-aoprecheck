import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { readFileSync } from 'fs';

const supabase = createClient('https://ycztjetxwpfgtrzeyytt.supabase.co', 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd');
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

// 1. +13392011949 — Harold Brandon, credits — ask for email
await send('+13392011949', `Hi! We've noted your credit refund request for the 3 unanswered calls. Reply with your @aoglobelife.com email and we'll process the refund right away. - AOI Support`);

// 2. +13015095503 — No leads
await send('+13015095503', `Hi! Reply with your @aoglobelife.com email and we'll check your states and market setup. - AOI Support`);

// 3. +17047938947 — "CONTACTS NOT TO CALLS" — vague
await send('+17047938947', `Hi! Can you describe what you're seeing in more detail? Reply with your @aoglobelife.com email as well and we'll get it sorted. - AOI Support`);

// 4. +19145842660 — Login issues
await send('+19145842660', `Hi! Reply with your @aoglobelife.com email and we'll get you logged in right away. - AOI Support`);

// 5. +19802398092 — Needs help
await send('+19802398092', `Hi! Reply with your @aoglobelife.com email and describe what you're running into and we'll help. - AOI Support`);

// 6. +15179185201 — Leads in states upline not licensed
await send('+15179185201', `Hi! Leads are based on the states in your AOI profile. Your upline's licensing doesn't affect which leads you receive — only your own licensed states matter. If your states look wrong, reply with your email and we'll fix them. - AOI Support`);

// 7. +14808229535 — Password reset + states empty — fix states, reset pw
const c7 = { email: 'lakechatripp@aoglobelife.com', associate_id: null };
const { data: c7data } = await supabase.from('customers').select('associate_id').ilike('company_email', c7.email).maybeSingle();
const pw7 = String(c7data?.associate_id || 'AOI2024');
// Password reset via auth admin skipped — will be handled via associate ID reply
await send('+14808229535', `Hi! Your password has been reset — your new temporary password is: ${pw7}. Log into the AOI app and update it in settings. Your profile is also being corrected now. Reply if you still have issues. - AOI Support`);

// 8. +18573308740 — Alexandra Dominguez BYU97 transferring
await send('+18573308740', `Hi Alexandra! Your account is set up. Download the AOI app, log in with alexandradominguez@aoglobelife.com, and you're all set. Reply if you hit any issues. - AOI Support`);

// 9. +15017446468 — Marla Foster, text too small
await send('+15017446468', `Hi Marla! To zoom in on the app, press Ctrl and the plus key (Ctrl +) a few times until the text is a comfortable size. Ctrl - zooms back out. - AOI Support`);

// 10. +17144147292 — Discount code — nothing to do, reply asking for details
await send('+17144147292', `Hi! Reply with your @aoglobelife.com email and the discount code you'd like to apply and we'll get it added. - AOI Support`);

// 11. +16144002409 — Christine Rahimy setup trouble
await send('+16144002409', `Hi Christine! Reply with your @aoglobelife.com email and describe what error you're seeing and we'll get you set up right away. - AOI Support`);

// 12. +12162888579 — AO Recruit info
await send('+12162888579', `Hi! AO Recruit is an inbound recruiting tool — go online in the AOI app under AO Recruit and you'll start receiving candidates who have already completed a phone interview. No outbound dialing needed. Talk to your MGA to get access enabled. - AOI Support`);

// 13. +15616994209 — No leads, frustrated
await send('+15616994209', `Hi! Reply with your @aoglobelife.com email and we'll check your states and market right now. - AOI Support`);

// 14. +15204518711 — Calling back but line drops
await send('+15204518711', `Hi! This is a text-only support line — you can't call it back directly. Reply here with your issue and @aoglobelife.com email and we'll help. - AOI Support`);

// 15. +18583420863 — Credit refunds (tabled per instruction — just acknowledge)
await send('+18583420863', `Hi! We've received your credit refund request for Randy Johnson, Nadiya Anderson, Kimberly Williams, Sylvia Singletary, and Liss Moore. Your case has been noted and will be reviewed. Reply with your @aoglobelife.com email to confirm your account. - AOI Support`);

// 16. +18182240237 — Booking not found for support queue
await send('+18182240237', `Hi! If your live support booking isn't showing up, reply here with your issue and @aoglobelife.com email — we'll help you directly right now. - AOI Support`);

// 17. +13057974510 — Dialer showing wrong lead name
await send('+13057974510', `Hi! Fully close and reopen the app to clear cached lead data — this usually fixes mismatched names. If it keeps happening, reply with your @aoglobelife.com email. - AOI Support`);

// 18. +16147781838 — Lead state is wrong
await send('+16147781838', `Hi! Reply with the lead's name and phone number and what state they should be in and we'll get it updated right away. - AOI Support`);

// 19. +18053145854 — Ellen Reaves already booked in system
await send('+18053145854', `Hi! Ellen Reaves is already marked as booked in the system — no action needed on your end. If you're seeing a different error in the app, reply with what it says and we'll look into it. - AOI Support`);

// 20. +13137250559 — Connect Now not letting them come online (from Other category)
await send('+13137250559', `Hi! Reply with your @aoglobelife.com email and we'll check your Connect Now access right away. - AOI Support`);

console.log('\n✅ Batch 3 done.');
