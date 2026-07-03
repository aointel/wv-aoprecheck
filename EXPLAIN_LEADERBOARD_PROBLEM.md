# LEADERBOARD UPDATE PROBLEM - EXPLAINED

## THE PROBLEM

**DIALED stats are NOT updating automatically** because:
- ✅ Triggers exist on `agent_dial_metrics` → REACHED/BOOKED update automatically
- ❌ NO triggers exist on `twilio_call_logs` → DIALED does NOT update automatically

## WHAT'S HAPPENING

1. **REACHED/BOOKED**: When agents log events in `agent_dial_metrics`, triggers fire and update `live_call_boardt` ✅
2. **DIALED**: When calls are logged in `twilio_call_logs`, NOTHING happens. The board stays stale ❌

## THE FIX

The SQL function `update_live_call_boardt_stats_from_metrics()` recalculates ALL stats from source tables, but it only runs:
- When manually executed
- When triggers fire (only for agent_dial_metrics, not twilio_call_logs)

## SOLUTION OPTIONS

### Option 1: Run SQL Function Periodically (RECOMMENDED)
Set up a cron job or scheduled task to run:
```sql
SELECT update_live_call_boardt_stats_from_metrics();
```
Every 1-5 minutes.

### Option 2: Add Triggers to twilio_call_logs
Create triggers on `twilio_call_logs` to update the board when new calls are logged.

### Option 3: Call Function from API
When new calls are logged via API, call the update function.

## IMMEDIATE FIX

Run this to fix current data:
```bash
node fix-all-stats-direct-update.mjs
```

Or run the SQL function:
```sql
SELECT update_live_call_boardt_stats_from_metrics();
```

## WHY THIS IS HAPPENING

The triggers were set up for `agent_dial_metrics` (reached/booked) but NOT for `twilio_call_logs` (dialed). This is why:
- REACHED/BOOKED: Always accurate (triggers work)
- DIALED: Stale until function runs manually
