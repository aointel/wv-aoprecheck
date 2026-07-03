# Transcript & Summary Data Flow for AOI Precheck Admin

## Overview

The `call_transcript` and `taalk_ai_summary` fields in the AOI Precheck Admin page are populated automatically from the Taalk API. Here's how it works:

## Data Sources

### 1. **Automatic Scheduler** (Running in Background)

**File:** `server/transcript-summary-scheduler.ts`

- **Runs every 15 minutes** automatically
- **Started on server startup** (see `server/index.ts` line 619-623)
- Finds completed verification sessions that:
  - Have status = 'completed'
  - Have a `taalk_call_id` (call was made)
  - Are missing `call_transcript` OR `taalk_ai_summary`
  - Processes up to 100 sessions per run

**How it works:**
1. Queries `verification_sessions` table for sessions missing transcript/summary
2. For each session, fetches from Taalk API:
   - Transcript: `https://api.taalk.ai/api/calls/{taalk_call_id}/transcript?db=michaelmandella`
   - Summary: `https://api.taalk.ai/api/calls/{taalk_call_id}/summary?db=michaelmandella`
3. Updates the database with fetched data
4. Parses summary data into individual fields (compliance, AI results, etc.)

**Logs to look for:**
- `🚀 Starting Transcript/Summary scheduler (every 15 minutes)`
- `🔄 TRANSCRIPT/SUMMARY SCHEDULER: Starting 15-minute check for missing data...`
- `📊 Found X completed sessions missing transcript/summary data`
- `✅ Updated session {session_id} - transcript: true, summary: true`

### 2. **Manual Backfill Script** (For Historical Data)

**File:** `server/backfill-transcripts.cjs`

**Run manually with:**
```bash
node server/backfill-transcripts.cjs
```

**What it does:**
- Fetches ALL completed sessions with `taalk_call_id`
- Processes all of them (no date limit)
- Shows progress for each session
- Useful for backfilling historical data

### 3. **Manual API Trigger** (For On-Demand Sync)

**Endpoint:** `POST /api/aoi-precheck/trigger-transcript-sync`

**Usage:**
```bash
curl -X POST http://your-server/api/aoi-precheck/trigger-transcript-sync
```

This triggers the scheduler function immediately without waiting for the 15-minute interval.

## What Data Gets Fetched

### Call Transcript
- Full text transcript of the verification call
- Stored in `call_transcript` field

### Taalk AI Summary
- AI-generated summary array from Taalk
- Stored in `taalk_ai_summary` field (JSON array)
- Also parsed into individual fields:
  - `ai_quick_recap`
  - `ai_next_steps`
  - `ai_key_topics`
  - `ai_sentiment_score`
  - `ai_result`
  - `ai_result_passed`
  - Compliance fields (contact_verified, premium_ok, medical_asked, etc.)

## Requirements for Data to be Fetched

1. Session must have `status = 'completed'`
2. Session must have a `taalk_call_id` (this is set when the call is initiated)
3. Session is missing `call_transcript` OR `taalk_ai_summary`

## Checking if Scheduler is Running

Look for these log messages in your server logs:
```
✅ Transcript/Summary scheduler started - fetches missing data every 15 minutes
```

If you don't see this, the scheduler may not have started. Check `server/index.ts` around line 619-623.

## Troubleshooting

### If data is not being populated:

1. **Check if scheduler started:**
   - Look for startup logs
   - Check server logs for scheduler messages

2. **Check if sessions have taalk_call_id:**
   ```sql
   SELECT COUNT(*) FROM verification_sessions 
   WHERE status = 'completed' 
   AND taalk_call_id IS NOT NULL;
   ```

3. **Check which sessions are missing data:**
   ```sql
   SELECT session_id, taalk_call_id, 
          call_transcript IS NULL as missing_transcript,
          taalk_ai_summary IS NULL as missing_summary
   FROM verification_sessions
   WHERE status = 'completed'
   AND taalk_call_id IS NOT NULL
   AND (call_transcript IS NULL OR taalk_ai_summary IS NULL);
   ```

4. **Manually trigger sync:**
   - Use the API endpoint or run the backfill script

5. **Check Taalk API availability:**
   - The scheduler uses Taalk API key (hardcoded in the scheduler)
   - API endpoints must be accessible from your server

## Manual Backfill Process

To backfill historical data:

1. **Run the backfill script:**
   ```bash
   node server/backfill-transcripts.cjs
   ```

2. **Monitor progress:**
   - Script shows progress for each session
   - Shows success/skip/error counts at the end

3. **Check results:**
   - Script will show summary at the end
   - Check database for updated records

## Files Involved

- `server/transcript-summary-scheduler.ts` - Automatic scheduler
- `server/backfill-transcripts.cjs` - Manual backfill script
- `server/index.ts` - Starts scheduler on server startup
- `server/routes.ts` - Manual trigger endpoint

## Notes

- The scheduler processes up to 100 sessions per 15-minute interval
- There's a 500ms delay between sessions to avoid rate limiting
- Data is fetched directly from Taalk API, not from webhooks
- The scheduler only processes sessions that are missing data (won't overwrite existing data)

