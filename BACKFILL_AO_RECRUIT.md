# AO Recruit backfill

Run these **once** to backfill data so candidates and Taalk summaries show correctly.

## 1. Backfill missing AI summaries (Taalk)

Fills `recruit_candidates.ai_summary` for candidates that have a matching call in `vdp_calls_BLASTPICK` (by phone + sessionid) by calling the Taalk summary API.

```bash
npm run backfill-all-recruit-ai-summaries
```

Optional env:

- `MAX_CANDIDATES=500` – limit how many to process
- `FORCE_REFRESH=true` – re-fetch even if `ai_summary` already set

## 2. Fix agent_email for “unknown-agent-*” candidates (optional)

Candidates created when the poller couldn’t resolve an associate ID have `agent_email` like `unknown-agent-19794@aoglobelife.com`, so they don’t show for the real agent. After associate IDs are in `producerlist` or `agent_hierarchy`, run in Supabase:

See **database/backfill-recruit-agent-email-from-hierarchy.sql** – run that in the SQL editor to set `agent_email` (and optionally `agent_id`) from `producerlist` / `agent_hierarchy` for those rows.

## 3. Verify

- AO Recruit page: candidates load for each agent.
- Pipeline cards show “Taalk AI Summary” when `ai_summary` is set.
- New Taalk webhooks (candidate-style or VDP-style) update `recruit_candidates` and/or create rows via poller.
