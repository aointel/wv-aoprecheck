# Updated Throttling Limits

## Combined Booking + Callback Limit

**NEW RULE**: Booked and Callback dispositions now share a **combined limit of 5 per hour**.

### Previous Limits:
- Booked: 3/hour
- Callback: 5/hour
- **Combined**: 8/hour (separate limits)

### New Limits:
- **Booked + Callback Combined**: **5/hour** (shared limit)
- If agent has 3 bookings and 2 callbacks = 5 total ✅
- If agent has 5 bookings and 0 callbacks = 5 total ✅
- If agent has 0 bookings and 5 callbacks = 5 total ✅
- If agent has 3 bookings and 3 callbacks = 6 total ❌ **BLOCKED**

## All Throttling Rules:

### Per-Lead Limits (Same Lead):
- **Booked**: Cannot book same lead within **5 minutes**
- **Callback**: Cannot mark same lead as callback within **5 minutes**

### Per-Agent Hourly Limits:
- **Booked + Callback Combined**: Max **5 per hour** (shared limit)
- **Other Dispositions**: Max **10 per hour** (non-booked, non-callback)

### Per-Agent Per-Minute Limits:
- **Any Disposition**: Max **1 per minute**

### Minimum Time After Dial:
- **Booked**: Must be at least **30 seconds** after dial
- **Callback**: Must be at least **15 seconds** after dial

## Example Scenarios:

### Scenario 1: Agent books 5 leads in an hour
- 5 bookings, 0 callbacks = 5 total ✅ **ALLOWED**
- 6th booking attempt = ❌ **BLOCKED** (exceeds 5 combined limit)

### Scenario 2: Agent mixes bookings and callbacks
- 3 bookings, 2 callbacks = 5 total ✅ **ALLOWED**
- 4th booking attempt = ❌ **BLOCKED** (would be 6 total)

### Scenario 3: Agent only uses callbacks
- 5 callbacks, 0 bookings = 5 total ✅ **ALLOWED**
- 6th callback attempt = ❌ **BLOCKED** (exceeds 5 combined limit)

