#!/usr/bin/env bash
# Backfill recruit_candidates from vdp_calls_BLASTPICK (aorecruit PICK_UP rows).
# Run from project root. Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY (e.g. in .env or env).
set -e
cd "$(dirname "$0")"
echo "🎯 Running recruit backfill from vdp_calls_BLASTPICK..."
npm run backfill-recruit-from-blastpick -- "$@"
echo "✅ Done."
