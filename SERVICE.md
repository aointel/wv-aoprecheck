# aoprecheck

Standalone **AO Precheck** verification service — split from Connect (`SECTION=connect`) using the same pattern as `aorecruit`.

Runs the monolith with **`SECTION=precheck`** so only verification / precheck routes are exposed (see `server/section-paths.ts`).

## What this service owns

- **Agent UI:** `/dashboard/verification-start` (`AOPrecheck.tsx` + `verification-workflow.tsx`)
- **Public verify links:** `/agent-verify/:sessionId`, `/client-verify/:sessionId`
- **APIs:** `/api/verification/*`, `/api/aoi-precheck/agent/*`, Taalk webhooks for conference/zoom verification
- **Auth:** existing Connect Now `/api/auth/*` (same Supabase users)

Precheck **admin** (session review, recordings, stats) stays on **`aoirail-precheck-admin`** (`SECTION=precheck-admin`) unless you merge later.

## Railway

- Project: **worthy-victory** / **production**
- Service name: **aoprecheck** (create in Railway dashboard)
- **Root directory:** `apps/aoprecheck`
- **Start:** `npx cross-env SECTION=precheck node dist/index.js`

### Deploy

```powershell
cd c:\dev\worthy-victory\aoprecheck
$env:RAILWAY_TOKEN = "<worthy-victory project token>"
railway up --service aoprecheck
```

Set in Railway → Service → Settings → Root Directory = `apps/aoprecheck`.

## Required env vars

| Variable | Purpose |
|----------|---------|
| `SECTION` | `precheck` (set by start command) |
| `VERIFICATION_BASE_URL` | This service's public URL — used in SMS links to `/agent-verify` and `/client-verify` |
| `APP_URL` / `RAILWAY_PUBLIC_DOMAIN` | Base URL fallback |
| Supabase, Twilio, OpenAI | Same as Connect (`server/hardcoded-config.ts` + Railway secrets) |

Optional: `AOIRAIL_DATA_SERVICE_URL` if any client paths still hit the data service.

## Source

Cloned from `aoirail-connect` (Connect monolith). New wiring:

- `server/routes-aoprecheck.ts` — verification landing redirects + service health
- `apps/aoprecheck/` — Railway app root (mirrors `aorecruit/apps/aorecruit`)
