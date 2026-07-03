# Live Call Board Auto-Update Setup

## ✅ Solution Implemented

Created an automated scheduler that keeps live call board stats up-to-date:

### 1. **Scheduler Service** (`server/live-call-board-stats-scheduler.ts`)
- Runs **every 3 minutes** automatically
- Updates all agents' stats from `agent_dial_metrics`
- Handles PST date calculation correctly
- Prevents duplicate runs (skips if previous run still in progress)
- Preserves required fields in `live_call_board` table

### 2. **Auto-Start on Server**
- Scheduler starts automatically when server starts
- Runs immediately on startup, then every 2 minutes
- Integrated into `server/index.ts` with other background services

### 3. **Manual Trigger API**
- `POST /api/live-call-board/sync-today-stats` - Manually trigger update
- Now uses scheduler's `triggerUpdate()` method (cleaner than running script)

## How It Works

```
Server Startup
    ↓
Scheduler Starts
    ↓
Runs Immediately (first update)
    ↓
Every 3 Minutes:
    - Fetch today's metrics (PST date range)
    - Calculate dials/reaches/booked per agent
    - Update live_call_board table
    - Log results
```

## Features

✅ **Automatic** - No manual intervention needed  
✅ **Frequent Updates** - Every 3 minutes keeps data fresh (good balance)  
✅ **Safe** - Prevents concurrent runs  
✅ **Reliable** - Uses same logic as the script  
✅ **Correct Dates** - Properly handles PST timezone  
✅ **Fallback** - Counts `disposition='booked'` if `event_type='booked'` missing  

## Monitoring

Check scheduler status:
- Look for log messages: `✅ Live call board stats updated: X agents in Yms`
- Check `lastRunTime` via API response
- Errors will be logged: `❌ Error updating live call board stats`

## Configuration

To change update frequency, edit `server/live-call-board-stats-scheduler.ts`:

```typescript
// Current: every 3 minutes (recommended balance)
this.cronJob = cron.schedule('*/3 * * * *', async () => {
  // ...
});

// Options & Trade-offs:
// '*/1 * * * *'  = every 1 minute (very fresh, but high DB load)
// '*/2 * * * *'  = every 2 minutes (very fresh, moderate load)
// '*/3 * * * *'  = every 3 minutes (RECOMMENDED - good balance)
// '*/5 * * * *'  = every 5 minutes (reasonable, lower load)
// '*/10 * * * *' = every 10 minutes (less frequent, might feel stale)
```

**Recommendation:** 3 minutes is a good balance:
- Fresh enough to feel "live" (max 3 min delay)
- Not so frequent it causes unnecessary database load
- Reasonable for a "live call board" use case

## Manual Update

If you need to trigger an update manually:

```bash
# Via API
curl -X POST http://localhost:3000/api/live-call-board/sync-today-stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or run script directly
node update-live-call-board-stats.cjs
```

## Status

✅ **Active** - Scheduler runs automatically  
✅ **Tested** - Verified working with correct date calculation  
✅ **Production Ready** - Integrated into server startup  

The live call board will now stay up-to-date automatically! 🎉

