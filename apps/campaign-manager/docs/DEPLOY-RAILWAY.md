# Railway deploy — why it breaks & what we did

## Why it feels broken

1. **502** = Railway’s proxy could not get a valid HTTP response from your app. Almost always: **the Node process crashed** or **never listened on `PORT`**.
2. **Nixpacks** guesses install/build/start from your repo. Different Node versions, `NODE_ENV=production` skipping devDependencies, or a **custom Start Command** in the Railway UI can silently fight your `package.json`.
3. **`NODE_ENV=production tsx …`** only works in a POSIX shell. It’s easy for tooling to run scripts in a way where that pattern flakes.

## What this repo uses now

- **`Dockerfile`** — Railway builds a **known** image: `npm ci --include=dev` → `npm run build` (Vite) → run **`tsx server/index.ts`**.
- **`railway.json`** — `builder: DOCKERFILE` so behavior matches the file, not a guess.
- **`package.json` `start`** — `npx tsx server/index.ts` (no `VAR=value` prefix) for local runs.

## Checklist in Railway (do this once)

| Setting | Use |
|--------|-----|
| **Root directory** | Repo root (folder with `Dockerfile` + `package.json`). |
| **Build** | Default (Dockerfile). |
| **Start command** | Empty **or** `./node_modules/.bin/tsx server/index.ts` — don’t leave an old `node server.js` or wrong path. |
| **Health check** (if any) | `/api/health` or disable until stable. |

## What to read in logs

**Build log** must show:

- `npm ci` / install finishing
- `vite build` and **`dist/index.html`**

**Deploy / runtime log** must show:

- `Campaign Manager running on port …` (that number should match Railway’s **`PORT`**, often `8080`)

If the process exits before that line, scroll up for the **first stack trace** — that’s the real error (import crash, missing file, etc.).

## Quick tests

- `https://YOUR-APP.up.railway.app/api/health` → should return JSON `{ ok: true, ... }`.
- If that works but `/` doesn’t → client build/`dist` problem (see build log).
