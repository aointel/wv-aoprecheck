# How to Count Dials, Reaches, and Books - CORRECT METHODOLOGY

## How Events Are Logged

When a call is made, `logCallOutcome()` creates **multiple event rows** in `agent_dial_metrics`:

1. **DIAL event** - ALWAYS logged when contact is attempted
   - `event_type = 'dial'`
   - `disposition = <actual disposition>` (e.g., 'booked', 'voicemail', 'no_answer', etc.)

2. **REACH event** - Conditionally logged if human contact was made
   - `event_type = 'reach'`
   - `disposition = <actual disposition>` (e.g., 'booked', 'contacted', 'not_interested', etc.)
   - Only logged if `isReachedDisposition()` returns true

3. **BOOKED event** - Conditionally logged if appointment was set
   - `event_type = 'booked'`
   - `disposition = <actual disposition>` (should be 'booked', 'appointment', etc.)
   - Only logged if `isBookedDisposition()` returns true

## Example: Single Call That Results in Booking

For ONE call that results in a booking, you get **3 separate rows**:

| event_type | disposition | lead_phone | agent_email |
|------------|-------------|------------|-------------|
| dial       | booked      | 5551234567 | agent@...   |
| reach      | booked      | 5551234567 | agent@...   |
| booked     | booked      | 5551234567 | agent@...   |

## CORRECT Counting Logic

### 1. DIALS (`today_dialed`)
```sql
COUNT(DISTINCT lead_phone) 
WHERE event_type = 'dial'
  AND event_timestamp >= today_start 
  AND event_timestamp < today_end
  AND agent_email = <agent>
```

**Rules:**
- Count each phone number **ONCE per day** (even if dialed multiple times)
- Use `DISTINCT lead_phone` to prevent double-counting
- Only count `event_type = 'dial'` (ignore disposition)

### 2. REACHES (`today_reached`)
```sql
COUNT(DISTINCT lead_phone) 
WHERE event_type = 'reach'
  AND event_timestamp >= today_start 
  AND event_timestamp < today_end
  AND agent_email = <agent>
```

**Rules:**
- Count each phone number **ONCE per day** (even if reached multiple times)
- Use `DISTINCT lead_phone` to prevent double-counting
- Only count `event_type = 'reach'` (ignore disposition)
- A phone can be both dialed AND reached (they're separate counts)

### 3. BOOKED (`today_booked`)
```sql
COUNT(DISTINCT lead_phone) 
WHERE event_type = 'booked'
  AND event_timestamp >= today_start 
  AND event_timestamp < today_end
  AND agent_email = <agent>
```

**Rules:**
- Count each phone number **ONCE per day** (even if booked multiple times - shouldn't happen due to duplicate prevention)
- Use `DISTINCT lead_phone` to prevent double-counting
- **ONLY count `event_type = 'booked'`** - DO NOT count `disposition='booked'` with other event_types
- A phone can be dialed, reached, AND booked (they're separate counts)

## CRITICAL: Why We Use event_type, Not disposition

**DO NOT count based on disposition alone!**

❌ **WRONG:**
```sql
-- This is WRONG - will double/triple count
COUNT(DISTINCT lead_phone) WHERE disposition = 'booked'
```

✅ **CORRECT:**
```sql
-- This is CORRECT - counts only booked events
COUNT(DISTINCT lead_phone) WHERE event_type = 'booked'
```

**Why?**
- When a booking happens, you get 3 events: `dial+booked`, `reach+booked`, `booked+booked`
- If you count by `disposition='booked'`, you'd count all 3 events = **3x the actual bookings**
- If you count by `event_type='booked'`, you count only the booked event = **1 booking**

## Current Problem

**The data shows:**
- Events with `disposition='booked'` have `event_type='dial'` or `event_type='reach'`
- **NO recent events with `event_type='booked'` are being logged!** (last ones were 2 days ago)

This means:
1. Either `logCallOutcome()` is not logging the 'booked' event_type (bug in logging)
2. Or the 'booked' events are being blocked by the throttle/validation
3. Or `isBookedDisposition()` is returning false when it should return true

**Investigation needed:**
- Check if `validateBookingThrottle()` is blocking booked events
- Check if `isBookedDisposition()` is working correctly
- Check server logs for errors when logging booked events

**Temporary Fix (until logging is fixed):**
- Count `disposition='booked'` with `event_type='reach'` OR `event_type='dial'`
- But this is a workaround - the real fix is to ensure `event_type='booked'` events are being logged

## Proper Fix

1. **Ensure `event_type='booked'` events are being logged** when `isBookedDisposition()` returns true
2. **Count ONLY `event_type='booked'`** for booked appointments
3. **Do NOT count `disposition='booked'`** with other event_types

## Summary Table

| Metric | What to Count | SQL Filter |
|--------|---------------|------------|
| **Dials** | Unique phones dialed today | `event_type = 'dial'` |
| **Reaches** | Unique phones reached today | `event_type = 'reach'` |
| **Booked** | Unique phones booked today | `event_type = 'booked'` |

**All use:** `COUNT(DISTINCT lead_phone)` to prevent double-counting the same phone number.

