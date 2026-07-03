# Recover dev (baa2) to mirror AOIrail

Make **aoirail-production-baa2.up.railway.app** run the same code as this repo.

## Option A: Railway dashboard (no CLI)

1. Open **Railway** → your project that has the **baa2** service (the one at `aoirail-production-baa2.up.railway.app`).
2. Click the **baa2** service.
3. **Source**
   - Ensure it’s connected to the **same GitHub repo** as production (e.g. `aointel/AOIrail` or your fork).
   - Set the branch to the one you use for dev (e.g. `dev` or `master`).
4. **Redeploy**
   - **Deployments** tab → open the latest deployment (e.g. `d2e8537e`) → **Redeploy**,  
   - or **Settings** → **Redeploy** / **Trigger deploy**.
5. That builds and deploys from the current state of that repo/branch, so dev becomes a mirror of AOIrail.

## Option B: Railway CLI (deploy from local)

From the AOIrail repo root:

```bash
npm install -g @railway/cli
railway login
railway link   # pick the project that contains baa2, then the baa2/staging service
railway up --service staging --config railway.staging.json
```

(Use the actual service name in the project if it’s not `staging`.)

## After recovering

- 609 inbound is already pointed at baa2 (`set-609-voice-to-baa2.ts`).
- To point 609 back to production: `npx tsx server/scripts/set-609-voice-incomingcall.ts`.
