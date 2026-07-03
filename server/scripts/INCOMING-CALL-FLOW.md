# What Happens When an Incoming Call Hits 609

## How the real call gets routed (end-to-end)

| Step | What happens | Where (code) |
|------|----------------|---------------|
| **1** | Call hits 609 → Twilio POSTs to your **Voice URL** | Twilio sends `POST /incomingcall` (609 number’s Voice URL must be set to this). |
| **2** | Server reads `From` (caller phone), looks up **market + state** | `routes.ts` **handleIncomingCall**: `masterlead` lookup by phone (`ilike('phone', '%' + callerLast10 + '%')`). Reads `taalk_market` → `leadMarket`, `state`/`taalk_state` → `leadState`. Defaults: `Unknown`, `XX`. |
| **3** | Task attributes built with **canonical** market/state | `taskrouter-service.ts` **buildTaskAttributesFor609Inbound**: `normalizeMarket(leadMarket)` (e.g. "Globe" → "Globe Market"), `normalizeState(leadState)` (2-letter upper or "XX"). Output JSON includes `market`, `state`, `call_sid`, `routing_target: 'inbound609'`. |
| **4** | Server responds with **Enqueue TwiML** | `taskrouter-service.ts` **buildEnqueueTwiML**: returns `<Enqueue workflowSid="WW..."><Task>{...attributes...}</Task></Enqueue>`. That JSON is the task attributes Twilio stores. |
| **5** | Twilio creates a **voice** task and runs the **workflow** | Twilio creates a task with channel **voice** and the same attributes (market, state, etc.). Workflow filter `1==1` sends task to queue **AOI Inbound Voice**. |
| **6** | TaskRouter picks **which workers ring** (market + state) | **Workflow target expression** (not TaskQueue targetWorkers): `(task.market IN worker.markets) AND (task.state == "XX" OR task.state IN worker.licensed_states)`. Only workers whose **worker** attributes match this get a reservation. |
| **7** | Twilio creates a **reservation** and POSTs to **assignment callback** | `POST /api/twilio/taskrouter/assignment` with `TaskAttributes`, `WorkerAttributes`, `ReservationSid`, `TaskSid`, `WorkerSid`. Server stores in `pendingReservations` and `taskrouter_pending`, returns `{ "pending": true }`. |
| **8** | UI shows **Ringing** for the worker who got the reservation | Frontend polls/reads pending by worker; panel shows lead info from task attributes. |
| **9** | Agent clicks **Answer** → call connects | `POST /api/twilio/taskrouter/accept` with `taskSid`, `reservationSid`. Server calls **acceptReservationWithDequeue** with worker’s `contact_uri` (e.g. `client:email@...`). Twilio **dequeues** the 609 call and bridges it to that client (WebRTC). |

So: **market and state** come from **masterlead** (caller phone → lead row). They are normalized and put into the **task** attributes. **TaskRouter** then assigns only to **workers** whose `markets` and `licensed_states` match that task (workflow target expression). The **real call** is routed by that same task; when a worker accepts, the call is bridged to their client via dequeue.

### How market and state are passed to find a worker

| Source | Used for | Where it comes from | Normalization |
|--------|----------|---------------------|---------------|
| **Task** `market`, `state` | Incoming call → which workers can get the task | **masterlead** (lookup by caller `From` phone). Columns: `taalk_market`, `state` / `taalk_state`. | `taskrouter-service`: `normalizeMarket()` (e.g. "Globe" → "Globe Market"), `normalizeState()` (2-letter or full name → "WA", "TX", or "XX"). |
| **Worker** `markets`, `licensed_states` | Which tasks this worker can get | **customers** (lookup by agent when they go voice-online). Columns: `market`, `states` (or `taalk_market`, `taalk_state`). | Same: `parseMarketFromCustomer()` / `parseStatesFromCustomer()` use `normalizeMarket` and `normalizeState`. |

TaskRouter filter: `(task.market IN worker.markets) AND (task.state == "XX" OR task.state IN worker.licensed_states)`. So the **same canonical strings** must be used for task and worker; both paths use the same normalizers in `taskrouter-service.ts`.

---

## 1. Call arrives → Twilio hits your server

- **URL:** `POST https://<your-app>/incomingcall` (Voice webhook for the 609 number)
- **Server:** Looks up caller in `masterlead` by phone → gets `taalk_market`, `state` (or Unknown / XX)
- **Normalize:** `normalizeMarket("Globe")` → `"Globe Market"`; state 2-letter uppercase or `"XX"`
- **Response:** TwiML with `<Enqueue workflowSid="WW..."><Task>{"market":"...","state":"...",...}</Task></Enqueue>`

**If this fails:** You get no Enqueue (error TwiML). Check server logs for `609 /incomingcall` or `LIVE_CALL_INCOMINGCALL`.

---

## 2. TaskRouter creates a task and runs the workflow

- Twilio creates a **voice** task with the JSON attributes (market, state, call_sid, etc.)
- **TaskQueue** has `targetWorkers: "1==1"` (all workers eligible for the queue; filtering is in the workflow).
- **Workflow target expression** (this is what enforces market/state):  
  `(task.market IN worker.markets) AND (task.state == "XX" OR task.state IN worker.licensed_states)`
- Only workers who have that **market** and (if state ≠ XX) that **state** get a reservation.

**If no worker matches:** Task sits in queue, **0 reservations**, **no one rings**, assignment callback is **never** called.

**If workers match but none are online:** Same — 0 reservations. They must be **AvailableInbound** and have **available voice capacity**.

---

## 3. When a worker matches and is online

- TaskRouter creates a **reservation** for that worker and **POSTs to the assignment callback**
- **Callback URL:** `https://<your-app>/api/twilio/taskrouter/assignment`
- Server returns `{ "pending": true }` so Twilio **holds** the reservation (manual accept)
- Server stores the reservation in memory and in `taskrouter_pending` (if DB configured)

**If callback is wrong or unreachable:** Twilio may not create the reservation or may timeout. Check workflow’s `assignmentCallbackUrl` and that the server is reachable from the internet.

---

## 4. UI shows the ring

- Frontend polls or reads **pending** reservations for the **logged-in agent** (by `contact_uri` / email)
- If a reservation exists for this agent’s worker, the **inbound panel** shows **Ringing** with lead info

**If panel never rings:** Either 0 reservations (step 2) or UI not getting pending (wrong agent filter / API / polling).

---

## 5. Agent clicks Answer

- Frontend calls `POST /api/twilio/taskrouter/accept` with `taskSid` and `reservationSid`
- Server tells Twilio to **accept** the reservation and returns **dequeue** TwiML so the queued call is connected to the worker’s client (WebRTC)

**If call doesn’t connect after Answer:** Check accept API and dequeue response; check Twilio call logs for the 609 call.

---

## Quick checks when “incoming call does nothing”

1. **Server log for the call**  
   Grep for `609 /incomingcall` or `609 INCOMING` — you should see `market=... state=...` and the line:  
   `Only workers whose markets include "X" AND ... will ring. If none are online ... NO ONE RINGS`.

2. **Task created?**  
   Run:  
   `npx tsx server/scripts/diagnose-last-inbound-609.ts`  
   It finds the last call to 609 and looks for a task with that `call_sid`. If no task, Enqueue wasn’t used or failed.

3. **Reservations for that task?**  
   If a task exists but 0 reservations → **no worker matched or worker voice capacity = 0**.  
   - Run: `npx tsx server/scripts/check-task-reservations.ts <TaskSID>` (TaskSID from diagnose-last-inbound-609).  
   - Run: `npx tsx server/scripts/list-workers-voice-capacity.ts` — **fixes** workers who are AvailableInbound but have 0 voice capacity (sets to 1).  
   - Check TaskQueue/workflow (market/state). Ensure at least one worker has that market + state and is **AvailableInbound** with **voice capacity ≥ 1**.

4. **Assignment callback hit?**  
   Check server logs for:  
   `TaskRouter assignment: RESERVATION RECEIVED`  
   If you never see this for that task, TaskRouter didn’t offer the task to any worker (filter or capacity).

5. **Test routing for Globe Market + WA**  
   Run:  
   `npx tsx server/scripts/test-routing-wa-globe-market.ts`  
   It creates a Globe Market + WA task and reports who would match and whether any reservations were created.
