# Server segmentation for compartmentalized builds

This document maps **routes**, **server modules**, and **client pages** to each server/section so you can create separate Railway deploys. The existing monolith keeps running while you extract each section.

**Create services on Railway:** Run `npm run railway:setup-services` (requires `RAILWAY_TOKEN`). Creates `aoirail-shell`, `aoirail-api`, `aoirail-twilio`, `aoirail-data`, precheck/connect/recruit/stats, plus **`aoirail-campaign-manager`** and **`aoirail-leadsync`** (standalone apps under `apps/*` — no `SECTION`). Services use Railway default URLs (e.g. `https://aoirail-twilio-production.up.railway.app`). Optional: `RAILWAY_PROJECT_ID`; set `DOMAIN_PARENT` only if you want custom domains (e.g. twilio.aoiglobe.com). Then `npm run railway:connect-repos` sets root directory and build/start per service.

**Base URL:** All webhooks, callbacks, and links use `getBaseUrl()` from `server/hardcoded-config.ts`, which reads `BASE_URL`, `APP_URL`, or `RAILWAY_PUBLIC_DOMAIN`. Each Railway service gets its own `RAILWAY_PUBLIC_DOMAIN`, so when you deploy a service (e.g. aoirail-twilio), that deploy will use its own URL for Twilio webhooks—no code change per service.

---

## 1. Twilio server

**Purpose:** All Twilio and WebRTC webhooks and call APIs. Isolates call volume and Twilio bugs from Connect UI.

### Server routes (from `server/routes.ts`)

- `GET/POST /voice`, `POST /incoming`, `POST /twiml` (TwiML/voice)
- `POST /webhook/webrtc` (and the one in `index.ts`: `app.all("/webhook/webrtc", ...)`)
- `POST /api/twilio/webrtc`, `POST /api/twilio/voice`, `POST /api/voice`, `POST /api/twilio/inbound-fallback`
- `GET /api/twilio/token`
- `POST /api/twilio/dial` (both registrations)
- `GET /api/twilio/outbound-lead-twiml`
- `POST /api/dial-lead`
- `GET /lead-join`
- `POST /api/twilio/update-twiml-app`, `GET /api/twilio/check-twiml-app`
- `POST /api/twilio/backfill-call-numbers`
- `POST /api/outbound-dialer/initiate-call`, `POST /api/outbound-dialer/end-call`, `POST /api/outbound-dialer/update-call-status`
- `GET /api/twilio/call-status` (Twilio status callback – if mounted at `/api/twilio/` in a router, include that router)
- Any route that serves **recording-status** or **conference-status** callbacks (search for `recording-status`, `conference-status`, `dial-action`, `statusCallback`)

Also from `server/index.ts` (move into Twilio server):

- `app.all("/webhook/webrtc", ...)` (lines ~219–305)
- `app.post("/api/twilio/dial-action", ...)` (lines ~312+)

### Server modules (copy or share)

- `twilio-dial.ts`
- `twilio-token.ts`
- `twilio-call-service.ts`
- `twilio-conference-service.ts`
- `twilio-status-webhook.ts` (or equivalent status callback handler)
- `webrtc-call-service.ts`, `webrtc-phone-bridge.ts`, `webrtc-phone-service.ts`
- `local-presence-service.ts` (needed for caller ID in TwiML)
- `conference-keeper.ts`, `conference-anchor.ts`
- `phone-utils.ts` (formatToE164)
- `hardcoded-config.ts` (Twilio env)
- `supabase.ts` (to log calls, update recording_url)

### Client

- None. Connect and other UIs call this server for token/dial/initiate-call; they stay in the Connect (or other) app.

---

## 2. Precheck server (verification flow + Taalk)

**Purpose:** Producer and client verification flows, verification session APIs, Taalk webhooks.

### Server routes

- `POST /api/verification/session`
- `GET /api/verification/session/:sessionId`
- `POST /api/step2-webhook/:sessionId`
- `PATCH /api/verification/session/:sessionId/method`
- `POST /api/verification/session/:sessionId/capture-agent-ip`, `.../capture-client-ip`, `.../analyze-ip`
- `POST /api/verification/session/:sessionId/screenshot`
- `POST /api/verification/session/:sessionId/send-sms`
- `POST /api/verification/initiate-conference-call`, `POST /api/verification/initiate-zoom-call`
- `GET /api/verification/twiml/:sessionId`
- `POST /api/verification/call-status/:sessionId`
- `POST /api/verification/session/:sessionId/initiate-call`, `.../complete-call`, `.../reset-call`, `.../start-live-call`, `.../complete-verification`, `.../approve`, `.../complete`
- `GET /api/verification/session/:sessionId/call-status` (both registrations)
- `POST /api/verification/call-callback`
- `POST /api/verification/client-approval`
- `POST /api/verification/generate-certificate`
- `POST /api/verification/session/:sessionId/analyze-audio`
- `GET /agent-verify/:sessionId`, `GET /agent-verify-es/:sessionId`
- `GET /client-verify/:sessionId`
- `POST /api/taalk/webhook`
- `POST /api/taalk/initiate-call`
- `POST /api/taalk/incoming-call`
- `POST /api/taalk/recording-complete`
- `POST /api/taalk/assign-agent`
- `GET /api/objstore/recordings/:filename` (if used only by verification/precheck)

### Server modules

- `taalk-handler.ts`
- `taalk-service.ts`
- `sms-service.ts` (verification SMS)
- `verification-screenshot-validator.ts` (if used in screenshot route)
- `verification-audio-analyzer.ts` (if used in analyze-audio route)
- `storage.ts` (Supabase session CRUD), `supabase.ts`
- `email-service.ts` (certificate email)
- Multer/upload config for screenshot

### Client pages

- `verification-workflow.tsx`, `verification-workflow-es.tsx`
- `agent-verification.tsx`
- `client-verification.tsx`
- `final-completion.tsx`
- `verification-results.tsx`
- `conference-verification-workflow.tsx`
- `AOPrecheck.tsx` (producer start flow)

### Client components

- `components/verification/*` (all)
- `components/precheck/*` (e.g. PrecheckSessionModal)

---

## 3. Precheck Management server (AO Precheck Admin)

**Purpose:** AOIPrecheckAdmin UI and aoi-precheck APIs (sessions list, recording, analyze-now, downloads).

### Server routes

- `GET /api/aoi-precheck/sessions`
- `GET /api/aoi-precheck/check-transcript-status`
- `POST /api/aoi-precheck/trigger-transcript-sync`
- `POST /api/aoi-precheck/sessions/:sessionId/refresh-transcript`
- `GET /api/aoi-precheck/stats`
- `GET /api/aoi-precheck/agents`
- `PUT /api/aoi-precheck/sessions/:sessionId`
- `DELETE /api/aoi-precheck/sessions/:sessionId`
- `GET /api/aoi-precheck/recording/:sessionId`
- `POST /api/aoi-precheck/recording/:sessionId/download`
- `POST /api/aoi-precheck/analyze-now`
- `PUT /api/aoi-precheck/sessions/:sessionId/status`
- `GET /api/aoi-precheck/agent-teams`
- `GET /api/aoi-precheck/download/screenshot/:sessionId` (if present)
- `GET /api/aoi-precheck/download/recording/:sessionId`
- `GET /api/aoi-precheck/download/certificate/:sessionId`
- `OPTIONS /api/aoi-precheck/recording/:sessionId`

### Server modules

- `verification-analysis-scheduler.ts`
- `transcript-summary-scheduler.ts`
- `verification-audio-analyzer.ts`
- `verification-screenshot-validator.ts`
- `verification-daily-report.ts` (if used by admin)
- `storage.ts`, `supabase.ts`

### Client pages

- `AOIPrecheckAdmin.tsx`

### Client components

- Any used only by AOIPrecheckAdmin (e.g. precheck admin tables, recording player, certificate download).

---

## 4. Connect server

**Purpose:** Connect UI (dialer, live call board, campaign manager, hotleads, VDP, credits). Calls Twilio server for token/dial; no Twilio webhooks here.

### Server routes (non-Twilio Connect/VDP/credits)

- `GET /api/twilio-numbers` (or move to Twilio server and have Connect call it)
- `GET /api/connectnow/user-credits/:email`
- `GET /api/dashboard/stats`, `.../calls-fixed`, `.../recent-calls`, `.../user-stats`
- `GET /api/call-connector-pro/access-check/:email`
- `POST /api/call-connector-pro/dismiss-primer`
- `POST /api/disclaimers/accept-vdp`, `.../accept-call-connector-pro`, `.../accept-call-connector-pro-recruit`
- `GET /api/disclaimers/check-status`
- `GET /api/dialer/current-lead`, `.../stats`, `POST .../start-call`, `POST .../end-call`
- `POST /api/masterlead/update-last-contacted`, `POST /api/hotlead/update-last-contacted`
- `POST /api/outbound-dialer/power`, `GET /api/outbound-dialer/daily-stats`
- `POST /api/outbound-dialer/save-disposition`, `POST /api/outbound-dialer/disposition`
- `GET /api/outbound-dialer/local-presence`
- `GET /api/aoi-connect/status`
- `POST /api/webhook/vdp-events`, `POST /api/webhook/vdp-events/test`
- `POST /api/vdp/heartbeat`, `.../call-start`, `.../call-end`, `GET .../debug`, `POST .../hotlead-eligibility`
- `GET /api/taalk/campaigns`, `POST /api/taalk/campaigns`, `PUT .../activate`, `.../update-limit`, `.../shutdown`, bulk updates (for Connect campaign manager)
- `GET /api/leads/request-leads`
- `GET /api/twilio-calls`, `GET /api/twilio-call-stats`, `POST /api/sync-twilio-calls`, `POST /api/twilio-auto-sync/start|stop`, `GET .../system-calls-count`, `POST .../backfill-owner-email`, `GET .../status`
- `POST /api/twilio/fix-attributions`
- `GET /api/inbound-calls/active`
- Credit routes used by Connect (from `credit-routes.ts` if mounted here)
- `GET /api/user/credits`, `GET /api/user/credit-status`

### Server modules

- `vdp-service-fixed.ts` (setupVDPRoutes)
- `connectnow-service.ts`
- `local-presence-service.ts` (if not only in Twilio server)
- `taalk-service.ts`, `taalk-hotlead-service.ts`, `taalk-vdp-poller.ts`
- `booked-leads-webhook-sender.ts`
- `hotlead-scheduler.ts`, `hotlead-auto-assign.ts`, `hotlead-sync-service.ts`
- `call-tracking-service.ts`, `bulletproof-call-tracker.ts`, `agent-dial-metrics-tracker.ts`
- `lcb-credits.ts`, `credit-service.ts` (or call API server)
- `dashboard-service.ts`
- `lead-assignment-scheduler.ts`, `ccpro-flag-sync-scheduler.ts`

### Client pages

- `Connect.tsx`
- `NewDialer.tsx`
- `CampaignManagerPage.tsx`
- `TaalkCampaignManager.tsx`
- `LiveCallBoardNew.tsx`, `LiveCallBoard.tsx`, `LiveCallBoardSimple.tsx`
- `CallAnalyticsAdmin.tsx`
- `HotleadAdmin.tsx`, `HotleadsPage.tsx`
- `InboundCallDashboard.tsx`
- `AOIntelligence.tsx` (if Connect-only)
- `BillingDashboard.tsx`, `AgentBilling.tsx`, `AOConnectBilling.tsx`, `ManagerBillingPortal.tsx` (or move shared billing to API)
- `MissedCalls.tsx`, `MissedCallAdmin.tsx`, `MissedCallValidation.tsx`
- `AccountabilityPage.tsx`, `DailyAccountability.tsx`
- `CallMonitoringBoard.tsx`

### Client components

- `components/outbound-dialer/*`
- `components/connectnow/*`
- `components/layouts/ConnectNowLayout.tsx`

---

## 5. Recruit server

**Purpose:** AO Recruit UI and recruit-specific APIs.

### Server routes

- `GET /api/recruit/stats`
- `GET /api/recruit/leads`
- `GET /api/live-call-board/recruit-stats` (if recruit-only)
- `GET /api/live-call-board/presentations`, `POST .../start`, `.../end`, `.../screenshot`
- Recruit-specific followups/appointments if any
- `POST /api/disclaimers/accept-call-connector-pro-recruit`

### Server modules

- Recruit schedulers / services (e.g. backfill-recruit-ai-summaries, recruit-related sync)

### Client pages

- `AORecruit.tsx`
- `RecruitJourney.tsx`
- `RecruitWaiting.tsx`
- `AgentPresentations.tsx`, `LivePresentations.tsx`, `PresentationReview.tsx`, `PresentationAnalytics.tsx` (if recruit/HPPRO)

### Client components

- Recruit-specific components only.

---

## 6. Stats server

**Purpose:** Live Call Board stats, agent stats, AOI reports, analytics. Read-heavy.

### Server routes

- `GET /api/live-call-board/stats`, `.../stats-legacy`, `.../agents`, `.../agents-legacy`
- `GET /api/live-call-board/teams`, `.../outbound-calls`, `.../outbound-stats`, `.../agent-outbound-stats/:email`
- `GET /api/live-call-board/user-team-info`, `.../debug-scan`
- `GET /api/agent-dial-metrics`
- `POST /api/live-call-board/test-midnight-reset`, `.../reset-stats`
- `GET /api/aoi-reports/stats`, `.../check-blocking/:email`, `.../booked-leads`, `.../pending`, `.../all`, `.../master`
- `PUT /api/aoi-reports/resolve/:callId`
- `GET /api/aoi-followups/pending/:agentEmail`, `.../overdue`, `PUT .../complete/:followupId`
- `GET /api/connectnow-analytics/daily-report`, `.../weekly-report`, `.../billing-summary`
- `GET /api/dashboard/agent-stats`, `.../agent-performance`
- `GET /api/manager/dashboard`
- `GET /api/globe-market-by-state`
- `GET /api/billing/team-charges/:dateRange?`
- `GET /api/admin/twilio-usage-yesterday`
- `GET /api/admin/usage-stats`

### Server modules

- `connectnow-analytics-service.ts`
- `calculate-dial-reach-booked-realtime.ts` (or equivalent)
- Services that only read for LCB/reports

### Client pages

- `LiveCallBoardNew.tsx` (or a stats-only variant)
- `MasterAOIReports.tsx`, `AOIReports.tsx`, `AOIReportPage.tsx`
- `ConnectNowAnalytics.tsx`
- `AnalyticsPage.tsx`
- `WeeklyAgencyReport.tsx`
- `WarReports.tsx`, `WarSystem.tsx`

---

## 7. API server (shared)

**Purpose:** Auth, user profile, notifications, shared lookups. Used by all section UIs.

### Server routes

- `POST /api/auth/login`, `.../signup`, `GET .../session`, `POST .../logout`
- `GET /api/auth/profile`, `PUT .../profile`
- `POST /api/auth/forgot-password`, `.../reset-password-with-sms`, `.../reset-password-with-token`, `.../reset-password`
- `POST /api/auth/verify-email`, `.../resend-verification-email`, `.../test-verification-email`
- `GET /api/auth/profile-completion-status`
- `GET /api/validate-producer-email`
- `POST /api/agent/upload-profile-picture`
- `GET /api/notifications`, `POST .../:id/read`, `.../read-all`
- `GET /api/user/profile`, `.../credits`, `.../experience`, `POST .../award-experience`
- `GET /api/user/onboarding-status`, `POST .../complete-onboarding`
- `GET /api/user-permissions`
- `GET /api/producerlist`
- `GET /api/agent/licensed-states`
- `GET /api/attached_assets/:filename`
- `POST /api/help/submit`
- `POST /api/support/eapp-screenshot`, `GET .../eapp-example`
- `POST /api/agent-activity/heartbeat`, `.../update-status`
- Billing router (shared): `billing-routes.ts` – mount at ` /api/billing` and include report endpoints used by multiple sections
- Admin backfills used by multiple sections: `POST /api/admin/backfill-billing-transactions`, `.../backfill-call-log`
- Quality managers / teams: `GET/POST/DELETE /api/admin/quality-managers`, `.../mga-teams`, `.../qm-teams`, `.../teams`
- `GET /api/appointments/pending-review`
- `GET /api/debug-agent/:agentId`
- `GET /api/send-mga-email`
- `POST /api/webhook/remove-lead-by-phone`
- `POST /api/admin/force-assign-leads`, `.../recycle-leads`, `.../reset-pending-leads`
- `POST /api/admin/disclaimers/reset`
- Gamification: `GET /api/gamification/elite-performance/:email`, `.../stats/:userId`, `.../achievements/:userId`
- `GET /api/vdp-calls/schema`
- `GET /api/video/check-access`, `.../admit`, `POST .../token`
- `GET /api/accountability/check-status`, `.../outcomes-analytics`, `.../weekly-sales-total`
- `GET /api/aoi-meet/weekly-stats`
- `GET /api/debug/hotlead-priority/:email`, `.../agent-leads`

### Server modules

- `auth-service.ts`
- `storage.ts` (profile, agent), `supabase.ts`
- `admin-service.ts`
- `dashboard-service.ts`
- `email-service.ts`, `email.ts`
- `usage-tracker.ts`
- Billing: `billing-routes.ts`, `billing-service.ts`, `subscription-service.ts`
- `manager-billing-routes.ts` if shared
- `version-enforcement.ts`
- `rbac-helper.ts`, `ftc-compliance.ts`
- `timezone-helper.ts`

### Client

- None (API only). Login page can live in Shell or a small Auth app that calls this API.

---

## 8. Shell app

**Purpose:** Single entry UI: sidebar + links to section URLs. No section logic.

### Server

- Minimal Express (or static host): serve `index.html` for `/*` (SPA fallback). Optional health check.

### Client pages

- One shell layout: sidebar/nav that links to:
  - Connect → Connect server URL
  - Precheck → Precheck server URL
  - Precheck Admin → Precheck Management URL
  - Recruit → Recruit server URL
  - Stats / LCB → Stats server URL
- Optional: `Login.tsx`, `signup.tsx`, `forgot-password.tsx`, `reset-password.tsx` if auth lives here; otherwise redirect to Auth app.

### Client components

- One layout component (sidebar + outlet or links only).
- Shared design tokens/theme if you want (or each section brings its own).

---

## Cross-cutting notes

- **Shared code:** Put in a `packages/shared` (or similar): `shared/schema.ts`, Supabase client factory, types, env types. Each server and client can depend on it.
- **Billing:** Many routes touch billing. Either keep billing in API server and have sections call it, or duplicate minimal billing read in Connect/Stats.
- **Twilio status callbacks:** Must point at the **Twilio server** URL (e.g. `https://twilio.xxx.railway.app/api/twilio/call-status`) so that server receives all callbacks.
- **Taalk webhook:** Must point at the **Precheck server** URL (e.g. `https://precheck.xxx.railway.app/api/taalk/webhook`).
- **Verification links in SMS:** Use env `VERIFICATION_BASE_URL` pointing at the Precheck server so `agent-verify` and `client-verify` links go to the right deploy.
- **Line numbers:** Routes in `routes.ts` are approximate; search for the path or a unique string in the handler to get the exact block to extract.
- **Mounted routers:** `billingRouter`, `twilioStatusRouter`, `scrapeRoutes`, `meetsRoutes`, `warStatsRoutes`, etc. – assign each to the server that owns that domain (e.g. Twilio status → Twilio server; billing → API server).

---

## Deploy per service (Railway)

Each service has a folder under `apps/` that builds from repo root and starts with `SECTION=<name>`. The server only serves routes for that section when `SECTION` is set (see `server/section-paths.ts`).

| Railway service      | Root Directory   | SECTION (set by start script) |
|----------------------|------------------|--------------------------------|
| aoirail-shell        | `apps/shell`     | shell                          |
| aoirail-api          | `apps/api`       | api                            |
| aoirail-twilio       | `apps/twilio`    | twilio                         |
| aoirail-data         | `apps/data`      | data                           |
| aoirail-precheck     | `apps/precheck`  | precheck                       |
| aoirail-precheck-admin | `apps/precheck-admin` | precheck-admin          |
| aoirail-connect      | `apps/connect`   | connect                        |
| aoirail-recruit      | `apps/recruit`   | recruit                        |
| aoirail-stats        | `apps/stats`     | stats                          |

**In Railway:** For each service, set **Root Directory** to the folder above. Use **Build Command** `npm run build` and **Start Command** `npm run start` (each app’s package.json runs the root build and then starts with the correct SECTION). Twilio and Shell use compartmentalized builds (build:twilio ~61KB, build:shell ~14KB). API/Precheck/Connect/Recruit/Stats use monolith with SECTION until route extraction. Existing production deploy: leave Root Directory empty and do not set SECTION so the app runs as the full monolith.

### Precheck deploy configuration

Precheck and Precheck-Admin include `/api/auth` and `/api/agent` in their path allowlists so users can log in when landing directly on those deploys.

**Environment variables (Precheck service):**

- Copy all monolith env vars (Supabase, Twilio, etc.) – same as production.
- **`VERIFICATION_BASE_URL`** – **Required.** Must point at the Precheck deploy URL (e.g. `https://aoirail-precheck-production.up.railway.app`). Used for `agent-verify` and `client-verify` links in SMS.
- **`RAILWAY_PUBLIC_DOMAIN`** – Set automatically by Railway for each service.

**Taalk webhook:** Configure Taalk to call the Precheck deploy URL, e.g. `https://aoirail-precheck-production.up.railway.app/api/taalk/webhook`.
