# Unified Agent Status Tracking

## Overview
This system tracks agent status across **ALL products** using a unified status system:
- **`active`** - Agent is online and available (not on a call)
- **`idle`** - Agent is logged in but inactive
- **`connected`** - Agent is on a call

## Unified Status Mapping

### From Product-Specific Statuses to Unified Status:

| Product | Product Status | Unified Status |
|---------|---------------|----------------|
| Call Connector Pro | `ready` | `active` |
| Call Connector Pro | `in_call` | `connected` |
| Call Connector Pro | `wrap_up` | `active` |
| Call Connector Pro | `offline` | `idle` |
| VDP | `online` | `active` |
| VDP | `calling` | `connected` |
| VDP | `offline` | `idle` |
| AO Intel | `ready` | `active` |
| AO Intel | `in_call` | `connected` |
| ConnectNow | `active` | `active` |
| ConnectNow | `idle` | `idle` |
| ConnectNow | `on_call` | `connected` |

## Database Schema

### Table: `live_call_boardt`
- `status` - Unified status: `active`, `idle`, or `connected`
- `total_available_seconds` - Total seconds in `active` status today
- `total_on_call_seconds` - Total seconds in `connected` status today
- `last_status_change_at` - Timestamp of last status change
- `current_status_started_at` - Timestamp when current status started

## SQL Functions

### `update_agent_usage_status(p_agent_email, p_new_status)`
- Updates agent status and accumulates time spent in previous status
- Accepts unified status: `active`, `idle`, or `connected`
- Called automatically when status changes

## How It Works

### 1. Agent Goes Online (Any Product)
- Frontend calls product-specific endpoint (e.g., `/api/agent/online`, `/agent/presence`)
- Backend maps product status to unified status: `ready` → `active`
- Backend calls `update_agent_usage_status('active')` to start tracking

### 2. Call Connects (Any Product)
- Frontend detects call connect event
- Frontend calls product-specific endpoint with status `in_call`
- Backend maps status to unified status: `in_call` → `connected`
- Backend calls `update_agent_usage_status('connected')` which:
  - Calculates time spent in `active` status
  - Adds to `total_available_seconds`
  - Updates status to `connected`

### 3. Call Disconnects (Any Product)
- Frontend detects call disconnect event
- Frontend calls product-specific endpoint with status `ready`
- Backend maps status to unified status: `ready` → `active`
- Backend calls `update_agent_usage_status('active')` which:
  - Calculates time spent in `connected` status
  - Adds to `total_on_call_seconds`
  - Updates status to `active`

### 4. Agent Goes Idle (Any Product)
- Frontend detects inactivity or agent logs out
- Frontend calls product-specific endpoint with status `offline` or `idle`
- Backend maps status to unified status: `offline` → `idle`
- Backend calls `update_agent_usage_status('idle')`

## Products Covered

1. **Call Connector Pro** - Outbound dialing
2. **VDP (Virtual Dialer Platform)** - Inbound/outbound VDP calls
3. **AO Intel** - Inbound calls
4. **ConnectNow** - General platform usage
5. **AO Recruit** - Recruiting calls
6. **AO Meet** - Video meetings
7. **AO Precheck** - Verification sessions

## Query Usage Data

```sql
-- Get all agents' usage for today
SELECT * FROM get_agent_usage_summary();

-- Get specific agent's usage
SELECT * FROM get_agent_usage_summary('agent@example.com');

-- Manual query with unified status
SELECT 
  agent_email,
  status,
  total_available_seconds,
  total_on_call_seconds,
  TO_CHAR(INTERVAL '1 second' * total_available_seconds, 'HH24:MI:SS') as active_time,
  TO_CHAR(INTERVAL '1 second' * total_on_call_seconds, 'HH24:MI:SS') as connected_time
FROM live_call_boardt
WHERE agent_email IS NOT NULL
ORDER BY total_available_seconds DESC;
```

## Notes

- Status is unified across ALL products
- Time is accumulated only when status **changes** (not on every heartbeat)
- If status doesn't change, no time is added (prevents double-counting)
- Time is tracked in seconds, displayed as HH:MM:SS
- Tracking resets daily (new day = new tracking record)
