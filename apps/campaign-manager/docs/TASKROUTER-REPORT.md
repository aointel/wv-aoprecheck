# TaskRouter – How It Works in This Codebase

## Why calls weren’t getting assigned (and the fix)

**Cause:** Tasks are only created when something tells TaskRouter about the call. There was **no Twilio voice webhook** in this app. So when a call hit your Twilio number, Twilio never created a task → no assignment.

**Fix (in this codebase):**
- **Inbound voice webhook added:** `GET/POST /api/voice/incoming`  
  Returns TwiML that **Enqueues** the call into TaskRouter (using your workflow). Twilio then creates the task and assigns it to an available worker.

**What you must do:**
1. **Point your Twilio number at this URL**  
   In Twilio Console: Phone Numbers → your number → "A call comes in" → set to **Webhook**, URL:  
   `https://YOUR_DEPLOYED_APP_URL/api/voice/incoming`  
   Method: **GET** or **POST** (both work).

2. **Set workflow (if not already):**  
   Env `TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID` or `TWILIO_TASKROUTER_WORKFLOW_SID` to your workflow SID (e.g. `WW7c3e36b25267cd0489d855dd0b195f3e`). If unset, the app uses the first workflow in the workspace.

3. **Workflow assignment callback (Twilio Console):**  
   Your TaskRouter workflow must have an **Assignment Callback URL** so Twilio can connect the call to the worker when a reservation is created. If your setup uses Twilio’s default “Dequeue” behavior, that may already be configured.

If calls still don’t assign: use **GET /api/routing/diagnostic** to see pending tasks, queues, and workers (and who is available). Ensure workers are in the task queues your workflow uses.

---

## 1. What It Is

**Twilio TaskRouter** is used for **call routing** and **agent visibility**. One workspace is used for both:

- **Workspace:** `WS6a978202496f59f6cd478c1310f5c2eb` — **AOI Inbound Transfers**
- **Config:** `server/config.ts` — `TWILIO_TASKROUTER_WORKSPACE_SID` (env or hardcoded). Terminal and scripts use `TASKROUTER_WORKSPACE_SID_TERMINAL` (same SID, no env override).

Credentials: `getTwilioAccountSid()`, `getTwilioAuthToken()`. Terminal uses `getTwilioCredentialsForTerminal()` so the UI always matches the check script.

---

## 2. Core Concepts

| Concept | Meaning here |
|--------|----------------|
| **Workspace** | One Twilio TaskRouter workspace (AOI Inbound Transfers). All workers, activities, tasks, queues live here. |
| **Worker** | An agent. Identified by `workerSid`, `friendlyName` (e.g. email). Has a **current activity** and optional **attributes** (market, states, etc.). |
| **Activity** | Worker state: Offline, AvailableInbound, BusyOnCall, Wrap, Unavailable, etc. Each has Twilio’s **available** (boolean). Worker is “online” only when in an activity with **available === true** and name not “busy”. |
| **Task** | A unit of work (e.g. an inbound call). Created via API; TaskRouter assigns it to an available worker. Can be **pending**, **reserved** (offered/ringing), **assigned**, **completed**, **canceled**. |
| **Reservation** | Links a task to a worker. **Pending** reservation = call is ringing at that worker. |
| **Task queue** | Routes tasks (e.g. by market). `createTask` can target a queue by SID or resolve by `attributes.market`. |
| **Workflow** | Defines how tasks move from queue to workers. SID from `TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID` or `TWILIO_TASKROUTER_WORKFLOW_SID`. |

---

## 3. Who Does What (Code)

### 3.1 `server/taskrouter-service.ts`

- **Single source** for listing workers/activities for the terminal and scripts (no duplicate logic).
- **`listWorkers({ availableOnly?, limit?, workspaceSid? })`**
  - Lists workers in the workspace.
  - Resolves activity SID → name and Twilio **available**.
  - **“Available”** = activity has `available === true` **and** activity name doesn’t match busy (wrap, on call, ringing, dialing, etc.).
  - Returns `WorkerInfo`: workerSid, friendlyName, activityName, activitySid, available, activityDateUpdated, market, states, attributes.
- **`listActivities()`** — Lists workspace activities (sid, friendlyName, available).
- **`getWorkerSidsWithPendingReservation({ workspaceSid? })`** — Worker SIDs that have a **pending** reservation (call ringing). Used so the terminal can show “Ringing” instead of only “Available”.
- **`listPendingTasks({ workspaceSid? })`** — Tasks in **pending** or **reserved** state (waiting or offered). Returns taskSid, assignmentStatus, direction, waitSeconds, callSid, market, state.
- **`fetchWorkspace()`** / **`getWorkspaceSid()`** — Resolve workspace SID (config or first workspace in account).
- **`isTaskRouterConfigured()`** — True if account SID, auth token, and workspace SID are set.

### 3.2 `server/services/twilio-taskrouter.ts`

- **`createTask({ attributes, taskQueueSid?, workflowSid?, timeout?, priority? })`**
  - Creates a task in the **terminal workspace**.
  - Attributes: direction, market, state, campaignId, callSid, etc. Used for routing and assignment callback.
  - Can resolve task queue by **market** if `taskQueueSid` not given.
  - Returns `{ success, taskSid?, error? }`. TaskRouter then assigns the task to an available worker (workflow/queues).
- **`listTaskQueues()`** — Lists task queues (sid, friendlyName) for the workspace.
- **`getTaskRouterDebug()`** — Debug: workspace SID + worker list (same as script).

Workers/activities listing is delegated to **taskrouter-service** (`listWorkersFromScript`).

---

## 4. HTTP API (routes.ts)

| Endpoint | Purpose |
|----------|--------|
| **GET /api/terminal/agents** | Terminal view: all **non-offline** workers with normalized status (available, on_call, dialing, ringing, wrap, break, unavailable). Uses **terminal workspace**. Includes ringing via `getWorkerSidsWithPendingReservation`. |
| **GET /api/terminal/agents/taskrouter** | Same workspace, same status mapping; used when terminal is not “taskRouter only” to merge/bucket agents. |
| **GET /api/routing/workers** | Workers for routing UI: TaskRouter workers + **Sync (WebRTC)** workers not already in TaskRouter (so WebRTC-only agents appear). |
| **POST /api/routing/task** | **Create a TaskRouter task** (inbound/outbound call). Body: `attributes` (required), `taskQueueSid`, `workflowSid`, `timeout`, `priority`. Calls `createTask()`. **Calls only route if something POSTs here when a call arrives.** |
| **GET /api/routing/activities** | List activities (for routing/config UIs). |
| **GET /api/routing/queues** | List task queues. |
| **GET /api/routing/tasks/pending** | List pending/reserved tasks (terminal workspace). |
| **GET /api/routing/diagnostic** | Debug: workspace SID, pending task count, queues, workers (name, activity, available). Note: “Calls only route if something POSTs to /api/routing/task when a call arrives.” |

---

## 5. Status Mapping (Terminal / Statistics)

Workers are mapped from **activity name** to a **normalized status**:

- **offline** — Activity name matches `^offline$`.
- **break** — break, lunch, meal, rest.
- **unavailable** — unavailable, dnd, do not disturb, soft, away.
- **wrap** — wrap, acw, after call.
- **dialing** — dial, dialing.
- **ringing** — ring, ringing, offered, or worker has a **pending reservation**.
- **on_call** — !available or activity name like busy, on call, meeting, etc.
- **available** — available, inbound, idle (and not unavailable/offline/away).

“**Online**” for stats/counts = any status **except offline** (same as terminal “non-offline”).

---

## 6. Where TaskRouter Is Used

- **Agent Terminal** — Left column: Available (TaskRouter + optional WebRTC). Right column: On call, dialing, ringing, wrap, break, unavailable. All from TaskRouter workers (+ ringing from pending reservations).
- **Statistics** — When TaskRouter is configured, “online agents” = TaskRouter non-offline count (so dashboard matches terminal).
- **Lead campaign manager** — **TaskRouter (tsk) workers** are included as agents for dialing: only **available** workers count; dials/thresholds use real agent count (VDP + TaskRouter).
- **WebRTC sessions fallback** — If no webhook/Sync presence, “WebRTC devices ON” is filled from TaskRouter **non-offline** workers.
- **Routing** — Inbound/outbound calls become **tasks** via `POST /api/routing/task`. TaskRouter assigns them to available workers. No POST → no routing.

---

## 7. Scripts

- **`npx tsx server/scripts/check-taskrouter.ts`** — Prints workspace, workflow, activities, total workers, **online** (available-only) workers. Uses default workspace from config (same SID as terminal).
- **`npx tsx server/scripts/set-worker-offline.ts <identity>`** — Sets one worker to **Offline** (e.g. `chrislafond@aoglobelife.com`). Finds worker by friendlyName/email, finds Offline activity, updates worker’s activity.

---

## 8. How can an agent get calls if TaskRouter never assigned them?

**You have one TaskRouter workspace and no other TaskRouters.** If someone (e.g. Scott) is receiving calls but **TaskRouter has no record of ever assigning them** (no reservations for that worker), then **the call is not being delivered by TaskRouter**.

### How that happens

- **The Twilio phone number’s “A call comes in” webhook** decides what runs when a call hits that number.
- **If that URL is not this app’s** `https://YOUR_APP/api/voice/incoming`, then **this app never runs** and **no TaskRouter task is created** for that call.
- Whatever URL **is** configured (e.g. AOI Rail, Flex, or another TwiML app) can:
  - Use **`<Dial><Client>identity</Client></Dial>`** to ring a specific (or “first available”) WebRTC client by identity.
  - Decide “who is available” from **AOI Rail, Sync, or its own logic** — **no TaskRouter task, no assignment**.
  - So the same number, same account, **one TaskRouter** — but the call never touches TaskRouter because the number points elsewhere.

### What to check

1. **Twilio Console → Phone Numbers → [your number] → “A call comes in”**  
   - If it’s not `.../api/voice/incoming`, then inbound calls are **not** going through this app or TaskRouter.
2. If it points to **AOI Rail** (or another service), that service may be **Dialing clients by identity**; TaskRouter is never used for that flow.
3. **Worker list cap:** This app lists workers with **limit 500** (or 1000 where supported). If the workspace has more workers, someone could be on a later page; use **`npx tsx server/scripts/worker-reservations.ts list`** (or with a name filter) to search; the script can be updated to paginate through all workers.

---

## 9. Summary

- **One workspace** (AOI Inbound Transfers) is used for terminal, routing, and campaign dialing.
- **Workers** = agents; **activity** = current state; **available** on the activity = can receive tasks.
- **Tasks** = calls; created via **POST /api/routing/task**; TaskRouter assigns to available workers.
- **Ringing** = worker with a **pending** reservation.
- **Terminal and stats** use the same workspace and same “online” rule: non-offline workers; “available” = activity.available and not busy by name.
- **Agent getting calls with no TaskRouter assignment:** The number’s “A call comes in” webhook is likely pointing to a different URL that Dials clients (e.g. by WebRTC identity) without creating a TaskRouter task.
