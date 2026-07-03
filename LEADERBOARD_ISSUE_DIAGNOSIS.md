# Leaderboard Issue Diagnosis

## Problem Identified

The leaderboard API endpoint (`/api/leaderboard`) is querying a table called `live_call_boardt` (with a 't' at the end), but this table **does not exist** in the database.

## Root Cause

1. **API Code** (`server/routes.ts` line 39789): Queries `live_call_boardt`
2. **Cron Job** (`setup-auto-update-live-call-boardt-cron-simple.sql`): Tries to INSERT INTO `live_call_boardt`
3. **Missing Table**: There's no CREATE TABLE statement for `live_call_boardt` - only for `live_call_board` (without the 't')

## Current State

- ✅ `live_call_board` table exists (created by `create-live-call-board-table.sql`)
- ❌ `live_call_boardt` table does NOT exist
- ⚠️  API fails silently and returns empty leaderboard array
- ⚠️  Cron job would fail if it tries to run (table doesn't exist)

## Solution

### Option 1: Create the `live_call_boardt` table (Recommended)

Run the SQL script `create-live-call-boardt-table.sql` to create the table. This table is specifically designed for stats aggregation and is simpler than `live_call_board` (no JSONB fields, no status tracking, just stats).

**Why this approach?**
- The codebase consistently uses `live_call_boardt` throughout
- There's a dedicated cron job for updating `live_call_boardt`
- Keeps stats separate from live status tracking

### Option 2: Change API to use `live_call_board` (Alternative)

If `live_call_boardt` was a typo, you could change all references from `live_call_boardt` to `live_call_board`. However, this would require:
- Updating ~59 references in `server/routes.ts`
- Updating cron job scripts
- Ensuring `live_call_board` has all required columns

## Files Created

1. **`create-live-call-boardt-table.sql`** - SQL script to create the missing table
2. **`diagnose-leaderboard-issue.cjs`** - Diagnostic script to check both tables (requires Node.js)

## Next Steps

1. **Run the SQL script** to create `live_call_boardt`:
   ```sql
   -- Execute: create-live-call-boardt-table.sql
   ```

2. **Verify the cron job** is set up and running:
   ```sql
   -- Check if cron job exists
   SELECT * FROM cron.job WHERE jobname = 'update-live-call-boardt-stats-auto';
   ```

3. **Test the leaderboard API**:
   ```bash
   curl https://your-domain.com/api/leaderboard
   ```

4. **Monitor logs** to ensure:
   - Cron job runs successfully every 2 minutes
   - API returns data instead of empty array
   - Stats are being calculated correctly

## Table Structure Comparison

### `live_call_board` (exists)
- Full table with status tracking, JSONB fields, time tracking
- Used for Live Call Board display
- More complex schema

### `live_call_boardt` (needs to be created)
- Simplified table focused on stats only
- Used for leaderboard calculations
- Minimal schema: agent_email, agent_name, status, today_* stats, updated_at

## Error Handling

The API currently catches errors and returns an empty array:
```typescript
catch (error) {
  console.error('❌ Error fetching leaderboard:', error);
  res.json({
    success: true,
    leaderboard: [],
    lastUpdated: new Date().toISOString(),
    error: 'Leaderboard temporarily unavailable'
  });
}
```

This means the UI doesn't break, but the leaderboard appears empty. Once the table is created, this should resolve.

