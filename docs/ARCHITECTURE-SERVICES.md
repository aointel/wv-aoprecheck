# AOIrail backend: monolith → services (plan + Phase A)

This document maps the current Node monolith, proposes service boundaries, lists migration order, and records **Phase A** (background workers extracted; web can disable them via env).

---

## 1) Current architecture map (by responsibility)

### Voice ingress

- **files:** `server/routes.ts` (primary), `server/taskrouter-service.js`, `server/twilio-webhook-setup.ts`, `server/section-paths.ts`, `server/index.ts` (TaskRouter preload for first `/incomingcall`), `server/routes-sections/routes-twilio.ts` (legacy/alternate registration — verify which is active at runtime)
- **endpoints (representative):**
  - `GET|POST /incomingcall` — 609 TaskRouter Enqueue TwiML (canonical inbound path per workspace rules)
  - `GET|POST /webhook/webrtc` — WebRTC/voice webhook (non-609 / legacy paths)
  - `GET|POST /incomingcall-dial-action` — dial-action for inbound waves
  - `POST /api/twilio/enqueue-action` — queue result / cleanup
  - `POST /api/twilio/taskrouter/assignment` — assignment callback
  - `GET /api/twilio/taskrouter/assignment-debug`, `GET .../last-assignments`
  - `POST /api/twilio/taskrouter/accept` — accept + dequeue
  - Verification TwiML: `GET /api/verification/twiml/:sessionId`, `POST /api/verification/call-status/:sessionId`
- **dependencies:** Twilio REST + TaskRouter SDK, `masterlead` / Supabase, TwiML builders in `taskrouter-service`, `twilio_call_logs` writes

### Twilio status / recording / AMD (often “warm path”)

- **files:** `server/twilio-status-webhook.ts` (mounted as call-status router in `routes.ts`), dial/recording handlers colocated in `routes.ts` and Twilio helper modules
- **endpoints:** e.g. `POST /api/twilio/call-status` (verify exact mount in `registerRoutes`), AMD/recording status URLs referenced in TwiML
- **dependencies:** Supabase (`twilio_call_logs`), Twilio REST fetch for missing `To`/`From`

### Dialer API / WebRTC

- **files:** `server/twilio-token.ts`, `server/twilio-dial.ts`, `server/routes.ts` (`POST /api/twilio/dial`, WebRTC-related routes), `server/twilio-call-service.ts`, `server/twilio-conference-service.ts`
- **endpoints (representative):** `POST /api/twilio/dial`, token issuance routes (search `twilioToken` / `webrtc` in `routes.ts`), agent online/heartbeat adjacent routes under `/api/agent/*`, `/api/agent-activity/*`
- **dependencies:** Twilio tokens, Supabase for agent/session state

### Reporting / dashboard / analytics

- **files:** Mostly `server/routes.ts` (large surface), plus dedicated modules pulled by routes (`connectnow-analytics-*`, live call board, AOI Precheck, billing summaries)
- **endpoints (representative):** `/api/connectnow-analytics/*`, `/api/inbound/my-stats`, `/api/agent/my-stats`, `/api/agent/panel-data`, `/api/aoi-precheck/*`, `/api/admin/usage-stats`, `/api/debug/*`, public live card helpers
- **dependencies:** Supabase read-heavy paths; overlaps tables used by voice (`twilio_call_logs`, `live_call_board*`, etc.)

### Workers / schedulers (Phase A target)

- **files:** `server/background-workers.ts` (**single start function**), `server/entry-worker.ts` (standalone process), modules started from there: `vdp-credit-enforcer`, `agent-availability-tracker`, `verification-daily-report`, `recruit-vdp-poller`, `recruit-ai-summary-updater`, `aointel-vdp-poller`, `taalk-vdp-poller`, `vdp-agent-tracker`, `recording-scheduler`, `recording-url-scheduler`, `hotlead-scheduler`, `daily-billing-recap-service`, `live-call-board-stats-scheduler`, `twilio-auto-sync`, `billing-transaction-sync`, `verification-analysis-scheduler`, `taalk-campaign-sync-scheduler`, `inbound-calls-twilio-sync`, `booked-leads-webhook-sender`, `ftc-queue-cleaner`, `verification-automation-scheduler`, `presentation-lifecycle-manager`, `ccpro-flag-sync-scheduler`, `connectnow-billing-daily-scheduler`, `activity-card-report-scheduler`, `call-analytics-disposition-model`, masterlead `no_answer` reset interval
- **loops/jobs:** each module’s `start()` / `setInterval` / `node-cron` internally
- **dependencies:** Supabase, Twilio API, Taalk API, Zapier (schedulers), OpenAI (where enabled)

### Shared utilities

- **files:** `server/supabase.ts`, `server/hardcoded-config.ts`, `server/phone-utils.ts`, `server/storage.ts`, `server/feature-flags.ts`, Twilio helpers above, logging (note: `server/index.ts` suppresses most `console.*` in production)

### External integrations (cross-cutting)

- **Supabase:** essentially all route modules and schedulers; grep `supabase` / `supabaseAdmin` under `server/`
- **Zapier:** `routes.ts` (webhooks, verification steps, proxies `/api/webhook/zapier-*`), `hotlead-scheduler`, `booked-leads-webhook-sender`, producer resolution helper in `routes.ts`
- **Twilio REST:** `twilio-status-webhook.ts`, `twilio-auto-sync`, `inbound-calls-twilio-sync`, TaskRouter paths in `routes.ts`, `taskrouter-service.js`

---

## 2) Proposed service split (target)

| Service | Owns |
|--------|------|
| **voice-ingress** | `/incomingcall`, enqueue-related TwiML, minimal status handling, TaskRouter assignment/accept as configured today |
| **dialer-api** | WebRTC token, `/api/twilio/dial`, agent voice online/offline |
| **dashboard-api** | Panel data, analytics, reporting, Precheck UI APIs |
| **workers** | All of `startBackgroundWorkers()` |
| **shared** | Types, env validation, Twilio/Supabase helpers, auth helpers |

---

## 3) Exact files to move (by phase)

- **Phase A (done):** logic lives in `server/background-workers.ts`; process entry `server/entry-worker.ts`; flags `server/feature-flags.ts`; `server/index.ts` delegates when `shouldStartWorkersInWebServer()`.
- **Phase B:** carve `routes.ts` reporting sections → `dashboard-api` (or `routes-dashboard.ts` mounted behind a flag), keep shims on old paths.
- **Phase C:** extract `handleIncomingCall`, TaskRouter routes, minimal TwiML handlers → `voice-ingress` service; proxy from monolith if URL changes.
- **Phase D:** `twilio-token.ts`, `twilio-dial.ts`, related `/api/twilio/*` client routes → `dialer-api`.

---

## 4) Routes per service (target — many still in `routes.ts` today)

- **voice-ingress:** `/incomingcall`, `/incomingcall-dial-action`, `/api/twilio/enqueue-action`, `/api/twilio/taskrouter/*` (as today), verification TwiML if still voice-owned
- **dialer-api:** `POST /api/twilio/dial`, token routes, WebRTC client config
- **dashboard-api:** `/api/connectnow-analytics/*`, `/api/agent/panel-data`, `/api/inbound/my-stats`, `/api/aoi-precheck/*`, admin/debug report routes
- **workers:** no HTTP (or health only later)

---

## 5) Environment variables (per deployable)

### Web (Railway main)

- Existing app env (unchanged for Phase A).
- **`ENABLE_WORKERS`:** set to `false` to disable workers everywhere (web + worker process respects this inside `startBackgroundWorkers`).
- **`START_WORKERS_IN_WEB`:** `false` | `0` | `no` → web does **not** run `startBackgroundWorkers`; run `entry-worker` separately.
- Reserved for later phases: `ENABLE_DASHBOARD_ROUTES`, `ENABLE_VOICE_INGRESS_ROUTES`, `ENABLE_DIALER_ROUTES`, `ENABLE_ZAPIER_ASYNC`, `ENABLE_CALL_STATUS_ASYNC_WRITE` (see `feature-flags.ts`).

### Worker (`node dist/worker.js`)

- Same DB/Twilio/Taalk secrets as web.
- **`ENABLE_WORKERS`:** must not be `false` or the worker exits immediately.

---

## 6) Migration order

1. **Phase A** — Workers out of web process (optional second Railway service). **Done in code**; enable by deploy config.
2. **Phase B** — Dashboard/reporting API split or mount behind flag + proxy.
3. **Phase C** — Voice ingress split; **highest Twilio risk** — review URLs, TaskRouter callback URLs, 609 Voice URL.
4. **Phase D** — Dialer/token split; **WebRTC identity must match TaskRouter `contact_uri`**.

---

## 7) Rollback plan

- **Phase A:** Set `START_WORKERS_IN_WEB` unset (default on) and stop the worker Railway service — behavior returns to single-process workers. Or set `ENABLE_WORKERS=false` to stop all schedulers (know the operational impact).
- Redeploy previous build if needed; no route URL changes in Phase A.

---

## 8) Known risks

- **Duplicate schedulers:** If both web (`START_WORKERS_IN_WEB` default true) **and** worker run, jobs run twice. Operational rule: either workers-on-web **or** dedicated worker, not both.
- **AOIntel poller:** Uses a **no-op** lead-display hook everywhere (web and worker). Agents get leads when they ignite / poll the queue, not via server push from the poller.
- **Production logging:** `index.ts` silences `console.log` in production; worker uses normal console — log volume may differ.
- **Twilio / 609:** Any future move of `/incomingcall` or assignment URL requires Twilio console + workspace rule alignment; do not change without explicit runbook.

---

## 9) Phase A code changes (summary)

- Added `server/feature-flags.ts` (`ENABLE_WORKERS`, `START_WORKERS_IN_WEB`, stubs for later flags).
- Added `server/background-workers.ts` with `startBackgroundWorkers(options?)`.
- Replaced duplicated scheduler block in `server/index.ts` with conditional `startBackgroundWorkers()` (no `routes` import for workers).
- Slim `server/entry-worker.ts` → runs `startBackgroundWorkers()` without importing `routes`.
- `package.json` `build` / `build:staging` / `build:production` also emit `dist/worker.js`; `npm run start:worker` runs it; `npm run build:worker` still available.

---

## 10) Too risky to auto-change without review

- **`/incomingcall` TwiML** and TaskRouter workflow/queue expressions (workspace rule).
- **Assignment callback** JSON shape and dequeue/`contact_uri` behavior.
- **Twilio number Voice URL** for 609.
- **Splitting `routes.ts`** without shims — file is huge; risk of dropping a route or double-registering.
- **Call-status webhook** Twilio REST fallback — latency and failure modes if moved behind a queue.

---

## Operational quick start (Phase A)

1. **Status quo (one Railway service):** no env changes; workers still start in web.
2. **Split workers:** Web env: `START_WORKERS_IN_WEB=false`, `ENABLE_WORKERS=true`. Second service: same image, command `node dist/worker.js`, `ENABLE_WORKERS=true`.
3. **Emergency disable all schedulers:** `ENABLE_WORKERS=false` on both.
