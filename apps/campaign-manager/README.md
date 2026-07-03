# Trustworthy Youths campaign manager (TaalkCenterTracker)

Standalone Express + Vite app (agent health, commands, WebRTC presence). AOIrail proxies diagnostics to it via `CAMPAIGN_MANAGER_URL` / `AOI_COMMAND_URL` (see `server/external-service-urls.ts`).

**Railway:** Service name `aoirail-campaign-manager` (see `npm run railway:setup-services`). Root directory `apps/campaign-manager`. **Do not set `SECTION`.** Build: `npm ci --include=dev && npm run build` (Vite/`tsx` are devDependencies). Start: `npm start`. Set env vars (Taalk tokens, DB) per your deploy.

Source history: copied from `AOIrail-push-master/TaalkCenterTracker`.
