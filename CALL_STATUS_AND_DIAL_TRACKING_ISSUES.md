# Call Status and Dial Tracking Issues - Comprehensive Fix

## Issues Identified

### 1. "answered" Status Not Handled Properly

**Problem:** Twilio can send `'answered'` status, but it's not included in `isCallStart` check, causing it to fall through and not be processed.

**Locations:**
- `server/routes.ts` line 21400: `isCallStart` doesn't include `'answered'`
- `server/routes.ts` line 21466: Only updates `connected_at` for `'in-progress'`, not `'answered'`
- `server/bulletproof-call-tracker.ts` line 278: Twilio webhook handler doesn't have a case for `'answered'`

**Impact:** Calls with `'answered'` status may freeze or not update properly, causing UI issues and incorrect state tracking.

### 2. Dial Counting Not Working - One Hour Limit Not Enforced

**Problem:** The one-hour check in `agent-dial-metrics-tracker.ts` prevents DUPLICATE EVENT LOGGING, not re-dialing the same lead. This means:
- Leads can be dialed multiple times within an hour (should be blocked)
- The system counts each dial attempt separately instead of respecting the one-hour cooldown
- Dial counts continue incrementing even when the same lead is dialed repeatedly

**Current Behavior:**
- Line 106 in `agent-dial-metrics-tracker.ts`: Prevents logging duplicate `event_type='dial'` events for same phone within 1 hour
- This is for preventing duplicate LOGS, not preventing the actual dial action
- No check exists to prevent dialing the same lead within 1 hour

**Expected Behavior:**
- Before allowing a dial, check if this lead was dialed in the last hour
- If yes, block the dial or show a message
- Only count unique dials per lead per hour

### 3. Masterlead Fields Never Incremented

**Problem:** According to `lead-usage-audit.txt`, `try_count` and `contact_count` in `masterlead` are NEVER updated. The system tracks dials/reaches in `agent_dial_metrics` but doesn't update the lead record itself.

**Missing Updates:**
- `try_count` - should increment on each dial attempt
- `contact_count` - should increment when call is answered/reached
- `called_at` - should update to current timestamp on dial
- `last_contacted` - should update when call is answered

**Missing Fields Needed:**
- `total_dials` - total number of times this lead has been dialed (all agents, all time)
- `total_reaches` - total number of times this lead was reached (all agents, all time)
- `last_dial_at` - timestamp of last dial attempt
- `last_reached_at` - timestamp of last successful reach
- `dial_count_today` - number of dials today (for this agent or all agents)
- `reach_count_today` - number of reaches today

## Fixes Required

### Fix 1: Handle "answered" Status

**File: `server/routes.ts`**

1. Add `'answered'` to `isCallStart` check (line 21400)
2. Update `connected_at` when status is `'answered'` (line 21466)
3. Ensure Call Connector Tracker receives `'answered'` status updates

### Fix 2: Enforce One-Hour Dial Limit Per Lead

**File: `server/routes.ts` or dial initiation endpoint**

Before allowing a dial:
1. Check `agent_dial_metrics` for recent dial events for this `lead_phone` within last hour
2. If found, block the dial and return error message
3. Only allow dial if no recent dial exists OR if last dial was > 1 hour ago

**File: `server/agent-dial-metrics-tracker.ts`**

The current one-hour check (line 106) is correct for preventing duplicate logs, but we need an ADDITIONAL check before dialing starts.

### Fix 3: Increment Masterlead Fields

**When to Update:**
- On dial attempt: increment `try_count`, update `called_at`, update `last_dial_at`, increment `dial_count_today`
- On call answered/reached: increment `contact_count`, update `last_contacted`, update `last_reached_at`, increment `reach_count_today`, increment `total_reaches`
- On call completed: update `total_dials` (if not already counted)

**Files to Update:**
- `server/routes.ts` - Twilio status webhook handler
- `server/agent-dial-metrics-tracker.ts` - When logging dial/reach events
- Any dial initiation endpoint

## SQL Migration Needed

Add new fields to `masterlead` table:

```sql
ALTER TABLE masterlead
ADD COLUMN IF NOT EXISTS total_dials INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_reaches INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_dial_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_reached_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS dial_count_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reach_count_today INTEGER DEFAULT 0;
```

## Implementation Priority

1. **HIGH:** Fix "answered" status handling (causing freezes)
2. **HIGH:** Add masterlead field increments (data integrity)
3. **MEDIUM:** Enforce one-hour dial limit (prevents spam dialing)
