# Why Test API Recordings Work But WebRTC/CCPRO Didn’t

Recording is requested in **different places** depending on **who creates the call**. Test uses one path; WebRTC Direct Call used another, and recording was only set on the first.

---

## 1. Test API / server-created calls (these work)

**Flow:** Your server calls Twilio REST API to create the call.

```
Your server  →  twilioClient.calls.create({
                   to: lead,
                   url: twimlUrl,
                   record: true,                    ← HERE
                   recordingStatusCallback: url,   ← HERE
                 })
```

- **One** call leg is created (the outbound to the lead).
- Recording is turned on **when the call is created** (REST params).
- Twilio records that leg and POSTs to `recording-status` with that call’s SID.
- We have a row for that SID (we log it when we create the call or in call-status) → we set `recording_url`. **Works.**

Same idea for **twilio-dial.ts (conference path)**: the server does `calls.create()` with `record: true` and `recordingStatusCallback`, so the lead leg is created with recording from the start. That path works.

---

## 2. WebRTC Direct Call (the one that didn’t work)

**Flow:** The **agent’s browser** (WebRTC device) calls Twilio. Twilio answers using the TwiML App Voice URL → your server returns TwiML. **Twilio** then creates the outbound leg when it runs that TwiML.

```
Browser (client:agent@...)  →  Twilio  →  GET/POST Voice URL  →  Your server returns TwiML
                                                                  <Dial>
                                                                    <Number>lead</Number>
                                                                  </Dial>
Twilio executes <Dial>  →  creates outbound leg to lead  →  no record= in Dial  →  no recording
```

- The **call** Twilio has at the start is the **inbound** leg (agent’s client).
- The **outbound** leg to the lead is created by Twilio when it runs **your TwiML** `<Dial><Number>…</Number></Dial>`.
- You never call `calls.create()` for that leg. So **REST `record` and `recordingStatusCallback` don’t apply** to it.
- Recording for that leg can **only** be requested **in the TwiML** on the `<Dial>`: `record="record-from-answer"` and `recordingStatusCallback="..."`.

Previously, that Direct Call TwiML had **no** `record` and **no** `recordingStatusCallback`. So Twilio never recorded. We’ve now added both to the Direct Call `<Dial>` in `handleWebRTC` (routes.ts).

---

## Summary

| Who creates the call?        | Where recording is set              | Worked before? |
|-----------------------------|--------------------------------------|----------------|
| **Server** (calls.create)   | REST: `record: true`, `recordingStatusCallback` | Yes (test, twilio-dial conference path) |
| **Twilio** (running our TwiML) | TwiML: `<Dial record="..." recordingStatusCallback="...">` | No – was missing; now added for Direct Call |

So: **test recordings work** because the only leg is created by the server with recording in the REST call. **WebRTC Direct Call didn’t** because the lead leg is created by Twilio from TwiML and we didn’t ask for recording in that TwiML. It’s the same “basic” feature; it just has to be enabled in the right place for each path.

---

## Code references

- **Test recording:** `routes.ts` – `POST /api/twilio/test-recording-call` (uses `calls.create` with `record` + `recordingStatusCallback`).
- **CCPRO server path:** `twilio-dial.ts` – `calls.create` with `record: true` and `recordingStatusCallback` (conference-connect flow).
- **CCPRO WebRTC Direct Call:** `routes.ts` – `handleWebRTC` when `directCallNumber` is set: `<Dial>` now has `record="record-from-answer"` and `recordingStatusCallback` (fixed).
