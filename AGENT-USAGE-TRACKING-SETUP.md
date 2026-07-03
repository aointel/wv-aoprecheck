# Agent Usage Tracking Setup

## Overview
This system tracks how long agents spend in "available" (ready) or "on a call" (in_call) status.

## Database Schema

### Table: `live_call_boardt`
Added columns:
- `total_available_seconds` - Total seconds agent spent in "ready" status today
- `total_on_call_seconds` - Total seconds agent spent in "in_call" status today
- `last_status_change_at` - Timestamp of last status change
- `current_status_started_at` - Timestamp when current status started

## SQL Functions

### `update_agent_usage_status(p_agent_email, p_new_status)`
- Updates agent status and accumulates time spent in previous status
- Called automatically when status changes
- Tracks: 'ready' → available time, 'in_call' → on-call time

### `get_agent_usage_summary(p_agent_email, p_date)`
- Returns daily usage summary with formatted time (HH:MM:SS)

## How It Works

### 1. Agent Goes Online
- Frontend calls `/api/agent/online`
- Backend updates `agent_live_call_status` to 'ready'
- Backend calls `update_agent_usage_status('ready')` to start tracking

### 2. Call Connects
- Frontend detects `connection.on('accept')` event
- Frontend calls `/agent/presence` with status 'in_call'
- Backend updates `agent_live_call_status` to 'in_call'
- Backend calls `update_agent_usage_status('in_call')` which:
  - Calculates time spent in 'ready' status
  - Adds to `total_available_seconds`
  - Updates status to 'in_call'

### 3. Call Disconnects
- Frontend detects `connection.on('disconnect')` event
- Frontend calls `/agent/presence` with status 'ready'
- Backend updates `agent_live_call_status` to 'ready'
- Backend calls `update_agent_usage_status('ready')` which:
  - Calculates time spent in 'in_call' status
  - Adds to `total_on_call_seconds`
  - Updates status to 'ready'

### 4. Heartbeat
- Frontend sends heartbeat every 60 seconds
- Backend calls `update_agent_usage_status('ready')` to ensure tracking continues

## Setup Steps

1. **Run SQL migration:**
   ```sql
   -- Run add-agent-usage-tracking.sql
   ```

2. **Deploy code changes:**
   - Backend endpoints now call `update_agent_usage_status()` automatically
   - Frontend now calls `/agent/presence` when calls connect/disconnect

3. **Verify tracking:**
   ```sql
   SELECT * FROM get_agent_usage_summary();
   ```

## Query Usage Data

```sql
-- Get all agents' usage for today
SELECT * FROM get_agent_usage_summary();

-- Get specific agent's usage
SELECT * FROM get_agent_usage_summary('agent@example.com');

-- Manual query
SELECT 
  agent_email,
  status,
  total_available_seconds,
  total_on_call_seconds,
  TO_CHAR(INTERVAL '1 second' * total_available_seconds, 'HH24:MI:SS') as available_time,
  TO_CHAR(INTERVAL '1 second' * total_on_call_seconds, 'HH24:MI:SS') as on_call_time
FROM live_call_boardt
WHERE agent_email IS NOT NULL
ORDER BY total_available_seconds DESC;
```

## Notes

- Time is accumulated only when status **changes** (not on every heartbeat)
- If status doesn't change, no time is added (prevents double-counting)
- Time is tracked in seconds, displayed as HH:MM:SS
- Tracking resets daily (new day = new tracking record)
