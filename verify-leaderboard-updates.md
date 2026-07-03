# Verify Leaderboard Updates Are Working

## Current Update Mechanism

The leaderboard (`live_call_boardt`) is updated through **multiple layers** to ensure real-time accuracy:

### 1. **Automatic Scheduler** (Primary)
- **File**: `server/live-call-board-stats-scheduler.ts`
- **Frequency**: 
  - Every **30 seconds** via `setInterval`
  - Every **1 minute** via `cron`
- **Function Called**: `update_live_call_boardt_stats_from_metrics()`
- **What it does**:
  - **DIALED**: Counts distinct calls from `twilio_call_logs` (calls with `duration > 0`, skips parent WebRTC calls)
  - **REACHED/BOOKED/INSTANT_PRESENTATION**: Counts from `agent_dial_metrics`

### 2. **Database Triggers** (Real-time)
- **Trigger**: `trigger_update_live_call_boardt_on_metric_insert`
- **Fires**: When a new row is inserted into `agent_dial_metrics`
- **Function Called**: `update_live_call_boardt_stats_for_agent(agent_email)`
- **What it does**: Updates that specific agent's stats immediately

### 3. **Update Trigger** (Real-time)
- **Trigger**: `trigger_update_live_call_boardt_on_metric_update`
- **Fires**: When `agent_dial_metrics` rows are updated (event_type, call_status, disposition changes)
- **Function Called**: `update_live_call_boardt_stats_for_agent(agent_email)`

## How to Verify It's Working

### Check Server Logs
Look for these log messages every 30 seconds:
```
🔄 Updating live call board stats via SQL function...
📊 DIALED: Counting from twilio_call_logs (calls with duration > 0)
📊 REACHED/BOOKED/INSTANT_PRESENTATION: Counting from agent_dial_metrics
✅ Live call board stats updated via SQL function in XXXms
   📊 DIALED: From twilio_call_logs | REACHED/BOOKED/INSTANT_PRESENTATION: From agent_dial_metrics
```

### Manual Trigger (API)
```bash
POST /api/live-call-board/sync-today-stats
```
This manually triggers an update and returns the scheduler status.

### Check Database
```sql
-- Check when stats were last updated
SELECT 
  agent_email,
  today_dialed,
  today_reached,
  today_booked,
  updated_at
FROM live_call_boardt
ORDER BY updated_at DESC
LIMIT 10;

-- Verify dialed counts are coming from twilio_call_logs
SELECT 
  owner_email,
  COUNT(DISTINCT twilio_call_sid) as dialed_calls
FROM twilio_call_logs
WHERE call_started_at >= date_trunc('day', (now() AT TIME ZONE 'America/New_York')::timestamp) AT TIME ZONE 'America/New_York'
  AND call_duration > 0
  AND to_number IS NOT NULL
  AND to_number != ''
GROUP BY owner_email
ORDER BY dialed_calls DESC
LIMIT 10;
```

## Troubleshooting

### If updates aren't happening:

1. **Check if scheduler is running**:
   - Look for startup message: `✅ Live Call Board Stats Scheduler started`
   - Check server logs for update messages every 30 seconds

2. **Check if SQL function exists**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'update_live_call_boardt_stats_from_metrics';
   ```

3. **Check if triggers exist**:
   ```sql
   SELECT trigger_name, event_manipulation
   FROM information_schema.triggers
   WHERE event_object_table = 'agent_dial_metrics'
     AND trigger_name LIKE '%live_call_board%';
   ```

4. **Manually trigger update**:
   ```sql
   SELECT update_live_call_boardt_stats_from_metrics();
   ```

5. **Check for errors in logs**:
   - Look for `❌ Error updating live call board stats`
   - Check for SQL function errors

## Key Points

- **DIALED** now comes from `twilio_call_logs` - only counts calls with actual duration
- **REACHED/BOOKED/INSTANT_PRESENTATION** come from `agent_dial_metrics`
- Updates happen **every 30 seconds** automatically
- **Triggers** provide real-time updates when metrics are inserted/updated
- All updates use **EST timezone** for "today" calculations
