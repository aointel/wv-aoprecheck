# How Live Call Board Stats Are Calculated

## Overview

Stats are calculated in **two stages**:
1. **Event Logging** - Events are logged to `agent_dial_metrics` table
2. **Stat Aggregation** - Stats are aggregated from `agent_dial_metrics` into `live_call_board`

---

## Stage 1: Event Logging

### When a Call Happens

When an agent makes a call, the system calls `logCallOutcome()` which creates **multiple event rows** in `agent_dial_metrics`:

```typescript
// From server/agent-dial-metrics-tracker.ts

// 1. ALWAYS logs a "dial" event
await logDialMetric(supabase, {
  eventType: 'dial',
  agentEmail: 'agent@example.com',
  leadPhone: '5551234567',
  disposition: 'booked',  // actual disposition
  callDuration: 120
});

// 2. Conditionally logs "reach" if human contact was made
if (isReachedDisposition(disposition, callDuration)) {
  await logDialMetric(supabase, {
    eventType: 'reach',
    agentEmail: 'agent@example.com',
    leadPhone: '5551234567',
    disposition: 'booked',
    callDuration: 120
  });
}

// 3. Conditionally logs "booked" if appointment was set
if (isBookedDisposition(disposition, callDuration)) {
  await logDialMetric(supabase, {
    eventType: 'booked',
    agentEmail: 'agent@example.com',
    leadPhone: '5551234567',
    disposition: 'booked',
    callDuration: 120
  });
}
```

### Example: One Call That Results in Booking

For **ONE call** that results in a booking, you get **3 separate rows** in `agent_dial_metrics`:

| id | event_type | disposition | lead_phone | agent_email | event_timestamp |
|----|------------|--------------|------------|------------|-----------------|
| 1  | dial       | booked       | 5551234567 | agent@...  | 2024-01-15 10:00 |
| 2  | reach      | booked       | 5551234567 | agent@...  | 2024-01-15 10:00 |
| 3  | booked     | booked       | 5551234567 | agent@...  | 2024-01-15 10:00 |

### When Events Are Logged

#### Dial Events
- **ALWAYS logged** when a contact attempt is made
- Triggered for: outbound calls, inbound calls, manual dials, VDP connects
- **No conditions** - every call attempt = 1 dial event

#### Reach Events
- **Conditionally logged** when human contact is made
- Criteria (from `isReachedDisposition()`):
  - Disposition indicates contact: `'contacted'`, `'connected'`, `'talked'`, `'qualified'`, `'interested'`, `'not_interested'`, `'transfer'`, `'appointment'`, `'booked'`, `'callback_scheduled'`, `'sale'`
  - **OR** call duration >= 15 seconds
  - **Excludes**: `'no_answer'`, `'busy'`, `'failed'`, `'voicemail'`, `'bad_number'`, `'no_answer_vm'`, `'wrong_number'`

#### Booked Events
- **Conditionally logged** when an appointment is set
- Criteria (from `isBookedDisposition()`):
  - Disposition indicates booking: `'appointment'`, `'booked'`, `'qualified'`, `'instant_presentation'`, `'sale'`
  - **OR** disposition = `'interested'` AND duration >= 60 seconds
  - Requires duration >= 60 seconds if duration is available

---

## Stage 2: Stat Aggregation

### How Stats Are Calculated

Stats are calculated by **counting distinct phone numbers** per event type for "today" (PST timezone):

```sql
-- From update-live-call-board-from-agent-dial-metrics.sql

-- Get today's PST date range
today_start := date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles')::timestamp) AT TIME ZONE 'America/Los_Angeles';
today_end := today_start + interval '1 day';

-- Calculate stats for each agent
SELECT 
  agent_email,
  -- Count distinct dialed phones
  COUNT(DISTINCT CASE WHEN event_type = 'dial' THEN lead_phone END) as dialed_count,
  
  -- Count distinct reached phones (only if also dialed)
  COUNT(DISTINCT CASE 
    WHEN event_type = 'reach' 
    AND EXISTS (
      SELECT 1 
      FROM agent_dial_metrics adm2 
      WHERE adm2.agent_email = adm.agent_email 
        AND adm2.lead_phone = adm.lead_phone 
        AND adm2.event_type = 'dial'
        AND adm2.event_timestamp >= today_start 
        AND adm2.event_timestamp < today_end
    )
    THEN lead_phone 
  END) as reached_count,
  
  -- Count distinct booked phones (only if also dialed)
  COUNT(DISTINCT CASE 
    WHEN event_type = 'booked' 
    AND EXISTS (
      SELECT 1 
      FROM agent_dial_metrics adm3 
      WHERE adm3.agent_email = adm.agent_email 
        AND adm3.lead_phone = adm.lead_phone 
        AND adm3.event_type = 'dial'
        AND adm3.event_timestamp >= today_start 
        AND adm3.event_timestamp < today_end
    )
    THEN lead_phone 
  END) as booked_count
FROM agent_dial_metrics
WHERE event_timestamp >= today_start
  AND event_timestamp < today_end
  AND agent_email IS NOT NULL
  AND lead_phone IS NOT NULL
GROUP BY agent_email;
```

### Key Rules

1. **Each phone number counts ONCE per agent per day**
   - Even if dialed 10 times → counts as 1 dialed
   - Even if reached 5 times → counts as 1 reached
   - Uses `COUNT(DISTINCT lead_phone)` to enforce this

2. **Reached can NEVER exceed dialed**
   - Only counts reached if there's also a dial event for that phone
   - Uses `EXISTS` subquery to verify dial event exists

3. **Booked can NEVER exceed dialed**
   - Only counts booked if there's also a dial event for that phone
   - Uses `EXISTS` subquery to verify dial event exists

4. **"Today" is calculated in PST timezone**
   - Not UTC, not server timezone
   - Formula: `date_trunc('day', (now() AT TIME ZONE 'America/Los_Angeles'))::timestamp AT TIME ZONE 'America/Los_Angeles'`

---

## Example Calculation

### Scenario: Agent makes 3 calls today

**Call 1:** Dials 555-1234, no answer
- Logs: `dial` event for 555-1234
- Result: 1 dialed, 0 reached, 0 booked

**Call 2:** Dials 555-5678, talks for 30 seconds, not interested
- Logs: `dial` event for 555-5678
- Logs: `reach` event for 555-5678 (duration >= 15s)
- Result: 2 dialed, 1 reached, 0 booked

**Call 3:** Dials 555-1234 again, talks for 2 minutes, books appointment
- Logs: `dial` event for 555-1234 (second dial of this number)
- Logs: `reach` event for 555-1234
- Logs: `booked` event for 555-1234
- Result: **2 dialed** (555-1234 counts once, 555-5678 counts once), **2 reached** (both numbers), **1 booked** (555-1234)

### Final Stats:
- **today_dialed = 2** (distinct phones: 555-1234, 555-5678)
- **today_reached = 2** (distinct phones: 555-1234, 555-5678)
- **today_booked = 1** (distinct phone: 555-1234)

---

## When Stats Are Updated

### Real-Time Updates (Triggers)
- When a new row is inserted into `agent_dial_metrics`, a SQL trigger fires
- Trigger calls `update_live_call_board_stats_for_agent(agent_email)`
- Recalculates stats for that specific agent immediately

### Periodic Updates (Scheduler)
- Node.js scheduler runs every 3 minutes
- Calls `update_live_call_board_stats_from_metrics()`
- Recalculates stats for ALL agents
- Ensures consistency even if triggers miss something

### Manual Updates
- API endpoint: `POST /api/live-call-board/sync-today-stats`
- SQL function: `SELECT update_live_call_board_stats_from_metrics();`

---

## Important Notes

1. **Stats are based on `event_type`, NOT `disposition`**
   - Don't count `disposition='booked'` with `event_type='dial'`
   - Only count `event_type='booked'`

2. **Duplicate prevention**
   - Reach/booked events are checked for duplicates before insertion
   - If same reach/booked event exists today for same phone, it's skipped

3. **Throttling**
   - Booking events are throttled (min 30s after dial, max 6/hour, max 10/10min)
   - Prevents gaming the system

4. **Data integrity**
   - Stats persist even when leads are deleted from `masterlead`
   - `agent_dial_metrics` is independent of `masterlead`
   - Historical accuracy is maintained

---

## Summary

**Flow:**
```
Agent makes call
    ↓
logCallOutcome() logs events to agent_dial_metrics
    ↓
SQL trigger fires (real-time)
    ↓
update_live_call_board_stats_for_agent() executes
    ↓
Counts DISTINCT phone numbers per event_type for today (PST)
    ↓
Updates live_call_board.today_dialed/reached/booked
    ↓
Frontend displays updated stats
```

**Key Formula:**
- **Dialed** = COUNT(DISTINCT phones where event_type='dial')
- **Reached** = COUNT(DISTINCT phones where event_type='reach' AND dial exists)
- **Booked** = COUNT(DISTINCT phones where event_type='booked' AND dial exists)

