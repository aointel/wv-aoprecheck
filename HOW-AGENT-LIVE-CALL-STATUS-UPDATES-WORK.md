# How `agent_live_call_status` Table Gets Updated - Complete Flow

## Overview

The `agent_live_call_status` table tracks agent presence and call state with 4 possible statuses:
- `ready` - Agent is online and available
- `in_call` - Agent is currently on a call
- `wrap_up` - Agent finished call, entering post-call notes/disposition
- `offline` - Agent is logged out

---

## Status Update Flow - Complete Breakdown

### 1. **Agent Goes Online** → Status: `ready`

#### Frontend Trigger:
**File:** `client/src/components/UsageHeartbeat.tsx`

When agent logs in:
1. `UsageHeartbeat` component mounts
2. Calls `/api/agent/online` **ONCE** (first time only)
3. Then calls `/api/usage/heartbeat` immediately
4. Then calls `/api/usage/heartbeat` every 60 seconds

**Code:**
```typescript
// First call - explicit "I'm online"
await fetch('/api/agent/online', {
  method: 'POST',
  body: JSON.stringify({ agent_email: authState.user?.email })
});

// Then heartbeat every 60 seconds
await fetch('/api/usage/heartbeat', {
  method: 'POST',
  body: JSON.stringify({ agentEmail: authState.user?.email, sessionId })
});
```

#### Backend Endpoint 1: `/api/agent/online`
**File:** `server/routes.ts` (lines 20848-20930)

**What it does:**
1. Normalizes email to lowercase
2. Checks CCPRO access:
   - First checks `customers` table `CCPRO` column
   - If false/null, checks `connectnow_subscriptions` table
   - Sets `ccpro_enabled` flag based on subscription (professional/elite + active/trialing)
3. **UPSERTS** to `agent_live_call_status`:
   ```javascript
   .upsert({
     agent_email: normalizedEmail,
     status: 'ready',  // ← Always sets to 'ready'
     last_heartbeat_at: now.toISOString(),
     updated_at: now.toISOString(),
     ccpro_enabled: ccproEnabled
   }, { onConflict: 'agent_email' })
   ```

**Key Point:** This endpoint **ALWAYS updates**, even if CCPRO is false. It just sets `ccpro_enabled` correctly.

#### Backend Endpoint 2: `/api/usage/heartbeat`
**File:** `server/routes.ts` (lines 21050-21161)

**What it does:**
1. Normalizes email
2. Checks if entry exists (for logging)
3. Checks CCPRO access (same logic as above)
4. **UPSERTS** to `agent_live_call_status`:
   ```javascript
   .upsert({
     agent_email: normalizedEmail,
     status: 'ready',  // ← Always sets to 'ready' (heartbeat = agent is available)
     last_heartbeat_at: now.toISOString(),
     updated_at: now.toISOString(),
     ccpro_enabled: ccproEnabled
   }, { onConflict: 'agent_email' })
   ```

**Frequency:** Every 60 seconds while agent is logged in

---

### 2. **Agent Powers On WebRTC** → Status: `ready`

#### Frontend Trigger:
**File:** `client/src/components/outbound-dialer/CallConnectorPro.tsx` (lines 590-615)

When agent clicks "Power On" button:
```typescript
const powerOn = async () => {
  await fetch('/agent/presence', {
    method: 'POST',
    body: JSON.stringify({
      agent_email: authState.user.email,
      status: 'ready'  // ← Explicitly sets to 'ready'
    })
  });
};
```

#### Backend Endpoint: `/agent/presence`
**File:** `server/routes.ts` (lines 20932-21048)

**What it does:**
1. Validates status is one of: `ready`, `in_call`, `wrap_up`, `offline`
2. Checks CCPRO access
3. **UPSERTS** to `agent_live_call_status`:
   ```javascript
   .upsert({
     agent_email: normalizedEmail,
     status: status,  // ← Uses whatever status was sent
     last_heartbeat_at: now.toISOString(),
     updated_at: now.toISOString(),
     ccpro_enabled: ccproEnabled
   }, { onConflict: 'agent_email' })
   ```

**Key Point:** This endpoint accepts **any valid status** and updates accordingly.

---

### 3. **Call Starts** → Status: `in_call`

#### Frontend Trigger:
**File:** `server/routes.ts` (lines 16680-16770)

When agent initiates an outbound call via Twilio:
1. Call is created via `/api/call-connector-pro/start-call`
2. Backend automatically updates status

#### Backend Update:
**File:** `server/routes.ts` (lines 16713-16770)

**What it does:**
1. After Twilio call is created successfully
2. Checks CCPRO access
3. **UPSERTS** to `agent_live_call_status`:
   ```javascript
   .upsert({
     agent_email: normalizedEmail,
     status: 'in_call',  // ← Sets to 'in_call'
     last_heartbeat_at: now.toISOString(),
     updated_at: now.toISOString(),
     ccpro_enabled: ccproEnabled
   }, { onConflict: 'agent_email' })
   ```

**Trigger:** Automatic when `/api/call-connector-pro/start-call` succeeds

---

### 4. **Call Ends** → Status: `wrap_up`

#### Frontend Trigger:
**File:** `server/routes.ts` (lines 15820-15905)

When Twilio webhook reports call completed/failed:
1. Twilio sends webhook to `/api/twilio/status-callback`
2. Backend processes call end event
3. Backend automatically updates status

#### Backend Update:
**File:** `server/routes.ts` (lines 15833-15905)

**What it does:**
1. When `CallStatus === 'completed'` or `'failed'`
2. Checks CCPRO access
3. **UPDATES** (then falls back to UPSERT if no rows updated):
   ```javascript
   // First try UPDATE
   .update({
     status: 'wrap_up',  // ← Sets to 'wrap_up'
     last_heartbeat_at: now.toISOString(),
     updated_at: now.toISOString(),
     ccpro_enabled: ccproEnabled
   })
   .eq('agent_email', agentEmail)
   
   // If no rows updated, try UPSERT
   .upsert({
     agent_email: agentEmail,
     status: 'wrap_up',
     last_heartbeat_at: now.toISOString(),
     updated_at: now.toISOString(),
     ccpro_enabled: ccproEnabled
   }, { onConflict: 'agent_email' })
   ```

**Trigger:** Automatic when Twilio webhook fires for call completion

---

### 5. **Agent Goes Offline** → Status: `offline`

#### Frontend Trigger:
**Currently:** **NOT IMPLEMENTED** ❌

**What SHOULD happen:**
- Frontend should call `/agent/presence` with `status: 'offline'` when:
  - User logs out
  - Browser closes
  - Session expires

**What ACTUALLY happens:**
- Status stays as last known status (`ready`, `in_call`, or `wrap_up`)
- No explicit offline event

---

## CCPRO Flag Logic

Every update checks CCPRO access and sets `ccpro_enabled` flag:

### Step 1: Check `customers` table
```javascript
const { data: customerData } = await supabaseAdmin
  .from('customers')
  .select('company_email, personal_email, CCPRO')
  .or(`company_email.eq.${email},personal_email.eq.${email}`)
  .maybeSingle();

let ccproEnabled = customerData?.CCPRO === true || 
                   customerData?.CCPRO === 'true' || 
                   customerData?.CCPRO === 1;
```

### Step 2: Fallback to `connectnow_subscriptions` table
```javascript
if (!ccproEnabled) {
  const { data: subscriptionData } = await supabaseAdmin
    .from('connectnow_subscriptions')
    .select('plan, status')
    .eq('user_email', email)
    .maybeSingle();

  if (subscriptionData) {
    ccproEnabled = 
      (subscriptionData.status === 'active' || subscriptionData.status === 'trialing') &&
      (subscriptionData.plan === 'professional' || subscriptionData.plan === 'elite');
  }
}
```

**Result:** `ccpro_enabled` is set to `true` if:
- `customers.CCPRO = true` OR
- Subscription is `professional`/`elite` AND status is `active`/`trialing`

---

## Summary: All Update Paths

| Event | Frontend | Backend Endpoint | Status Set | Frequency |
|-------|----------|------------------|------------|-----------|
| Agent logs in | `UsageHeartbeat.tsx` | `/api/agent/online` | `ready` | Once on login |
| Heartbeat | `UsageHeartbeat.tsx` | `/api/usage/heartbeat` | `ready` | Every 60 seconds |
| Power On WebRTC | `CallConnectorPro.tsx` | `/agent/presence` | `ready` | When button clicked |
| Call starts | Automatic | `/api/call-connector-pro/start-call` | `in_call` | When call initiated |
| Call ends | Twilio webhook | `/api/twilio/status-callback` | `wrap_up` | When call completes |
| Agent offline | ❌ **NOT IMPLEMENTED** | N/A | `offline` | Never |

---

## Current Issues

1. **No explicit offline event** - Status never changes to `offline`
2. **Heartbeat always sets `ready`** - Even if agent is in `wrap_up`, heartbeat overwrites it
3. **Wrap-up completion not tracked** - No event when agent finishes post-call notes
4. **Multiple systems** - Heartbeat, presence, and call events can conflict

---

## Database Operations

All updates use **UPSERT** (INSERT or UPDATE):
```javascript
.upsert({
  agent_email: email,      // PRIMARY KEY
  status: 'ready',
  last_heartbeat_at: now,
  updated_at: now,
  ccpro_enabled: true/false
}, {
  onConflict: 'agent_email'  // If exists, UPDATE; if not, INSERT
})
```

**Table Schema:**
- `agent_email` (PRIMARY KEY, text)
- `status` (text, CHECK: 'ready' | 'in_call' | 'wrap_up' | 'offline')
- `last_heartbeat_at` (timestamptz)
- `updated_at` (timestamptz)
- `ccpro_enabled` (boolean)

---

## Why Status Might Not Update

1. **CCPRO check fails silently** - If subscription check fails, update still happens but `ccpro_enabled` might be wrong
2. **Email mismatch** - Email in subscription table doesn't match agent email
3. **Heartbeat overwrites** - If agent is in `wrap_up`, next heartbeat (60s) will change it back to `ready`
4. **No error handling** - Some endpoints don't log errors properly
5. **Frontend not calling endpoints** - If `UsageHeartbeat` component doesn't mount, no updates happen

