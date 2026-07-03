# AOIrail Connect (segmented)

Railway service **`aoirail-connect`**: root directory **`apps/connect`**. Start runs the repo root server with **`SECTION=connect`**.

## Lead / masterlead traffic goes to the data service

The Connect UI must call **`aoirail-data`** for hot tables and masterlead-backed APIs. The client does that via:

1. **`VITE_DATA_SERVICE_URL`** — set at **build time** on this Railway service (Vite bakes it into the bundle).  
   Example: `https://aoirail-data-production.up.railway.app`
2. **Hostname inference** — if the app is opened at `https://aoirail-connect-<env>.up.railway.app` and `VITE_DATA_SERVICE_URL` is unset, the client still rewrites data prefixes to `https://aoirail-data-<env>.up.railway.app`.

`SECTION=connect` **does not** allow `/api/masterlead` or `/api/outbound-dialer/leads` (etc.) on the Connect host so misrouted requests fail fast; they must hit **`SECTION=data`**.

## Railway checklist (Connect + Data)

| Variable | Service | When |
|----------|---------|------|
| `VITE_DATA_SERVICE_URL` | **connect** | **Build** — optional; overrides other sources when baked into the bundle |
| `AOIRAIL_DATA_SERVICE_URL` or `DATA_SERVICE_URL` | **connect** | **Runtime** — preferred when set; Connect injects `window.__AOIRAIL_DATA_SERVICE_URL__` into `index.html` so lead/masterlead requests hit data **without** a client rebuild |
| (none of the above) | **connect** | If `RAILWAY_PUBLIC_DOMAIN` matches `aoirail-connect-<env>.up.railway.app`, the server infers `https://aoirail-data-<env>.up.railway.app` and injects that |
| `VITE_TWILIO_SERVICE_URL` | **connect** | **Build** — optional; same pattern for Twilio paths |
| `DATABASE_URL`, Supabase, auth | **connect** & **data** | Same as your monolith unless you split DB later |
| `SECTION=connect` | connect | Start command (already in `package.json`) |
| `SECTION=data` | data | Start command for `aoirail-data` |

## Local segmented smoke

From repo root, copy `client/.env.segmented.example` to `client/.env.local`, set `VITE_DATA_SERVICE_URL` to your local or Railway data URL, run API + client dev, and load Connect. Confirm in DevTools **Network** that `/api/masterlead` and `/api/outbound-dialer/leads` requests go to the **data** origin.
