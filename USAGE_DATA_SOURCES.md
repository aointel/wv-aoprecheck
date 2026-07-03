# Weekly Usage Report - Data Sources

## Overview
The Weekly Usage Report gets data from the `weekly_usage_stats` table in the database. Data is populated by tracking various agent activities throughout the system.

## Data Sources

### 1. **Logins** (`total_logins`, `unique_login_days`)
- **Source**: `server/auth-service.ts` (line 174)
- **Method**: `usageTracker.trackLogin()`
- **When**: When agent successfully logs in via `/api/auth/login`
- **What it tracks**: 
  - Logs to `agent_activity_log` table
  - Creates/updates weekly stats record
  - Increments login count
  - Calculates unique login days

### 2. **Online Time** (`total_online_minutes`)
- **Source**: `client/src/components/UsageHeartbeat.tsx`
- **Method**: `usageTracker.trackHeartbeat()` via `/api/usage/heartbeat`
- **When**: 
  - Every 60 seconds while agent is logged in
  - Sent automatically by `<UsageHeartbeat />` component (included in App.tsx)
- **What it tracks**:
  - Logs heartbeat to `agent_activity_log` table
  - Updates `last_activity_at` in weekly stats
  - Online time is **calculated on-the-fly** from heartbeat logs when querying stats

### 3. **VDP Connects** (`vdp_connects_received`, `vdp_total_minutes`)
- **Source**: `server/hotlead-auto-assign.ts` (line 153)
- **Method**: `usageTracker.trackVDPConnect()`
- **When**: When a hotlead is automatically assigned to an agent (VDP call received)
- **What it tracks**: Increments VDP connect count and adds call duration

### 4. **Outbound Dials** (`total_dials_made`, `total_call_minutes`)
- **Source**: `server/routes.ts` (line 6527)
- **Method**: `usageTracker.trackDialMade()`
- **When**: When agent makes an outbound call via Call Connector Pro
- **What it tracks**: Increments dial count and adds call duration

### 5. **Appointments** (`appointments_scheduled`)
- **Source**: `server/routes-meets.ts` (line 86)
- **Method**: `usageTracker.trackAppointmentScheduled()` ⚠️ **BUG: Method doesn't exist!**
- **Should be**: `usageTracker.trackAppointment()`
- **When**: When agent schedules an appointment (creates a meet)
- **What it tracks**: Increments appointment count

### 6. **Sales/ALP** (`sales_made`, `total_alp`)
- **Source**: `server/routes-meets.ts` (line 214)
- **Method**: `usageTracker.trackSaleMade()` ⚠️ **BUG: Method doesn't exist!**
- **Should be**: `usageTracker.trackSale()`
- **When**: When agent marks a meet as "SALE" with sale amount
- **What it tracks**: Increments sales count and adds ALP amount

## Database Tables

### `weekly_usage_stats`
- Stores aggregated weekly stats per agent
- One record per agent per week (Sunday to Saturday)
- Created automatically on first login of the week
- Updated as activities occur

### `agent_activity_log`
- Raw activity log for all agent actions
- Used to calculate online time from heartbeats
- Tracks: logins, heartbeats, page views, etc.

## API Endpoints

### GET `/api/usage/weekly-stats-all`
- Returns all agents' stats for current week
- Used by: `client/src/pages/UsageReport.tsx`
- Calculates online time on-the-fly from heartbeat logs

### POST `/api/usage/heartbeat`
- Receives heartbeat from frontend
- Called by: `UsageHeartbeat` component every 60 seconds

## Issues Found

1. **Missing Methods**: `routes-meets.ts` calls `trackAppointmentScheduled()` and `trackSaleMade()` which don't exist. Should call `trackAppointment()` and `trackSale()` instead.

2. **Online Time Calculation**: Previously `calculateOnlineTime()` was never called. Now fixed to calculate on-the-fly in the query.

3. **No Fallback**: If current week has no data, report showed nothing. Now shows most recent week as fallback.












