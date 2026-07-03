# 🧪 Testing agent_live_call_status Updates

This guide helps you verify that CCPro is correctly updating the `agent_live_call_status` table in Supabase.

## Prerequisites

1. **Agent must have CCPRO enabled**: The agent's email must exist in the `customers` table with `CCPRO = true`
2. **Table must exist**: Run `create-agent-live-call-status-table.sql` in Supabase SQL editor
3. **Server must be running**: Your API server needs to be accessible

---

## Method 1: SQL Queries (Recommended)

Run the SQL queries in `test-agent-live-status-updates.sql` directly in Supabase SQL Editor:

### Quick Check:
```sql
-- See all current records
SELECT * FROM agent_live_call_status ORDER BY updated_at DESC;

-- Check if your agent has CCPRO
SELECT company_email, personal_email, CCPRO 
FROM customers 
WHERE company_email = 'your-email@example.com' 
   OR personal_email = 'your-email@example.com';

-- Compare CCPRO agents vs status table
SELECT 
  COALESCE(c.company_email, c.personal_email) as agent_email,
  c.CCPRO,
  als.status,
  als.last_heartbeat_at
FROM customers c
LEFT JOIN agent_live_call_status als ON (
  als.agent_email = c.company_email OR als.agent_email = c.personal_email
)
WHERE c.CCPRO = true;
```

---

## Method 2: API Test Scripts

### Option A: Node.js Script

```bash
# Install dependencies (if needed)
npm install node-fetch

# Run the test
node test-agent-status-api.mjs <agent_email> <status>

# Example:
node test-agent-status-api.mjs test@aoglobelife.com ready
```

### Option B: PowerShell Script (Windows)

```powershell
# Run the test
.\test-agent-status-api.ps1 -AgentEmail "test@aoglobelife.com" -Status "ready"

# Or with custom server URL
.\test-agent-status-api.ps1 -AgentEmail "test@aoglobelife.com" -Status "ready" -ServerUrl "http://localhost:3000"
```

---

## Method 3: Real-Time Monitoring

Monitor the table in real-time (updates every 5 seconds):

```bash
# Make sure you have .env file with:
# SUPABASE_URL=your-supabase-url
# SUPABASE_SERVICE_ROLE_KEY=your-service-key

node monitor-agent-status.mjs
```

---

## Method 4: Direct API Calls

### Test Presence Endpoint:
```bash
curl -X POST http://localhost:3000/agent/presence \
  -H "Content-Type: application/json" \
  -d '{
    "agent_email": "test@aoglobelife.com",
    "status": "ready"
  }'
```

### Test Heartbeat Endpoint:
```bash
curl -X POST http://localhost:3000/api/call-connector-pro/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "agentEmail": "test@aoglobelife.com",
    "status": "ready",
    "sessionId": "test-session-123"
  }'
```

### Check Status via Debug Endpoint:
```bash
# Get all records
curl http://localhost:3000/api/debug/agent-live-status

# Get specific agent
curl http://localhost:3000/api/debug/agent-live-status?agent_email=test@aoglobelife.com
```

---

## Method 5: Browser/Postman

### Test Presence:
- **URL**: `POST http://localhost:3000/agent/presence`
- **Body**:
```json
{
  "agent_email": "test@aoglobelife.com",
  "status": "ready"
}
```

### Check Status:
- **URL**: `GET http://localhost:3000/api/debug/agent-live-status?agent_email=test@aoglobelife.com`

---

## Expected Results

### ✅ Success Indicators:

1. **Server Logs** should show:
   ```
   ✅ CCPro presence WRITTEN to Supabase: test@aoglobelife.com -> ready
   ```

2. **API Response** should return:
   ```json
   {
     "success": true,
     "agent_email": "test@aoglobelife.com",
     "status": "ready"
   }
   ```

3. **SQL Query** should show the record:
   ```sql
   SELECT * FROM agent_live_call_status WHERE agent_email = 'test@aoglobelife.com';
   ```

### ❌ Failure Indicators:

1. **No CCPRO Access**:
   ```
   🚫 CCPro presence SKIPPED: test@aoglobelife.com does NOT have CCPRO access
   ```
   **Fix**: Update `customers` table: `UPDATE customers SET CCPRO = true WHERE company_email = 'test@aoglobelife.com';`

2. **Customer Not Found**:
   ```
   🚫 CCPro presence SKIPPED: No customer found for test@aoglobelife.com
   ```
   **Fix**: Add agent to `customers` table with `CCPRO = true`

3. **Table Missing**:
   ```
   🚨 TABLE MISSING: agent_live_call_status table does not exist
   ```
   **Fix**: Run `create-agent-live-call-status-table.sql` in Supabase

---

## Troubleshooting Checklist

- [ ] Agent exists in `customers` table
- [ ] Agent has `CCPRO = true` in `customers` table
- [ ] `agent_live_call_status` table exists in Supabase
- [ ] Server is running and accessible
- [ ] Server logs show no errors
- [ ] Supabase credentials are correct in `.env`
- [ ] Email matches exactly (case-insensitive, but check spelling)

---

## Quick Test Flow

1. **Check if agent has CCPRO**:
   ```sql
   SELECT * FROM customers WHERE company_email = 'your-email@example.com';
   ```

2. **Send a test update**:
   ```bash
   curl -X POST http://localhost:3000/agent/presence \
     -H "Content-Type: application/json" \
     -d '{"agent_email": "your-email@example.com", "status": "ready"}'
   ```

3. **Verify it was written**:
   ```sql
   SELECT * FROM agent_live_call_status WHERE agent_email = 'your-email@example.com';
   ```

4. **Check server logs** for confirmation message

5. **Use debug endpoint** to see all records:
   ```bash
   curl http://localhost:3000/api/debug/agent-live-status
   ```

---

## Server URLs

- **Local**: `http://localhost:3000` (or check your server port)
- **Production**: `https://aoirail-production.up.railway.app`
- **Staging**: `https://aoirail-beta-staging.up.railway.app`

Update the scripts with the correct URL for your environment.

