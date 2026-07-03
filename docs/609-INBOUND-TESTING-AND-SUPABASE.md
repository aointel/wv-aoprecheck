# 609 Inbound: How to Test & Supabase Tables

## Dev (baa2) vs production

On the **dev** branch, code defaults to **baa2** (`WEBHOOK_BASE_URL`). To run tests against the dev server:

```bash
npm run test:609-dev
```

This runs: `check-609-voice-url`, `verify-taskrouter-inbound-609`, and `test-webhook-creates-task` (POST to baa2 `/incomingcall`). The webhook test uses baa2 by default; the other two show where 609 and the workflow callback currently point.

**To point everything at dev (baa2)** so real 609 calls hit the dev server:

1. Point 609 Voice URL at baa2:  
   `npx tsx server/scripts/set-609-voice-to-baa2.ts`
2. Point TaskRouter workflow assignment callback at baa2:  
   `npx tsx server/scripts/provision-taskrouter.ts`  
   (Uses `WEBHOOK_BASE_URL` = baa2 by default on dev branch.)

**To point everything back at production:**

1. Point 609 at production:  
   `BASE_URL=https://aoirail-production.up.railway.app npx tsx server/scripts/set-609-voice-incomingcall.ts`
2. Point workflow callback at production:  
   `BASE_URL=https://aoirail-production.up.railway.app npx tsx server/scripts/provision-taskrouter.ts`

Once dev is working end-to-end, the same flow works on prod with production URLs.

---

## Run the full step-by-step test

One command runs every check (Twilio config, TaskRouter, server response, recent calls, and Supabase write):

```bash
npx tsx server/scripts/check-609-get-thru.ts
```

Against production (default):

```bash
# uses https://aoirail-production.up.railway.app
npx tsx server/scripts/check-609-get-thru.ts
```

What it checks:

1. **Twilio** – 609 number’s Voice URL is `https://aoirail-production.up.railway.app/incomingcall`
2. **TaskRouter** – Workflow assignment callback is `https://aoirail-production.up.railway.app/api/twilio/taskrouter/assignment`
3. **Server** – POST to `/incomingcall` returns 200 and Enqueue TwiML (with a fake CallSid)
4. **Recent calls** – Lists last 2h of calls to 609 (count by status)
5. **Supabase** – After the POST in step 3, the script looks up that fake CallSid in `twilio_call_logs`; if Supabase is configured and the server wrote the row, you see “Supabase twilio_call_logs: test call logged”

Exit code: `0` = all good, `1` = one or more checks failed.

---

## Other useful checks

- **Where does Twilio send?**  
  `npx tsx server/scripts/check-twilio-609-points-to.ts`  
  Prints 609 Voice URL, Status Callback, and TaskRouter assignment URL from the Twilio API.

- **Voice URL only**  
  `npx tsx server/scripts/check-609-voice-url.ts`

---

## Supabase: what we write for incoming 609 calls

Yes – we do write to Supabase for these calls. Tables and when they’re used:

| Table | When | What |
|-------|------|------|
| **twilio_call_logs** | As soon as `/incomingcall` is hit (fire-and-forget after sending TwiML) | One row per call: `twilio_call_sid`, `from_number`, `to_number`, `call_direction: 'inbound'`, `call_status: 'queued'`, `call_source: 'incomingcall_609'`, `call_started_at`. Later the **call-status** webhook updates the same row (duration, status, etc.). |
| **taskrouter_pending** | When TaskRouter creates a reservation and calls our assignment callback | One row per reservation: `reservation_sid`, `task_sid`, `worker_sid`, `worker_attributes`, `task_attributes`, `created_at`. Deleted when the reservation is accepted/rejected or the task ends. |
| **inbound_success_events** | When an agent answers and the call is connected | Used for success analytics / “Recent Connects” and billing. |
| **billing_transactions** | When an inbound call is billed (e.g. duration rules) | Billing records. |

We **read** from:

- **masterlead** – On `/incomingcall` we look up the caller by phone to set market/state and optional preview (name, etc.) for the task. We do not create or update `masterlead` just for the inbound call; that’s for lead data that already exists.

So for “are we supposed to be adding something to the Supabase data table for these incoming calls?” – **yes**: `twilio_call_logs` (and, when TaskRouter reserves an agent, `taskrouter_pending`). The test script’s step 5 verifies that the server wrote the test call to `twilio_call_logs`.
