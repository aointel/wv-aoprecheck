# Live Call Board Maintenance - How It Works & How to Fix

## How Live Call Board Should Be Maintained

The `live_call_board` table is **supposed to be automatically updated** by:

### 1. **SQL Triggers** (Real-time updates)
- When a new row is inserted into `agent_dial_metrics`, a trigger should automatically call `update_live_call_board_stats_for_agent()` to update that agent's stats
- When an `agent_dial_metrics` row is updated, the trigger recalculates stats

**Expected triggers:**
- `trigger_update_live_call_board_on_metric_insert` (AFTER INSERT)
- `trigger_update_live_call_board_on_metric_update` (AFTER UPDATE)

### 2. **Periodic Cron Job** (Backup sync)
- A Supabase cron job should run `update_live_call_board_stats_from_metrics()` every minute
- This ensures data consistency even if triggers miss something

**Expected cron job:**
```sql
SELECT cron.schedule(
  'sync-live-call-board',
  '* * * * *',  -- Every minute
  $$SELECT update_live_call_board_stats_from_metrics()$$
);
```

### 3. **Manual Sync** (Emergency fix)
- Can be triggered via API: `POST /api/live-call-board/sync-today-stats`
- Or via SQL: `SELECT update_live_call_board_stats_from_metrics();`

## Current Status

✅ **Sync function exists** - `update_live_call_board_stats_from_metrics()` is available

❓ **Triggers status unknown** - Need to check in Supabase Dashboard

❓ **Cron job status unknown** - Need to check in Supabase Dashboard

## How to Fix

### Step 1: Verify Triggers Exist

Go to **Supabase Dashboard > Database > SQL Editor** and run:

```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'agent_dial_metrics'
  AND trigger_name LIKE '%live_call_board%';
```

**If no triggers found:**
Run the SQL file: `update-live-call-board-from-agent-dial-metrics.sql` in Supabase SQL Editor

### Step 2: Verify Cron Job Exists

Go to **Supabase Dashboard > Database > Cron Jobs** (or pg_cron extension)

**If no cron job found:**
Set up a cron job to run every minute:
```sql
SELECT cron.schedule(
  'sync-live-call-board',
  '* * * * *',
  $$SELECT update_live_call_board_stats_from_metrics()$$
);
```

### Step 3: Manual Sync (Immediate Fix)

To fix the data right now, run:

```sql
SELECT update_live_call_board_stats_from_metrics();
```

Or trigger via API:
```bash
curl -X POST https://your-api-url/api/live-call-board/sync-today-stats
```

## Data Flow

```
Agent makes call
    ↓
logCallOutcome() logs to agent_dial_metrics
    ↓
INSERT trigger fires (should update live_call_board)
    ↓
update_live_call_board_stats_for_agent() executes
    ↓
live_call_board.today_dialed/reached/booked updated
    ↓
Frontend reads from live_call_board and displays stats
```

**If triggers aren't working:**
- Stats won't update in real-time
- Only periodic cron job will update them (if it exists)
- Data will be stale until manual sync

## Verification

After fixing, verify it's working:

1. **Check if triggers are firing:**
   - Make a test call
   - Check if `live_call_board` updates immediately
   - If not, triggers aren't working

2. **Check if cron is running:**
   - Wait 1-2 minutes
   - Check `live_call_board.updated_at` timestamps
   - If they're updating every minute, cron is working

3. **Compare data:**
   ```sql
   -- Compare agent_dial_metrics vs live_call_board
   SELECT 
     lcb.agent_email,
     lcb.today_dialed as lcb_dialed,
     (SELECT COUNT(DISTINCT lead_phone) FROM agent_dial_metrics 
      WHERE agent_email = lcb.agent_email 
      AND event_type = 'dial' 
      AND event_timestamp >= date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles'
      AND event_timestamp < date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles' + interval '1 day'
     ) as adm_dialed
   FROM live_call_board lcb
   WHERE lcb.today_dialed > 0
   LIMIT 10;
   ```

Stats should match between `agent_dial_metrics` and `live_call_board`.

