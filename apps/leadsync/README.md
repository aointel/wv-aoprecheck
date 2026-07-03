# Leadsync (Zoho / Airtable / Taalk tooling)

Node scripts for Zoho voice users, Airtable exports, and Taalk campaign2s contacts (`fullsync.js`, `sendLeads.js`, etc.).

Railway: service name **`aoirail-leadsync`**. Root **`apps/leadsync`**. **Do not set `SECTION`.** Default `npm start` runs `server/service.cjs` (GET `/health`). One-off or cron: `npm run sync:full` → `fullsync.js`.

Large `finalarchives` CSV trees were not copied from AOIrail-push-master/leadsync.

---

## Masterlead / `aoirail-data` (read this)

**In this repo, `apps/leadsync` does not query or update the Supabase/Postgres `masterlead` table.** Sync flows talk to **Taalk**, **Zoho**, **Google Drive**, **Zapier**, etc. There is no `masterlead` string in the worker `.js` sources here.

If you add jobs that **HTTP** into AOIrail to refresh or patch masterlead (or outbound dialer cache routes), those requests must go to the **segmented data service**, same as the Connect browser:

| Consumer | Env |
|----------|-----|
| Connect (browser) | `VITE_DATA_SERVICE_URL` (build-time) or hostname inference — see `client/src/lib/service-routing.ts` |
| Leadsync / cron / other workers | `AOIRAIL_DATA_SERVICE_URL` or `DATA_SERVICE_URL` — see `lib/data-service-url.cjs` |

Never use the **Connect** origin for server-side masterlead refresh; **`SECTION=connect`** does not allow `/api/masterlead` or `/api/outbound-dialer/leads` on purpose.

---

## Not the same as `LEAD_SYNC_URL`

**`LEAD_SYNC_URL`** (see `server/external-service-urls.ts`) is the **CCPro assignment-trigger** API (`POST /api/ccpro/assignment-trigger`). That is often a **different** Railway app (historically `aointelleadsync-production`). Only point `LEAD_SYNC_URL` at **`aoirail-leadsync`** if this package actually implements that route (today it does not).

---

## Server monorepo helper

TypeScript callers in `server/` can use `getAoirailDataServiceBaseUrl()` from `server/external-service-urls.ts` (same env names as above).
