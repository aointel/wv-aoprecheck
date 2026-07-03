# Segmented Services Cutover Checklist

Use this to validate segmented Railway services before disabling the monolith.

## 1) Keep monolith on while building

- Leave `AOIrail` (monolith) running.
- `npm run railway:setup-services` is **idempotent**: it skips any `aoirail-*` service that already exists, and only creates missing ones (including **`aoirail-campaign-manager`** and **`aoirail-leadsync`**).
- Root **`railway.campaign-manager.json`** / **`railway.leadsync.json`** mirror the per-app configs; use **Root Directory** `apps/campaign-manager` or `apps/leadsync` on each Railway service (same as `railway:connect-repos` sets).
- Build/deploy each segmented service:
  - `aoirail-shell`
  - `aoirail-api`
  - `aoirail-twilio`
  - `aoirail-data`
  - `aoirail-precheck`
  - `aoirail-precheck-admin`
  - `aoirail-connect`
  - `aoirail-recruit`
  - `aoirail-stats`
  - `aoirail-campaign-manager` (standalone app under `apps/campaign-manager`)
  - `aoirail-leadsync` (standalone worker under `apps/leadsync`)

## 2) Required envs per service

- Each **monolith slice** service must have:
  - `SECTION=<service-section>`
- Mapping:
  - `aoirail-shell` -> `SECTION=shell`
  - `aoirail-api` -> `SECTION=api`
  - `aoirail-twilio` -> `SECTION=twilio`
  - `aoirail-data` -> `SECTION=data`
  - `aoirail-precheck` -> `SECTION=precheck`
  - `aoirail-precheck-admin` -> `SECTION=precheck-admin`
  - `aoirail-connect` -> `SECTION=connect`
  - `aoirail-recruit` -> `SECTION=recruit`
  - `aoirail-stats` -> `SECTION=stats`

**Standalone services (do not set `SECTION`; not `dist/index.js`):**

- `aoirail-campaign-manager` — Railway root directory `apps/campaign-manager`; build `npm ci --include=dev && npm run build`; start `npm start`.
- `aoirail-leadsync` — Railway root directory `apps/leadsync`; build `npm ci`; start `npm start` (HTTP `/health` + run sync jobs via `npm run sync:full` or cron).

### Frontend routing envs (connect/recruit)

Set these on `connect` and `recruit` services so high-traffic requests route to split backends:

- `VITE_TWILIO_SERVICE_URL=https://aoirail-twilio-production.up.railway.app`
- `VITE_DATA_SERVICE_URL=https://aoirail-data-production.up.railway.app`

### External URLs on the main AOIrail app (monolith / connect / data / …)

After `aoirail-campaign-manager` and `aoirail-leadsync` are deployed (same or different Railway project), point the main app at them:

- **Campaign manager UI/API:** `CAMPAIGN_MANAGER_URL=https://aoirail-campaign-manager-production.up.railway.app` (or your custom domain). Fallbacks: `AOI_COMMAND_URL`, `VITE_AOI_COMMAND_URL`.

- **CCPro assignment-trigger API** (may still be a different deploy): `LEAD_SYNC_URL=https://<assignment-trigger-host>.up.railway.app`. Alias: `AOINTEL_LEAD_SYNC_URL`. The `aoirail-leadsync` service is the **Zoho/Taalk batch worker** (`apps/leadsync`); only set `LEAD_SYNC_URL` to it if that service implements `POST /api/ccpro/assignment-trigger`.

Monorepo sources:

- **Campaign manager:** `apps/campaign-manager` — Express `/api/agent-health`, `/api/agent-command/:email`, `/api/webrtc/presence`, `/api/health`, etc.
- **Leadsync worker:** `apps/leadsync` — Zoho/Airtable/Taalk sync scripts + long-running `/health` shell for Railway. This tree **does not** call Supabase `masterlead` today; anything that **will** refresh AOIrail masterlead over HTTP must target **`aoirail-data`** (`SECTION=data`), not Connect. Set **`AOIRAIL_DATA_SERVICE_URL`** or **`DATA_SERVICE_URL`** on that worker (see `apps/leadsync/lib/data-service-url.cjs` and `apps/leadsync/.env.example`). Do not confuse this with **`LEAD_SYNC_URL`** (CCPro assignment-trigger), which is often a **different** deploy.

Server helpers: `server/external-service-urls.ts` (`getCampaignManagerBaseUrl`, `getLeadSyncBaseUrl`, `getLeadSyncAssignmentTriggerUrl`, `getAoirailDataServiceBaseUrl`).

## 3) Run readiness/smoke checks

Set service base URLs and run:

```bash
SHELL_URL=https://aoirail-shell-production.up.railway.app \
API_URL=https://aoirail-api-production.up.railway.app \
TWILIO_URL=https://aoirail-twilio-production.up.railway.app \
DATA_URL=https://aoirail-data-production.up.railway.app \
PRECHECK_URL=https://aoirail-precheck-production.up.railway.app \
PRECHECK_ADMIN_URL=https://aoirail-precheck-admin-production.up.railway.app \
CONNECT_URL=https://aoirail-connect-production.up.railway.app \
RECRUIT_URL=https://aoirail-recruit-production.up.railway.app \
STATS_URL=https://aoirail-stats-production.up.railway.app \
CAMPAIGN_MANAGER_SERVICE_URL=https://aoirail-campaign-manager-production.up.railway.app \
LEADSYNC_SERVICE_URL=https://aoirail-leadsync-production.up.railway.app \
npm run verify:segmented-services
```

What this verifies:

- `/health` responds on each `SECTION` service (when URL envs are set)
- `CAMPAIGN_MANAGER_SERVICE_URL` responds on `/api/health`; `LEADSYNC_SERVICE_URL` on `/health`
- Twilio route exists on Twilio service (`/incomingcall`, `/api/twilio/token`)
- Twilio route is blocked on non-Twilio service (`CONNECT_URL /api/twilio/token` should be 404)
- `/incomingcall` is blocked on API service (should be 404)
- Data route exists on data service (`DATA_URL /api/masterlead/update-last-contacted` should not be 404)

## 4) Twilio-specific production checks

- In Twilio Console, 609 Voice URL points to Twilio segmented service:
  - `https://<twilio-service-domain>/incomingcall`
- Assignment callback points to Twilio segmented service:
  - `https://<twilio-service-domain>/api/twilio/taskrouter/assignment`
- Run:
  - `npx tsx server/scripts/check-609-voice-url.ts`

## 5) Controlled cutover

- Route internal traffic first.
- Move one domain/path group at a time:
  1. `stats`
  2. `precheck-admin`
  3. `recruit`
  4. `connect`
  5. `twilio` (last)
- After each step, verify logs/latency/errors for 15-30 minutes.

## 6) Rollback plan

- Keep monolith deploy active for immediate rollback.
- If a service fails:
  - repoint traffic/webhooks to monolith endpoint
  - keep segmented deployment up for debugging
- Do not delete monolith until 48-72 hours of stable operation.

