# TaskRouter Inbound Setup (609 Number) — Step-by-Step Verification

All **inbound calls** come in on the **609 number**. The app uses **baa2** as the base URL for now:  
`https://aoirail-production-baa2.up.railway.app`. Use this everywhere until you switch to the live production URL.

---

## 1. Code / Config (baa2 URL)

- [ ] **`server/hardcoded-config.ts`**  
  `PRODUCTION_URL` fallback is `https://aoirail-production-baa2.up.railway.app`.

- [ ] **`server/routes.ts`**  
  `getWebhookBaseUrl()`, recording/status callbacks, and webrtc/assignment handlers use baa2 (or `req.get('host')` when present).

- [ ] **`server/index.ts`**  
  TwiML App `currentDomain` uses baa2 when host is localhost.

- [ ] **`server/twilio-webhook-setup.ts`**  
  `PROD_BASE` / inbound webhook base is baa2.

- [ ] **`server/scripts/provision-taskrouter.ts`**  
  Default `BASE_URL` fallback is baa2 so the workflow **assignment callback URL** is set to baa2 when you run provision without `BASE_URL`.

- [ ] **`server/twilio-call-service.ts`**  
  Recording and status callbacks use baa2 (or `REPLIT_DEV_DOMAIN` / `BASE_URL` / `PRODUCTION_URL`).

- [ ] No remaining `aoirail-production.up.railway.app` (non-baa2) in Twilio/webhook/TaskRouter-related code.

---

## 2. Twilio: 609 Number Voice URL

The **609 number’s Voice URL** in Twilio must point to the webrtc webhook on **baa2**:

- **URL:**  
  `https://aoirail-production-baa2.up.railway.app/webhook/webrtc`  
  (HTTP method: **POST** if your app expects POST)

- **How to set:**  
  - Twilio Console → Phone Numbers → Manage → Active Numbers → select 609 → Voice Configuration → set “A CALL COMES IN” to **Webhook**, URL above, POST.  
  - Or use your app’s admin endpoint that configures the inbound number (e.g. set-inbound-number-webhook) with the baa2 base.  
  - Or run `server/twilio-webhook-setup.ts` so it uses baa2 as the base for the 609 number.

- [ ] 609 Voice URL = `https://aoirail-production-baa2.up.railway.app/webhook/webrtc`

---

## 3. TaskRouter Provisioning (Assignment Callback on baa2)

The **workflow’s assignment callback** must be reachable by Twilio and must point at **baa2**:

- **Expected URL:**  
  `https://aoirail-production-baa2.up.railway.app/api/twilio/taskrouter/assignment`

- **How to set:**  
  Run provision **once** with baa2 as base (no `BASE_URL` needed if `PRODUCTION_URL` is already baa2):  
  `npx tsx server/scripts/provision-taskrouter.ts`  
  Or explicitly:  
  `BASE_URL=https://aoirail-production-baa2.up.railway.app npx tsx server/scripts/provision-taskrouter.ts`

- [ ] Provision script run with baa2 (or `PRODUCTION_URL` = baa2).  
- [ ] In Twilio Console → TaskRouter → Workflows → your inbound workflow → **Assignment Callback URL** =  
  `https://aoirail-production-baa2.up.railway.app/api/twilio/taskrouter/assignment`

---

## 4. Environment Variables (Server / Railway)

On the **baa2** deployment (e.g. Railway), ensure:

- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`  
- [ ] `TWILIO_TASKROUTER_WORKSPACE_SID`, `TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID`  
  (match the workspace/workflow from the provision script; they can also be in `hardcoded-config.ts`.)  
- [ ] `BASE_URL` or `PRODUCTION_URL` = `https://aoirail-production-baa2.up.railway.app` (optional if hardcoded fallback is already baa2).  
- [ ] Database and any other env vars required for the app to run.

---

## 5. Workers (Agents Online for Inbound)

TaskRouter only offers tasks to workers in **AvailableInbound** (or equivalent) in the correct workspace.

- [ ] At least one worker is **online** and in the **AvailableInbound** activity.  
- In the app: agents go “Online” (VDP or WebRTC); that triggers **voice-online** which sets the worker to AvailableInbound.  
- Verify: run  
  `npx tsx server/scripts/diagnose-inbound-routing.ts`  
  and confirm “Online workers (AvailableInbound)” > 0.

---

## 6. Flow Verification (609 → Enqueue → Assignment → Pending)

1. **609 → Webhook**  
   Call the 609 number. Twilio should POST to  
   `https://aoirail-production-baa2.up.railway.app/webhook/webrtc`.  
   Server logs should show “WEBRTC ENDPOINT HIT” and “INBOUND ROUTING” for the 609 number.

2. **Enqueue**  
   With TaskRouter configured, the handler returns **Enqueue** TwiML; a task is created in the workspace.  
   Optional: run  
   `npx tsx server/scripts/prove-609-goes-to-taskrouter.ts`  
   (if that script exists and is wired to baa2) to simulate/prove the enqueue step.

3. **Assignment callback**  
   Twilio POSTs to  
   `https://aoirail-production-baa2.up.railway.app/api/twilio/taskrouter/assignment`.  
   The app should store the reservation and return **Dequeue** TwiML.  
   Check server logs for assignment requests and any errors.

4. **Pending in app**  
   The inbound call should appear in the app (VDP/inbound panel).  
   You can also check:  
   `GET https://aoirail-production-baa2.up.railway.app/api/twilio/taskrouter/pending`  
   (with auth if required) to see pending TaskRouter reservations.

- [ ] Call to 609 hits webrtc on baa2 (logs).  
- [ ] Enqueue returned; task created (Twilio / logs).  
- [ ] Assignment callback reached; dequeue returned; reservation stored (logs).  
- [ ] Pending API or UI shows the inbound task.

---

## 7. Optional: One-Command Check

Run:

```bash
npx tsx server/scripts/verify-taskrouter-inbound-609.ts
```

This script checks: TaskRouter configured, workflow assignment callback URL (and warns if it doesn’t contain `baa2`), and online workers. Fix any reported issues, then re-run and do a live test call to 609.

---

## What can stop the call from being answered?

| Blocker | What happens | Fix |
|--------|----------------|-----|
| **No workers in AvailableInbound** | Twilio never calls the assignment callback (no one to offer the task to). Call ends as **busy** or **no-answer** with 0s duration. | Have at least one agent go **Online** (VDP or WebRTC) so `POST /api/agents/voice-online` runs and sets their TaskRouter activity to AvailableInbound. |
| **Assignment callback unreachable** | Twilio can’t POST to your server (wrong URL, server down, or firewall). Task is created but never assigned. | Ensure the workflow’s Assignment Callback URL is exactly your public app URL (e.g. baa2) and the server is running. Re-run `provision-taskrouter.ts` with the correct `BASE_URL`. |
| **Worker voice channel capacity = 0** | TaskRouter won’t assign voice tasks to workers with 0 voice capacity. | When an agent goes Online, the app calls `setWorkerVoiceCapacity(workerSid, 1)`. If that fails (e.g. no voice channel in workspace), check server logs for “setWorkerVoiceCapacity failed”. Ensure the workspace has a “voice” task channel (provision script uses template NONE; voice is usually present). |
| **Worker’s Twilio Client not registered** | After we return **dequeue**, Twilio “calls” the worker at `client:agent@email.com`. If the browser/app hasn’t registered the Device with that identity, the call never reaches the agent. | Agent must have the app open and **Online** with the same identity (email) used for the TaskRouter worker. Token must use `identity: agentEmail`. |
| **Auth failure on voice-online** | If `POST /api/agents/voice-online` returns 401 (no email), the worker is never set to AvailableInbound. | Resolve agent email from session, JWT, cookie, or body so voice-online succeeds. |

In practice, the most common cause of “call never gets answered” is **no workers in AvailableInbound** (no one Online when the call arrives).

---

## Summary Checklist

| Step | What to verify |
|------|----------------|
| 1 | Code uses baa2 URL everywhere for webhooks/callbacks. |
| 2 | 609 number Voice URL = `.../webhook/webrtc` on baa2. |
| 3 | Workflow assignment callback = `.../api/twilio/taskrouter/assignment` on baa2. |
| 4 | Env vars (Twilio + TaskRouter SIDs) set on baa2 deployment. |
| 5 | At least one worker online (AvailableInbound). |
| 6 | Test call to 609 → webrtc → Enqueue → assignment → pending in app. |

When you go live, replace **baa2** with your production domain and re-run steps 2 and 3 (Voice URL and re-provision workflow) and update config/fallbacks accordingly.
