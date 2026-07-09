import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const client = twilio('AC25d37aa41aed0df4fddd81ecf7abf00d', 'b275d646252457344ff62528e3538ea9');
const FROM = '+19142289324';

const SUPA_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPA_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const supabase = createClient(SUPA_URL, SUPA_KEY);

// Load clean tickets to get ticket_ids
const fs = await import('fs');
const tickets = JSON.parse(fs.readFileSync('C:/dev/support_tickets_clean.json'));

// Find ticket_id by phone (most recent unanswered ticket for that phone)
function findTicketId(phone, tickets) {
  const matches = tickets.filter(t => t.phone === phone && !t.has_reply);
  if (!matches.length) return null;
  return matches.sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at))[0].ticket_id;
}

const responses = [
  {
    phone: '+18435995593',
    body: "Hi! If the submit button is cut off, try pressing Ctrl and the minus key (Ctrl -) a few times to zoom out — this usually fixes it right away. Let us know if that works! - AOI Support"
  },
  {
    phone: '+14195094965',
    body: "Hi Ryan! Can you share what the error message says? A screenshot would help. In the meantime: 1) Hard refresh Ctrl+Shift+R in Chrome 2) Close and reopen the app fully 3) If still stuck, uninstall and reinstall. Reply with what you see! - AOI Support"
  },
  {
    phone: '+18179130847',
    body: "Hi! Your account needs to be set up on our end first. Can you reply with your @aoglobelife.com email address and we'll get your profile created right away. - AOI Support"
  },
  {
    phone: '+13133986164',
    body: "Hi! Sorry you've been dealing with this. Please try: 1) Hard refresh Ctrl+Shift+R 2) Close and fully reopen the app 3) If the VDP error persists, uninstall and reinstall from planetaltig.com. Reply if still stuck! - AOI Support"
  },
  {
    phone: '+18053145854',
    body: "Hi! Mic issues are almost always a local Mac permissions issue. If you're on a Mac, the most reliable fix is using Parallels (Windows environment) — the mic works great there. If on Windows, go to Settings > Privacy > Microphone and make sure AOI has access. Which are you on? - AOI Support"
  },
  {
    phone: '+13049285658',
    body: "Hi Paul! We'll create your profile for paulvanaelst@aoglobelife.com right now — give it a few minutes then try logging in again. Reply if you still get the error. - AOI Support"
  },
  {
    phone: '+17022399828',
    body: "Hi! The missing profile info (phone/photo) is a display issue that doesn't block calls. For latency, try a wired connection and close other browser tabs. Can you check your speed at fast.com and reply with the result? That'll help us narrow it down. - AOI Support"
  },
  {
    phone: '+18184160617',
    body: "Hi! If the app keeps looping to the download screen on Mac, it's Mac security blocking it. Go to System Settings > Privacy & Security and look for AOI being blocked — click 'Open Anyway'. If you don't see that option, using Parallels (Windows on Mac) is the reliable fix. - AOI Support"
  },
  {
    phone: '+19495008109',
    body: "Hi! It looks like your message may not have come through fully — we didn't receive the error details. Can you reply with a screenshot or describe what the error says? Happy to help! - AOI Support"
  },
  {
    phone: '+13467571125',
    body: "Hi! If the launch button isn't clickable even with all green diagnostics, try fully closing and reopening the app. If that doesn't work, uninstall, restart your computer, and reinstall from planetaltig.com. Reply if still stuck! - AOI Support"
  },
  {
    phone: '+19413104128',
    body: "Hi! We can add GA to your profile — what's your @aoglobelife.com email address? - AOI Support"
  },
  {
    phone: '+13134021570',
    body: "Hi! New states from eApp don't sync to AOI automatically yet. Reply with your @aoglobelife.com email and we'll add Washington to your profile right now. - AOI Support"
  },
  {
    phone: '+17032019480',
    body: "Hi! Want to make sure we get you sorted — can you describe what you're seeing or send a screenshot? - AOI Support"
  },
  {
    phone: '+14073197392',
    body: "Hi! Use the desktop app — the browser version has been deprecated. The 5 startup notices are normal and you can click through them, they don't block anything. Download the app at planetaltig.com if needed. - AOI Support"
  },
];

let sent = 0, failed = 0;

for (const r of responses) {
  try {
    const msg = await client.messages.create({ body: r.body, from: FROM, to: r.phone });

    // Log to support_messages in Supabase
    const ticketId = findTicketId(r.phone, tickets);
    if (ticketId) {
      await supabase.from('support_messages').insert({
        ticket_id: ticketId,
        phone: r.phone,
        twilio_sid: msg.sid,
        direction: 'outbound',
        body: r.body,
        has_media: false,
        sent_at: new Date().toISOString(),
      });
    }

    console.log(`✅ Sent to ${r.phone} | SID: ${msg.sid}`);
    sent++;

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (e) {
    console.error(`❌ Failed to ${r.phone}: ${e.message}`);
    failed++;
  }
}

console.log(`\nDone. ${sent} sent, ${failed} failed.`);
