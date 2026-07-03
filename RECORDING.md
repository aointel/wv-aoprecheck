# Call recording – ensure ALL calls are recorded

This checklist helps ensure **every** call is recorded and **no** recording blocking is in effect (server or Twilio).

---

## Server (this codebase)

- **Twilio client**  
  Initialized with **Auth Token** (not an API Key). Restricted API keys can block `record: true`; Auth Token has full permissions.  
  See `server/routes.ts` (~542) and `server/hardcoded-config.js` (use `TWILIO_AUTH_TOKEN`).

- **609 inbound (TaskRouter)**  
  Recording is started in code when the agent answers (WebRTC `client:` legs don’t support `DequeueRecord` in TwiML).  
  - `server/routes.ts`: dequeue-status handler calls `recordings.create()` on the **inbound** call leg (`taskCallSid`) when status is answered/in-progress.  
  - Callback: `POST /api/twilio/recording-status` → updates `twilio_call_logs.recording_url`.

- **Outbound / conferences**  
  Recording is enabled in both places when possible:
  - **REST**: `calls.create({ record: true, recordingStatusCallback, recordingStatusCallbackMethod: 'POST' })` where we create calls.
  - **TwiML**: `<Dial record="record-from-answer" ...>` or `<Conference record="record-from-start" recordingStatusCallback="..." recordingStatusCallbackMethod="POST">` so the leg or conference is recorded even if REST was missed.

- **Paths that now have recording**  
  - Direct Dial (WebRTC to number): `record` + `recordingStatusCallback` on `<Dial>`.  
  - Conference (verification, etc.): `record="record-from-start"` on `<Conference>`.  
  - Lead dial (dial-lead, lead-join): `record: true` on `calls.create` + `record` on Dial and Conference.  
  - Call Connector Pro: `record: true` on `calls.create`; agent conference has `record="record-from-start"`; lead joins via lead-join (recorded).  
  - Agent-join-inbound (“I can take a call”): `record: true` + `recordingStatusCallback` on `calls.create`.  
  - Agent-join-inbound-conference TwiML: `record="record-from-start"` + `recordingStatusCallback` on `<Conference>`.  
  - Fallback dial (agent unavailable): `record` + `recordingStatusCallback` on `<Dial>`.  
  - Call coaching: `record: true` on `calls.create`; Conference TwiML has `record="record-from-start"` + `recordingStatusCallback`.  
  - Verification / twilio-call-service / enhanced-twilio-attribution: `record: true` + `recordingStatusCallback` on `calls.create`.  
  - Test AMD Dial, test-inbound `calls.create`, twilio-dial (agent conference + simple dial.number), webrtc-phone-service, twilio-conference-service, routes-twilio section: all have `record` and/or `recordingStatusCallback`.

---

## Twilio Console (no recording blocking)

1. **Phone number – 609 inbound**  
   - Voice URL points to your app (e.g. `https://.../incomingcall`).  
   - Do **not** set “Do not record” or any option that disables recording (if your UI has it).

2. **Account / Subaccount**  
   - No account-level “disable recording” or “do not record” option enabled.  
   - If you use **Subaccounts**, check the same for the subaccount that owns the numbers.

3. **API Keys (if any)**  
   - Server must use **Auth Token** for creating/recording calls.  
   - If you ever use an API Key for Twilio, ensure its permissions include **Recording** (create/read); otherwise prefer Auth Token so recording is never blocked by key restrictions.

4. **Compliance / Recording rules**  
   - If you use Twilio’s “Recording Rules” or compliance features, ensure they don’t block or pause recording for these flows.

---

## Quick verification

- **Script (Twilio API)**: `npx tsx server/scripts/twilio-verify-recording-everything.ts` — checks 609 Voice URL and recent inbound calls’ recording count.  
- **609 inbound**: After an agent accepts, check Twilio Monitor → Call → Recordings; and `twilio_call_logs.recording_url` for that call.  
- **Outbound**: Check a recent outbound call in Monitor → Recordings; and `recording_url` in `twilio_call_logs`.  
- **Recording status webhook**: `POST /api/twilio/recording-status` must be reachable by Twilio (public URL) and must update `twilio_call_logs`; check logs for “Recording status webhook” and “Successfully updated recording URL”.

---

## One-sentence summary

Use **Auth Token** everywhere for Twilio, enable **record + recordingStatusCallback** on every call path (REST and/or TwiML), and ensure **no “do not record” or recording restrictions** on the 609 number or account in Twilio Console.
