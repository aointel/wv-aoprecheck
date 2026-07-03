# TaskRouter: Where Attributes and Priority Come From

## Task attributes (the call: market, state, lead_id, priority, etc.)

**Set when we enqueue the call** — i.e. when your webhook returns TwiML with `<Enqueue workflowSid="...">` and a nested `<Task attributes='...'>`.

- **Source of truth:** Your backend, at enqueue time.
- **How we know market/state:** Look up the **caller** (e.g. `From` / caller phone) in **masterlead** (or your lead DB). Use normalized phone to find lead row; read `taalk_market`, `state` (or lead state), `id` / `taalk_lead_id`, `first_name`, `last_name`, `phone` / `phone_number`.
- **How we know priority:** Your backend decides. Options:
  - **Task priority (Twilio):** When building the Enqueue TwiML you can set task priority (or pass it in task attributes as `priority_class`).
  - **Workflow:** Your Workflow configuration can route by task attributes (e.g. `priority_class == 'elite'` → higher priority queue or higher numeric priority).
- **Minimum task payload** (per your spec): `call_sid`, `lead_id`, `source` (e.g. `ai_transfer` | `direct_inbound`), `market`, `state`, `phone_number`, `transfer_confidence`, `priority_class`, `estimated_value_band`, `prior_agent_id`, `workflow_variant`, `fallback_stage`, `created_at`. All of these are **computed or looked up by your backend** before returning the Enqueue TwiML.

So: **task attributes = your backend sets them when it returns the Enqueue response**, using lead lookup (phone → masterlead) and any scoring/priority logic you implement.

---

## Worker attributes (the agent: market, state, credits_ok, etc.)

**Set when we sync workers** — i.e. when your backend calls `syncWorker()` in `taskrouter-service.ts` (or the Twilio REST API) for each agent who can receive tasks.

- **Source of truth:** Your backend, from:
  - **customers** table: `market`, `states` (licensed states), `associate_id`, name, email.
  - **Credits / billing:** e.g. `credits_ok` (or instant-load allowed).
  - **Presence / activity:** WebRTC heartbeat, on a call or not → map to TaskRouter activity (e.g. AvailableInbound, BusyOnCall, Offline).
  - **Scoring bands:** Your backend computes `rank_band`, `dial_velocity_band`, `priority_tier`, `hog_penalty_band`, `starvation_band` and passes them into worker attributes.
- **contact_uri:** For WebRTC agents, set to `client:<agent_email>` so TaskRouter (and the pending filter) can identify the worker. The assignment callback sends `WorkerAttributes`; we filter pending reservations by `contact_uri` or `agent_email` so the Call Connector Pro header only shows offers for the logged-in agent.

So: **worker attributes = your backend pushes them** when it syncs workers (e.g. on WebRTC load or on a timer), using **customers** + credits + presence + your scoring.

---

## How call priority is determined

1. **When enqueueing:** Your backend can set:
   - **Task attributes** (e.g. `priority_class: 'elite' | 'core' | 'dev'`) from your scoring or rules.
   - **Task priority** in Twilio (if supported in your Enqueue path) so TaskRouter orders this task vs others.
2. **In the Workflow:** The Workflow configuration can use **filter expressions** on task attributes (e.g. `task.priority_class == 'elite'`) to send tasks to different TaskQueues or targets with different **priority** and **timeout** values. So “elite” tasks can get a higher priority number or a shorter timeout.
3. **Right now:** The provisioned workflow has a single filter with `priority: 1`. To have different priorities, add more filters (e.g. by `task.priority_class`) or set task priority when enqueueing.

---

## Summary

| What            | Where it comes from                    | When it’s set                          |
|-----------------|----------------------------------------|----------------------------------------|
| Task market/state/lead | Lead lookup by caller phone (e.g. masterlead) | When returning Enqueue TwiML           |
| Task priority   | Your scoring / rules                   | Same (task attributes or task priority) |
| Worker market/state   | **customers** table                    | When syncing workers (syncWorker)       |
| Worker credits_ok etc.| Your credits + presence + scoring      | Same (syncWorker)                       |

No automatic lookup inside TaskRouter: **your app** does lead lookup and scoring, then passes the result into TaskRouter as task and worker attributes.
