# Backfill recruit_candidates from vdp_calls_BLASTPICK

## Why didn’t my BLASTPICK row create a candidate?

**The recruit VDP poller was turned off.** In `server/index.ts`, `startBackground()` was commented out, so nothing was reading `vdp_calls_BLASTPICK` and creating rows in `recruit_candidates`. The webhook/Taalk correctly writes PICK_UP rows to BLASTPICK; the only thing that creates candidates is either:

1. **The recruit VDP poller** (when `startBackground()` is running), or  
2. **The backfill script** (run manually).

So any BLASTPICK row that landed while the poller was off will never become a candidate until you run the backfill (or insert that row manually).

Data is in **vdp_calls_BLASTPICK** (Taalk/webhook writes there) but **recruit_candidates** was not being created. This backfill creates/updates `recruit_candidates` from every aorecruit PICK_UP row in `vdp_calls_BLASTPICK`.

## Run the backfill (do this now)

From the project root, with Supabase env vars set (e.g. in `.env` or your shell):

```bash
npm run backfill-recruit-from-blastpick
```

Or use the shell script:

```bash
./run-backfill-recruit-now.sh
```

- **Default:** up to 2000 aorecruit PICK_UP rows, with Taalk AI summaries fetched where possible.
- **Faster (no Taalk API):**  
  `npm run backfill-recruit-from-blastpick -- --no-summaries`
- **Limit rows (e.g. test with 20):**  
  `npm run backfill-recruit-from-blastpick -- --limit 20`

## What the script does

1. Reads `vdp_calls_BLASTPICK` where `market` ilike `%aorecruit%` and `event = 'PICK_UP'`.
2. For each row: resolves agent email (producerlist → agent_hierarchy → agent_profiles → customers).
3. If a candidate already exists for that phone: updates `agent_email`/`agent_id` and optionally fetches AI summary.
4. If no candidate: inserts a new row into `recruit_candidates` (and optionally fetches Taalk AI summary).

## Insert one missing candidate (e.g. Jacqueline Sexton)

If you have a specific BLASTPICK row that never became a candidate, you can insert it once with SQL:

- **`database/insert-missing-recruit-candidate-from-blastpick.sql`** – example for the 2026-03-12 Jacqueline Sexton row (id 184926, phone +18065665206, agent 12356789). Run in Supabase SQL editor. Edit first/last name, phone, agent id, and timestamps if you need a different row.

## After backfill

- Re-enable the recruit VDP poller in production (e.g. ensure `startBackground()` is called in `server/index.ts`) so new BLASTPICK rows create candidates going forward.
- AO Recruit page reads from `recruit_candidates`; after this backfill and a deploy, candidates should appear.
