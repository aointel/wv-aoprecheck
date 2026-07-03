# /dashboard/connect — What You Need for It to Work

## 1. Auth (required)
- User must be signed in (Supabase session or app session).
- Session cookie must be sent with requests (`credentials: 'include'` is set in the app).
- If cookies are blocked (e.g. third‑party, incognito, or wrong domain), the app also sends `x-user-email` and `?email=` so the server can identify the user.

## 2. Server (production)
- **SECTION**: Either leave **unset** (monolith = all routes allowed) or set `SECTION=connect` so the connect allowlist is used. Other sections will 404 routes the Connect page needs.
- **Segmented Connect + Data**: With `SECTION=connect`, **masterlead** and **outbound-dialer lead list / lead-by-phone / inbound-picked-up** are **not** on the Connect host; the browser must call **`aoirail-data`** (`SECTION=data`). Set **`VITE_DATA_SERVICE_URL`** at **Connect build** time, or use hostname `aoirail-connect-<env>.up.railway.app` so the client infers `aoirail-data-<env>`. See `apps/connect/README.md` and `client/.env.segmented.example`.
- **Twilio** (for WebRTC / token): `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID` in env or `server/hardcoded-config.ts`.
- **Supabase**: For credits, customers, etc. Configured in `hardcoded-config.ts` or env.

## 3. APIs the Connect page uses (must return 200, not 401/404)
- `GET /api/user/credits` — credits (we send `credentials`, `x-user-email`, and `?email=`).
- `POST /api/vdp/heartbeat`, `POST /api/vdp/routing`, `POST /api/vdp/status` — VDP.
- `POST /api/usage/vdp-available-start`, `POST /api/usage/vdp-available-end` — usage (both exist on server).
- `GET /api/twilio/token` — WebRTC token (browser sends `x-user-email`; server needs session or that header).
- `POST /api/agents/voice-online`, `POST /api/agents/voice-offline` — when toggling Online.

If any of these return **401**: auth not reaching the server (cookies or send `x-user-email` + `?email=` where supported).  
If any return **404**: path not registered or blocked by SECTION allowlist (segmented: lead/masterlead paths should hit the **data** service URL, not Connect).

## 4. WebRTC (Power On / Online)
- **Token**: Server returns 200 and a JWT; we verified `/api/twilio/token` works with `x-user-email`.
- **Registration**: The Twilio Device must open a **WebSocket (wss://)** to Twilio. If that fails (e.g. “WebSocket is closed before the connection is established” or “Registration attempt timed out”), the cause is **network**: firewall, VPN, or proxy blocking `wss://` to Twilio. Fix: try another network, turn off VPN, or allow Twilio’s signaling domain.

## 5. Quick checklist
- [ ] Logged in (session or Supabase).
- [ ] Production deploy is latest (includes credits + email and vdp-available-end fixes).
- [ ] No `SECTION` or `SECTION=connect` with connect allowlist in use.
- [ ] Twilio env/hardcoded config set.
- [ ] For WebRTC: network allows WebSocket to Twilio (no blocking firewall/VPN).
