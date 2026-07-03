# VDP Daily and Weekly Usage Tracking

## Overview
The system tracks VDP usage at **two levels**:
1. **Daily Tracking** - One record per agent per day (resets each day)
2. **Weekly Aggregation** - Cumulative totals for the week

## Daily Tracking

### Table: `agent_availability_tracking`
- **One record per agent per day**
- Automatically resets each day (new record created)
- Tracks:
  - `total_available_time` (seconds) - Time waiting for calls
  - `total_calling_time` (seconds) - Time actively on calls
  - `total_offline_time` (seconds) - Time offline
  - `tracking_date` (DATE) - The specific day

### How It Works
1. **Every 10 seconds**: VDP poller checks agent status
2. **On status change**: Creates/updates daily record
3. **Time accumulation**: Adds time to appropriate category (available/calling/offline)
4. **Daily reset**: New record created automatically for each new day

### Query Daily Data
```sql
-- Get daily usage for a date range
SELECT 
  agent_email,
  tracking_date,
  total_available_time / 60 as available_minutes,
  total_calling_time / 60 as calling_minutes,
  total_offline_time / 60 as offline_minutes
FROM agent_availability_tracking
WHERE tracking_date >= '2026-01-18'
  AND tracking_date <= '2026-01-24'
  AND agent_email = 'agent@example.com'
ORDER BY tracking_date;
```

### API Endpoint
```
GET /api/usage/daily-usage?startDate=2026-01-18&endDate=2026-01-24&agentEmail=agent@example.com
```

Returns:
- `byDate` - Grouped by date for easy viewing
- `dailyRecords` - Flat list of all daily records
- `totals` - Aggregated totals for the date range

## Weekly Aggregation

### Table: `weekly_usage_stats`
- **One record per agent per week**
- Aggregates data from daily tracking
- Tracks cumulative weekly totals:
  - `vdp_available_minutes` - Total minutes waiting for calls this week
  - `vdp_call_minutes` - Total minutes on calls this week
  - `vdp_total_minutes` - Total VDP time (available + calls)

### How It Works
1. **Daily data** is tracked in `agent_availability_tracking`
2. **Weekly stats** are calculated on-the-fly from daily data
3. **Usage tracker** queries daily records and aggregates them

### Query Weekly Data
```sql
-- Get weekly stats
SELECT 
  agent_email,
  week_start_date,
  vdp_available_minutes,
  vdp_call_minutes,
  vdp_total_minutes
FROM weekly_usage_stats
WHERE week_start_date >= '2026-01-18'
ORDER BY week_start_date, agent_email;
```

## Data Flow

```
VDP Poller (every 10s)
  ↓
agent_availability_tracking (daily records)
  ↓
Usage Tracker (aggregates daily → weekly)
  ↓
weekly_usage_stats (weekly totals)
```

## Example: Viewing Daily Breakdown

### For a specific agent over a week:
```javascript
// API call
GET /api/usage/daily-usage?startDate=2026-01-18&endDate=2026-01-24&agentEmail=agent@example.com

// Response structure:
{
  "success": true,
  "dateRange": {
    "startDate": "2026-01-18",
    "endDate": "2026-01-24",
    "days": 7
  },
  "totals": {
    "totalAvailableTime": 14400,  // seconds
    "totalCallingTime": 3600,     // seconds
    "formattedAvailableTime": "04:00:00",
    "formattedCallingTime": "01:00:00"
  },
  "byDate": {
    "2026-01-18": [
      {
        "agentEmail": "agent@example.com",
        "trackingDate": "2026-01-18",
        "totalAvailableTime": 28800,  // 8 hours
        "totalCallingTime": 7200,     // 2 hours
        "formattedAvailableTime": "08:00:00",
        "formattedCallingTime": "02:00:00"
      }
    ],
    "2026-01-19": [...],
    // etc.
  },
  "dailyRecords": [
    // Flat list of all daily records
  ]
}
```

## Key Points

1. **Daily records are permanent** - They don't reset, they accumulate throughout the day
2. **New day = New record** - Each day gets its own record automatically
3. **Weekly = Sum of daily** - Weekly stats are calculated from daily records
4. **Historical data** - You can query any date range to see daily breakdowns
5. **Time is in seconds** - Convert to minutes/hours for display (divide by 60)

## Database Schema

### `agent_availability_tracking` (Daily)
- `tracking_date` (DATE) - The specific day
- `total_available_time` (INTEGER) - Seconds available that day
- `total_calling_time` (INTEGER) - Seconds on calls that day
- Unique constraint: `(agent_id, tracking_date)` - One record per agent per day

### `weekly_usage_stats` (Weekly)
- `week_start_date` (DATE) - Sunday of the week
- `vdp_available_minutes` (INTEGER) - Minutes available this week
- `vdp_call_minutes` (INTEGER) - Minutes on calls this week
- Unique constraint: `(agent_email, week_start_date)` - One record per agent per week
