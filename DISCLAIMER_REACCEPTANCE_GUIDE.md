# Call Connector Pro Disclaimer Re-Acceptance Guide

## Where Acceptance is Tracked

### 1. **Database (Source of Truth)**
- **Table**: `agent_profiles`
- **Column**: `call_connector_pro_disclaimer_accepted_at`
- **Location**: Supabase PostgreSQL database
- **Purpose**: Permanent record of acceptance

### 2. **Browser localStorage (Cache/Fallback)**
- **Key**: `call_connector_pro_disclaimer_accepted`
- **Value**: `'true'` (string)
- **Location**: User's browser localStorage
- **Purpose**: Performance cache to avoid API calls on every page load

## How to Force Re-Acceptance

### Step 1: Clear Database
Run the SQL script to clear all acceptances in the database:

```sql
UPDATE agent_profiles
SET call_connector_pro_disclaimer_accepted_at = NULL
WHERE call_connector_pro_disclaimer_accepted_at IS NOT NULL;
```

**File**: `clear-ccpro-disclaimer-acceptances-supabase.sql`

### Step 2: Code Automatically Clears localStorage
The frontend code has been updated to:
- **When API returns `callConnectorProAccepted: false`**: Automatically clears localStorage and shows disclaimer
- **When API fails**: Clears localStorage and shows disclaimer (safe default)
- **When API returns `callConnectorProAccepted: true`**: Caches in localStorage

### How It Works Now

1. User visits `/connect` or `/dashboard/ao-recruit`
2. Frontend calls `/api/disclaimers/check-status?userEmail=...`
3. **If database says NOT accepted**:
   - Frontend clears `localStorage.removeItem('call_connector_pro_disclaimer_accepted')`
   - Shows disclaimer modal
4. **If database says accepted**:
   - Frontend caches in localStorage
   - Hides disclaimer modal

## Files Updated

The following components now properly handle re-acceptance:

1. `client/src/components/outbound-dialer/OutboundDialerInterface.tsx`
2. `client/src/components/outbound-dialer/RecruitOutboundDialerInterface.tsx`
3. `client/src/components/outbound-dialer/CallConnectorPro.tsx`
4. `client/src/components/outbound-dialer/LeadDisplay.tsx`

## Testing

After clearing the database:
1. Users will see the disclaimer modal on next visit
2. localStorage will be automatically cleared
3. Users must accept the disclaimer again
4. New acceptance will be saved to database and cached in localStorage

## Manual localStorage Clear (Optional)

If you need to manually clear localStorage for testing:
- Open browser DevTools (F12)
- Go to Application/Storage tab
- Find localStorage
- Delete `call_connector_pro_disclaimer_accepted` key

Or run in browser console:
```javascript
localStorage.removeItem('call_connector_pro_disclaimer_accepted');
```

