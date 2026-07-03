# Dial-in setup: call a number → /connect rings and caller data shows

When someone (or you) **calls a Twilio number**, the call can ring on /connect and the **caller’s** lead data can show in the inbound modal. Here’s how to make that work.

## 1. Point the INBOUND number (6096048379) at the app

**Only the number 6096048379** is used for inbound (ring /connect). That number’s Voice URL must point to this app so the terminal rings.

- **Production webhook:** `https://aoirail-production.up.railway.app/webhook/webrtc`
- **Dev webhook:** `https://aoirail-production-baa2.up.railway.app/webhook/webrtc`

**Option A – Set inbound number to PRODUCTION (recommended for live calls):**

All inbounds should point to production so calls use ring-by-market/state on the live server.

```bash
# Point 6096048379 (and any other inbounds) to PRODUCTION. Use a sysop email.
curl -X POST "https://aoirail-production.up.railway.app/api/admin/set-inbound-number-webhook-to-production?email=YOUR_SYSOP_EMAIL"
```

Or use the single-number endpoint (also points to production):

```bash
curl -X POST "https://aoirail-production.up.railway.app/api/admin/set-inbound-number-webhook?email=YOUR_SYSOP_EMAIL"
```

Both set the Voice URL to `https://aoirail-production.up.railway.app/webhook/webrtc` and Status Callback to the same host. If the number isn’t in your Twilio account, the response will say so and list your numbers.

**Option B – Dev only: point first number to dev**

```bash
curl -X POST "https://aoirail-production-baa2.up.railway.app/api/admin/set-one-number-to-dev?email=YOUR_SYSOP_EMAIL"
```

**Option C – Twilio Console**

1. Twilio Console → Phone Numbers → Manage → Active Numbers.
2. Open the number **6096048379** (or +16096048379).
3. Under **Voice & Fax**, set **A CALL COMES IN** to Webhook, `https://aoirail-production.up.railway.app/webhook/webrtc`, HTTP POST (production). For dev testing use `https://aoirail-production-baa2.up.railway.app/webhook/webrtc`.
4. Save.

## 2. Put the caller’s number in masterlead

The **caller’s** phone (the `From` number when they call) is looked up in **masterlead** to:

- Decide which agent to ring (`cn_email`).
- Show lead info in the inbound modal (same as `lead-by-phone`).

So for **your** phone (e.g. 5032018470) to both ring your /connect and show your data:

1. Add (or update) a row in **masterlead** with:
   - **phone** = your number in any normal format, e.g. `5032018470`, `+15032018470`, etc. (match is on last 10 digits.)
   - **cn_email** = the agent to ring when this number calls (usually **your** login email so your /connect rings).
   - Other fields (first_name, last_name, city, state, taalk_market, etc.) are what the modal will show.

2. If there’s already a lead with that phone but wrong `cn_email`, update `cn_email` to your email so the call routes to you.

Example (conceptually):

- You call from **5032018470**.
- There is a Twilio number (e.g. +19142289324) whose Voice URL is `.../webhook/webrtc`.
- In masterlead there is a row with phone containing `5032018470` and `cn_email = you@aoglobelife.com`.
- When you call that Twilio number from 5032018470:
  - The app looks up 5032018470 in masterlead, finds your email, returns TwiML to Dial your Client.
  - Your /connect rings.
  - The device gets `From` = your number; the app calls `lead-by-phone` with that number and shows the same masterlead row in the modal.

## 3. Be on /connect and have WebRTC on

- Log in and open **/connect**.
- Power on the dialer (WebRTC device registered).
- When you (or a lead) call the Twilio number from a phone that’s in masterlead with your `cn_email`, your client will ring and the inbound modal will show that lead.

## Summary

| Goal | What to do |
|------|------------|
| Call **from** 5032018470 and have **your** /connect ring and show **your** data | 1) Set a Twilio number’s Voice URL to `.../webhook/webrtc`. 2) In masterlead, add/update a row with phone = 5032018470 (or +15032018470) and cn_email = your email. 3) Call that Twilio number from 5032018470. |
| Same for any other caller | Put their phone in masterlead with cn_email = the agent who should get the call; when they call the Twilio number, that agent’s /connect rings and the modal shows that lead. |

The app matches callers by **last 10 digits** of the phone number (same as `lead-by-phone`), so formats like +15032018470 and 5032018470 both match.
