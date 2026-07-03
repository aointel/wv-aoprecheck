# Usage Tracking System - QA Test Scripts

This directory contains comprehensive test scripts to verify the usage tracking system is working correctly.

## Test Scripts

### 1. `server/scripts/test-usage-tracking.ts` (Main Test Suite)

**TypeScript/Node.js test script** that tests the backend tracking logic directly.

**Usage:**
```bash
# Test with default test agent
tsx server/scripts/test-usage-tracking.ts

# Test with specific agent email
tsx server/scripts/test-usage-tracking.ts agent@example.com
```

**What it tests:**
- ✅ VDP available start/end tracking
- ✅ Call Connector Pro call start/end tracking
- ✅ Duration calculation (with and without provided duration)
- ✅ Weekly stats aggregation
- ✅ Calculation methods (`calculateVDPAvailableTime`, `calculateCCProCallTime`)
- ✅ Orphaned event handling
- ✅ Multiple toggle cycles
- ✅ Database structure verification
- ✅ Query performance

**Output:**
- Color-coded console output
- Pass/fail summary
- Detailed error messages

### 2. `test-usage-tracking-api.sh` (Bash API Tests)

**Bash script** that tests the HTTP API endpoints.

**Usage:**
```bash
# Test against localhost
./test-usage-tracking-api.sh

# Test against different server
BASE_URL=http://staging.example.com ./test-usage-tracking-api.sh

# Test with different agent
TEST_AGENT_EMAIL=agent@example.com ./test-usage-tracking-api.sh
```

**What it tests:**
- ✅ `POST /api/usage/vdp-available-start`
- ✅ `POST /api/usage/vdp-available-end`
- ✅ `POST /api/usage/ccpro-call-start`
- ✅ `POST /api/usage/ccpro-call-end`
- ✅ `GET /api/usage/weekly-stats/:agentEmail`

### 3. `test-usage-tracking-api.ps1` (PowerShell API Tests)

**PowerShell script** for Windows users to test API endpoints.

**Usage:**
```powershell
# Test against localhost
.\test-usage-tracking-api.ps1

# Test against different server
$env:BASE_URL="http://staging.example.com"
.\test-usage-tracking-api.ps1

# Test with different agent
$env:TEST_AGENT_EMAIL="agent@example.com"
.\test-usage-tracking-api.ps1
```

## Running All Tests

### Quick Test (Recommended)
```bash
# Run backend tests
tsx server/scripts/test-usage-tracking.ts

# Run API tests (choose one based on your OS)
./test-usage-tracking-api.sh        # Linux/Mac
.\test-usage-tracking-api.ps1       # Windows
```

### Full Test Suite
```bash
# 1. Backend logic tests
tsx server/scripts/test-usage-tracking.ts test-agent@aoglobelife.com

# 2. API endpoint tests
BASE_URL=http://localhost:3000 ./test-usage-tracking-api.sh

# 3. Verify database directly
psql $DATABASE_URL -c "
  SELECT 
    agent_email,
    vdp_available_minutes,
    ccpro_call_minutes,
    week_start_date
  FROM weekly_usage_stats
  WHERE agent_email = 'test-agent@aoglobelife.com'
  ORDER BY week_start_date DESC;
"
```

## Expected Results

### Backend Tests
All 11 tests should pass:
- ✅ All tracking methods work
- ✅ Events are logged correctly
- ✅ Weekly stats are updated
- ✅ Calculations are accurate
- ✅ Edge cases are handled

### API Tests
All 5 endpoints should return HTTP 200/201:
- ✅ VDP start/end endpoints
- ✅ CCPro start/end endpoints
- ✅ Weekly stats retrieval

## Troubleshooting

### Tests Fail with "Column does not exist"
**Solution:** Run the database migration:
```sql
-- Run this SQL in your database
ALTER TABLE weekly_usage_stats
ADD COLUMN IF NOT EXISTS vdp_available_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ccpro_call_minutes INTEGER DEFAULT 0;
```

### Tests Fail with "Connection refused"
**Solution:** Make sure the server is running:
```bash
# Start the server first
npm run dev
```

### Tests Show Zero Minutes
**Possible causes:**
1. Events are being logged but not aggregated (check `agent_activity_log` table)
2. Week boundaries don't match (check `week_start_date`)
3. Duration calculation is failing (check logs for errors)

**Debug:**
```sql
-- Check if events are being logged
SELECT 
  activity_type,
  COUNT(*) as count,
  MIN(timestamp) as first_event,
  MAX(timestamp) as last_event
FROM agent_activity_log
WHERE agent_email = 'test-agent@aoglobelife.com'
  AND activity_type IN ('vdp_available_start', 'vdp_available_end', 'ccpro_call_start', 'ccpro_call_end')
GROUP BY activity_type;

-- Check weekly stats
SELECT * FROM weekly_usage_stats
WHERE agent_email = 'test-agent@aoglobelife.com'
ORDER BY week_start_date DESC;
```

## Manual Testing Checklist

For manual testing in the UI:

### VDP Tracking
- [ ] Toggle VDP ON → Check browser console for "Tracked VDP available start"
- [ ] Wait 1 minute
- [ ] Toggle VDP OFF → Check console for "Tracked VDP available end"
- [ ] Verify `weekly_usage_stats.vdp_available_minutes` increased

### Call Connector Pro Tracking
- [ ] Start a call → Check console for "Tracked CCPro call start"
- [ ] Talk for 2-3 minutes
- [ ] End call → Check console for "Tracked CCPro call end"
- [ ] Verify `weekly_usage_stats.ccpro_call_minutes` increased

### Edge Cases
- [ ] Close browser while VDP is ON → Check if end event was sent (check logs)
- [ ] Close browser during active call → Check if end event was sent
- [ ] Make multiple calls → Verify all are tracked
- [ ] Toggle VDP multiple times → Verify all cycles are tracked

## Performance Benchmarks

Expected query performance:
- Activity log queries: < 100ms
- Weekly stats updates: < 50ms
- Calculation methods: < 500ms (for typical week's data)

If queries are slower, check indexes:
```sql
-- Verify indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('agent_activity_log', 'weekly_usage_stats');
```
