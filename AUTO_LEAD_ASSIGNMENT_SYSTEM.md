# Auto Lead Assignment System for Call Connector Pro

## Overview
This document describes the automatic lead assignment system that requests more leads from the **Lead Sync API** ([https://lead-sync-mmandella.replit.app](https://lead-sync-mmandella.replit.app)) when agents have fewer than 50 leads in their Call Connector Pro queue.

## Features Implemented

### 1. **Server-Side Auto-Assignment Webhook**
**Location:** `server/routes.ts` (lines 15768-15817)

When agents fetch their leads via `/api/outbound-dialer/leads`, the system now:
- Checks if the agent has < 50 leads
- Automatically sends a request to the Lead Sync API to assign more leads
- Returns metadata about the assignment status in the API response

**Lead Sync API Details:**
- **Endpoint:** `https://lead-sync-mmandella.replit.app/api/bulk-assign-leads`
- **Method:** POST
- **Headers:**
  - `Content-Type: application/json`
- **Request Payload:**
  ```json
  {
    "agentEmail": "chrislafond@aoglobelife.com",
    "associate_id": "1253",
    "requestedCount": 8,          // Number of leads needed to reach 50
    "currentCount": 42,            // Current lead count
    "source": "call_connector_pro"
  }
  ```

**Expected API Response:**
```json
{
  "success": true,
  "assigned": 50,
  "agentEmail": "chrislafond@aoglobelife.com",
  "agentMarkets": ["Veteran"],
  "agentStates": 46,
  "totalAvailable": 1000,
  "afterMarketFilter": 1000
}
```

**Agent Email to Associate ID Mapping:**
- `martintoma@aoglobelife.com` → `"1253"`
- `cnsysop@aoglobelife.com` → `"1253"`
- `davidfulfer@aoglobelife.com` → `"124235"`
- Others → `"999"`

### 2. **Enhanced API Response**
The `/api/outbound-dialer/leads` endpoint now returns:
```json
{
  "success": true,
  "leads": [...],
  "total": 42,
  "needsMoreLeads": true,      // NEW: Indicates < 50 leads
  "webhookSent": true,          // NEW: Request was sent to Lead Sync API
  "webhookResponse": {          // NEW: Response from Lead Sync API
    "success": true,
    "assigned": 50,
    "agentEmail": "chrislafond@aoglobelife.com",
    "agentMarkets": ["Veteran"],
    "agentStates": 46,
    "totalAvailable": 1000,
    "afterMarketFilter": 1000
  },
  "leadsAssigned": 50           // NEW: Number of leads assigned
}
```

### 3. **Client-Side Auto-Check (CallConnectorPro.tsx)**
**Location:** `client/src/components/outbound-dialer/CallConnectorPro.tsx` (lines 217-254)

**Features:**
- **Toast Notification:** Displays when webhook is sent
  - If leads assigned successfully: "✅ X New Leads Assigned!"
    - Message: "You now have access to X new leads. Markets: Veteran"
  - If checking for leads: "🔄 Requesting More Leads"
    - Message: "You have X leads. Checking for available leads..."
  - Duration: 7 seconds

- **Visual Indicator:** Lead count badge in header (lines 533-540)
  - Green badge: 50+ leads
  - Orange animated badge: < 50 leads
  - Shows "Requesting More..." when webhook is active

- **Dynamic Refresh Interval:**
  - When leads < 50: Refreshes every **10 seconds**
  - When leads ≥ 50: Refreshes every **30 seconds**
  - Automatically adjusts based on current lead count

### 4. **Client-Side Auto-Check (OutboundDialerInterface.tsx)**
**Location:** `client/src/components/outbound-dialer/OutboundDialerInterface.tsx`

**Features:**
- Toast notification when webhook is sent (lines 723-731)
- Periodic auto-refresh with dynamic intervals (lines 2428-2449)
  - < 50 leads: 10-second refresh
  - ≥ 50 leads: 30-second refresh
- Automatic lead queue updates without full page reload

## How It Works

### Initial Load Flow
1. Agent opens Call Connector Pro
2. Component fetches leads from `/api/outbound-dialer/leads`
3. Server checks lead count:
   - If < 50: Sends webhook to Planet ALTIG
   - Returns leads + webhook status
4. Client displays notification if webhook was sent
5. Sets up periodic refresh based on lead count

### Periodic Check Flow
1. Auto-refresh timer triggers (10s or 30s based on lead count)
2. Client fetches updated leads from server
3. Server checks if still < 50 leads
4. If yes, sends another webhook request
5. Client shows notification if new webhook sent
6. Adjusts refresh interval based on new lead count

### Visual Feedback
- **Header Badge:** 
  - "📋 42 leads - Requesting More..." (orange, animated)
  - "📋 75 leads" (green, stable)
- **Toast Notifications:** Appear when webhooks are sent
- **Console Logging:** Detailed logs for debugging

## Benefits

1. **No Manual Intervention:** Agents don't need to request more leads manually
2. **Automatic Lead Assignment:** System requests leads before queue runs dry
3. **No Page Refresh Required:** Lead queue updates in background
4. **Smart Polling:** Checks more frequently when leads are low
5. **Visual Feedback:** Clear indicators of system status
6. **Seamless Integration:** Works with existing Call Connector Pro UI

## Configuration

### Threshold Setting
The 50-lead threshold is defined in two places:
- **Server:** `server/routes.ts` line 15771
  ```typescript
  if (leads.length < 50) {
  ```
- **Client Refresh Logic:** Both components use the same threshold

### Refresh Intervals
Configure in client components:
```typescript
const refreshInterval = leadCount < 50 ? 10000 : 30000; // 10s or 30s
```

## Monitoring

### Server Logs
Watch for these log messages:
```
📤 AUTO-ASSIGNMENT: Agent user@example.com has 42 leads (< 50), requesting more via Lead Sync API...
📤 Sending bulk assignment request to Lead Sync API: {agentEmail: "...", requestedCount: 8, ...}
✅ AUTO-ASSIGNMENT: Lead Sync API assigned 50 leads to user@example.com
📊 Assignment Details: {agentMarkets: ["Veteran"], agentStates: 46, totalAvailable: 1000, afterMarketFilter: 1000}
❌ AUTO-ASSIGNMENT: Lead Sync API failed with status 500: Error message
```

### Client Logs
Watch for these log messages:
```
🚀 REACT QUERY: Fetching leads for user@example.com
✅ REACT QUERY: Received data: {success: true, leads: [...], leadsAssigned: 50, ...}
📤 AUTO-ASSIGNMENT: Webhook sent for user@example.com - 50 leads assigned
⏱️ AUTO-REFRESH: Setting up check in 10s (42 leads)
🔄 AUTO-REFRESH: Checking for new leads (current: 42)
```

## Testing

### Test Scenarios
1. **Low Lead Count:**
   - Ensure agent has < 50 leads
   - Load Call Connector Pro
   - Verify webhook is sent
   - Check toast notification appears
   - Verify badge shows "Requesting More..."

2. **High Lead Count:**
   - Ensure agent has ≥ 50 leads
   - Load Call Connector Pro
   - Verify no webhook is sent
   - Badge should be green without animation

3. **Dynamic Refresh:**
   - Start with < 50 leads
   - Wait for refresh (10 seconds)
   - New leads should load automatically
   - Once ≥ 50 leads, refresh slows to 30 seconds

### Manual Testing
```bash
# Check server logs
tail -f logs/server.log | grep "AUTO-ASSIGNMENT"

# Check client console
# Open browser DevTools → Console
# Filter by "AUTO" or "REFRESH"
```

## Troubleshooting

### Webhook Not Sending
1. Check agent email is correctly mapped to associate_id
2. Verify Lead Sync API endpoint is accessible: https://lead-sync-mmandella.replit.app/api/bulk-assign-leads
3. Ensure Replit service is running and accessible
4. Review server logs for error messages
5. Check network connectivity to Replit

### Leads Not Updating
1. Verify auto-refresh interval is running
2. Check browser console for errors
3. Ensure React Query is not disabled
4. Verify server endpoint is responding

### Badge Not Showing Correct Status
1. Check lead count calculation
2. Verify `needsMoreLeads` flag in API response
3. Check component state updates

## Future Enhancements

### Potential Improvements
1. **Configurable Threshold:** Make 50-lead threshold adjustable per agent
2. **Lead Priority:** Request specific types of leads based on agent performance
3. **Rate Limiting:** Prevent excessive webhook calls
4. **Retry Logic:** Automatic retry if webhook fails
5. **Admin Dashboard:** Monitor webhook activity and lead distribution
6. **Agent Preferences:** Let agents set their preferred lead queue size

## Related Files
- `server/routes.ts` - Server-side webhook logic
- `client/src/components/outbound-dialer/CallConnectorPro.tsx` - Primary client component
- `client/src/components/outbound-dialer/OutboundDialerInterface.tsx` - Alternative client component
- `server/real-billing-service.ts` - Related webhook functionality

## Support
For issues or questions, contact the development team or check the console logs for detailed error messages.

