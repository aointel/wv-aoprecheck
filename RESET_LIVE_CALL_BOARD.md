# Reset Live Call Board Stats

## Quick Reset (Recommended)

**API Endpoint:**
```bash
POST /api/live-call-board/reset-stats
```

This will:
1. Reset ALL agents' stats to 0
2. Recalculate from `agent_dial_metrics` for today (PST timezone)
3. Ensure reached/booked never exceed dialed
4. Fix any invalid stats automatically

## What It Does

The reset script:
- ✅ Counts **distinct phone numbers** (each phone counts once per agent per day)
- ✅ Only counts **reached** if the phone was also **dialed** (prevents impossible stats)
- ✅ Only counts **booked** if the phone was also **dialed**
- ✅ Uses **PST timezone** for "today" calculation
- ✅ Preserves agent status and other required fields

## Alternative Methods

### 1. SQL Script
Run in Supabase SQL Editor:
```sql
-- Execute the reset-live-call-board-stats.sql file
```

### 2. Node.js Script
```bash
node reset-live-call-board-stats.mjs
```

### 3. Regular Sync (Not a Reset)
```bash
POST /api/live-call-board/sync-today-stats
```
This syncs stats but doesn't reset to 0 first.

## Why Reset?

Reset when:
- Stats show impossible numbers (e.g., 100 reached, 104 dialed)
- Data appears corrupted or inconsistent
- After fixing bugs in the counting logic
- When you need a clean slate for today's stats

## How It Works

1. **Reset Phase**: Sets all `today_dialed`, `today_reached`, `today_booked` to 0
2. **Fetch Phase**: Gets all `agent_dial_metrics` for today (PST)
3. **Calculate Phase**: 
   - Groups metrics by agent email
   - Counts distinct dialed phones
   - Counts distinct reached phones (only if also dialed)
   - Counts distinct booked phones (only if also dialed)
4. **Update Phase**: Upserts calculated stats into `live_call_board`
5. **Verify Phase**: Checks for any invalid stats and fixes them

## Important Notes

- **Reached can NEVER exceed dialed** - this is enforced
- **Booked can NEVER exceed dialed** - this is enforced
- Each phone number counts **once per agent per day** (even if dialed 10 times)
- Stats are calculated for **today in PST timezone** (not UTC)

