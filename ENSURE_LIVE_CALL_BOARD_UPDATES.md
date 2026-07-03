# Ensure Live Call Board Keeps Updating

## Current Update Mechanisms

The live call board (`live_call_boardt`) is updated through **multiple layers** to ensure it stays current:

### 1. **Database Triggers** (Real-time) ✅
- **Trigger**: `trigger_update_live_call_boardt_on_metric_insert`
  - Fires: When a new row is inserted into `agent_dial_metrics`
  - Function: `update_live_call_boardt_stats_for_agent(agent_email)`
  - Updates: That specific agent's stats immediately

- **Trigger**: `trigger_update_live_call_boardt_on_metric_update`
  - Fires: When `agent_dial_metrics` rows are updated (event_type, call_status, disposition changes)
  - Function: `update_live_call_boardt_stats_for_agent(agent_email)`
  - Updates: That specific agent's stats when metrics change

**Status**: These triggers are created automatically when you run `update-live-call-board-from-agent-dial-metrics.sql`

### 2. **Node.js Scheduler** (Primary - every 30 seconds) ✅
- **File**: `server/live-call-board-stats-scheduler.ts`
- **Frequency**: 
  - Every **30 seconds** via `setInterval`
  - Every **1 minute** via `cron`
- **Function Called**: `update_live_call_boardt_stats_from_metrics()`
- **Auto-start**: Starts automatically when server starts (see `server/index.ts` line 787-790)

**Status**: This is the **primary** update mechanism and runs automatically when the server is running.

### 3. **Database Cron Job** (Backup - every 1 minute) ⚠️ Optional
- **Setup**: Run `setup-live-call-board-auto-update.sql` in Supabase SQL Editor
- **Requires**: `pg_cron` extension enabled in Supabase
- **Frequency**: Every 1 minute
- **Function Called**: `update_live_call_boardt_stats_from_metrics()`
- **Purpose**: Backup if Node.js scheduler fails or server is down

**Status**: This is **optional** but recommended as a backup layer.

## How to Ensure It Keeps Updating

### Step 1: Verify Triggers Are Active
Run in Supabase SQL Editor:
```sql
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'agent_dial_metrics'
  AND trigger_name LIKE '%live_call_board%';
```

**Expected**: Should see 2 triggers (INSERT and UPDATE)

### Step 2: Verify Node.js Scheduler Is Running
Check server logs for:
```
✅ Live Call Board Stats Scheduler started
   📊 Update frequency: Every 30 seconds (setInterval) + Every 1 minute (cron)
```

Look for update messages every 30 seconds:
```
🔄 Updating live call board stats via SQL function...
✅ Live call board stats updated via SQL function in XXXms
```

### Step 3: Set Up Database Cron Job (Optional Backup)
Run in Supabase SQL Editor:
```sql
-- Run the setup script
\i setup-live-call-board-auto-update.sql
```

Or manually:
```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule backup cron job
SELECT cron.unschedule('update-live-call-boardt-stats-backup');
SELECT cron.schedule(
  'update-live-call-boardt-stats-backup',
  '* * * * *',  -- Every 1 minute
  $$SELECT update_live_call_boardt_stats_from_metrics();$$
);
```

### Step 4: Verify Everything Is Working
Run in Supabase SQL Editor:
```sql
-- Check when stats were last updated
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  today_instant_presentation,
  updated_at,
  NOW() - updated_at as time_since_update
FROM live_call_boardt
ORDER BY updated_at DESC
LIMIT 10;
```

**Expected**: `time_since_update` should be less than 1-2 minutes for active agents.

## Troubleshooting

### If updates stop working:

1. **Check Node.js scheduler**:
   - Verify server is running
   - Check server logs for scheduler messages
   - Restart server if needed

2. **Check database triggers**:
   ```sql
   SELECT * FROM information_schema.triggers 
   WHERE event_object_table = 'agent_dial_metrics';
   ```
   - If missing, re-run `update-live-call-board-from-agent-dial-metrics.sql`

3. **Check database cron job** (if enabled):
   ```sql
   SELECT * FROM cron.job 
   WHERE jobname = 'update-live-call-boardt-stats-backup';
   ```
   - Verify `active = true`

4. **Manually trigger update**:
   ```sql
   SELECT update_live_call_boardt_stats_from_metrics();
   ```

5. **Check for errors**:
   - Look for `❌ Error updating live call board stats` in server logs
   - Check Supabase logs for SQL function errors

## Data Sources Summary

- **DIALED**: `twilio_call_logs` (calls with `duration > 0`)
- **REACHED**: `twilio_call_logs` (calls with `duration >= 50s`, `status = 'answered'/'completed'`)
- **INSTANT_PRESENTATION**: `masterlead` (where `cnresolution = 'instant_presentation'`)
- **BOOKED**: `agent_dial_metrics` ONLY (where `event_type = 'booked'` OR `disposition = 'booked'`, `duration > 240s`)

## Key Points

✅ **Triggers provide real-time updates** when metrics are inserted/updated  
✅ **Node.js scheduler runs every 30 seconds** (primary mechanism)  
✅ **Database cron job can run every 1 minute** (backup if Node.js fails)  
✅ **All updates use EST timezone** for "today" calculations  
✅ **Multiple layers ensure reliability** - if one fails, others continue
