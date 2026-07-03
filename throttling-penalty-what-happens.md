# What Happens When Throttling is Triggered (The "Penalty")

## Current Penalty: **BLOCKING ONLY** (No Additional Consequences)

### What Happens:

1. **The Action is Blocked**
   - The disposition/booking is **NOT saved** to the database
   - The `agent_dial_metrics` record is **NOT created**
   - The `masterlead.cnresolution` is **NOT updated** (if throttled before save)
   - The stats (booked count, callback count) are **NOT incremented**

2. **HTTP 429 Error Returned**
   - Status Code: `429 Too Many Requests`
   - Response Body:
     ```json
     {
       "error": "Disposition rate limit exceeded",
       "message": "Disposition throttled: [specific reason]",
       "throttled": true
     }
   ```

3. **Error Message Examples:**
   - `"This lead was already booked 45s ago. Cannot book the same lead again within 5 minutes."`
   - `"Booking rate limit exceeded: 3 bookings in the last hour (max 3/hour)"`
   - `"Callback rate limit exceeded: 5 callbacks in the last hour (max 5/hour)"`
   - `"Rate limit exceeded: 1 dispositions in the last minute (max 1/min)"`
   - `"Booking too soon after dial: 15s (minimum 30s required)"`
   - `"Callback too soon after dial: 10s (minimum 15s required)"`

4. **Frontend Behavior**
   - Should show error toast/notification to user
   - Button click is rejected
   - User must wait before trying again

## What Does NOT Happen (No Additional Penalties):

❌ **No account suspension**  
❌ **No credit deduction**  
❌ **No logging to "violations" table**  
❌ **No email notification to admins**  
❌ **No permanent ban**  
❌ **No rate limit increase**  
❌ **No cooldown period extension**

## The Penalty is Simply:

**The action is rejected and must wait until the throttle window expires.**

## Throttle Windows:

- **Same lead re-booking**: 5 minutes
- **Same lead re-callback**: 5 minutes  
- **Per-minute limit**: 1 minute
- **Hourly booking limit**: 1 hour (resets)
- **Hourly callback limit**: 1 hour (resets)
- **Minimum time after dial (booked)**: 30 seconds
- **Minimum time after dial (callback)**: 15 seconds

## Current Limitations:

1. **No persistent tracking** - If someone keeps trying, each attempt is checked independently
2. **No escalation** - Repeated violations don't increase penalties
3. **No admin alerts** - Admins aren't notified of throttling events
4. **No audit trail** - Throttling events aren't logged separately (only in console)

## Potential Enhancements (Not Currently Implemented):

- Log throttling attempts to a separate table
- Send alerts to admins after X violations
- Implement escalating penalties (e.g., 1 hour ban after 10 violations)
- Track "violation score" per agent
- Auto-suspend accounts with excessive violations

