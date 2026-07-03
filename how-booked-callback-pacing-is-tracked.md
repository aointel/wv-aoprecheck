# How "Booked" and "Callback" Pacing is Tracked

## Current Tracking Mechanism

### 1. **BOOKED Disposition Tracking**

#### Per-Lead Tracking (Same Lead):
- **Check**: Query `agent_dial_metrics` for existing "booked" events for the same `lead_phone` today
- **Limit**: Cannot book the same lead within **5 minutes** of previous booking
- **Query**: 
  ```sql
  SELECT id, event_timestamp 
  FROM agent_dial_metrics
  WHERE agent_email = ?
    AND event_type = 'booked'
    AND lead_phone = ?
    AND event_timestamp >= today_start
    AND event_timestamp < today_end
  ORDER BY event_timestamp DESC
  LIMIT 1
  ```
- **Calculation**: `timeSinceLastBooking = currentTime - lastBookingTime`
- **Block if**: `timeSinceLastBooking < 5 minutes`

#### Per-Agent Rate Limiting:
- **Hourly Limit**: Max **3 bookings per hour** per agent
- **Query**: Count all "booked" events in last hour
- **Calculation**: Count rows where `event_type = 'booked'` and `event_timestamp >= 1 hour ago`

#### Minimum Time After Dial:
- **Requirement**: Must be at least **30 seconds** after dial event
- **Query**: Check for recent "dial" event for same `lead_phone`
- **Block if**: Booking happens within 30 seconds of dial

### 2. **CALLBACK Disposition Tracking** ⚠️ CURRENTLY WEAK

#### Current State:
- **No specific tracking** for callback dispositions
- Only subject to **general disposition throttle**:
  - Max 1 disposition per minute (any disposition)
  - Max 10 dispositions per hour (non-booked)
- **Problem**: Agents can spam "callback" on different leads rapidly

#### Callback Dispositions:
- `callback_scheduled`
- `call_back`
- `callback`

## Issues with Current Tracking

1. **Callback has no specific limits** - can click rapidly on different leads
2. **No per-lead callback tracking** - can mark same lead as callback multiple times
3. **No minimum time between callbacks** - can click callback immediately after dial
4. **No hourly limit for callbacks** - only general 10/hour limit applies

## What We Should Track

### For CALLBACK:
1. **Per-Lead**: Cannot mark same lead as callback within 5 minutes
2. **Per-Agent Hourly**: Max 5 callbacks per hour
3. **Minimum Time**: Must be at least 15 seconds after dial
4. **Per-Agent Per-Minute**: Max 1 callback per minute (already covered by general throttle)

### For BOOKED (already implemented):
1. ✅ Per-Lead: 5 minute cooldown
2. ✅ Per-Agent Hourly: Max 3 per hour
3. ✅ Minimum Time: 30 seconds after dial

