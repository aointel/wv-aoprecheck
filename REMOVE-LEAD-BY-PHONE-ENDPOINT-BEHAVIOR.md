# `/api/webhook/remove-lead-by-phone` Endpoint Behavior

## URL
`https://aoirail-production.up.railway.app/api/webhook/remove-lead-by-phone`

## Method
`POST`

## Expected Payload
```json
{
  "phone": "<contact.localPhone>",
  "dnc": <dnc>,           // Optional: boolean (true/false)
  "session": "<session>", // Optional: string
  "campaign": "<campaign>" // Optional: string
}
```

## What Happens Step-by-Step

### 1. **Request Validation**
- ✅ Checks if `phone` field is provided
- ✅ Validates phone number format (must be at least 10 digits after normalization)
- ✅ Normalizes phone number (removes all non-digits: `"1-555-123-4567"` → `"15551234567"`)

### 2. **Lead Lookup**
- Searches `masterlead` table for lead with matching phone number
- Tries multiple formats:
  - Exact match: `cleanPhone`
  - With country code: `1${cleanPhone}`
  - Without country code: `cleanPhone.substring(1)` (if starts with 1)

### 3. **If Lead Found**
- ✅ Updates lead with:
  - `TaalkResolve = true` (ALWAYS set - this freezes the lead)
  - `updated_at = current timestamp`
  - If `dnc = true`: Also sets `dnc = true` and `cnresolution = 'dnc'`

### 4. **Response (Success)**
```json
{
  "success": true,
  "message": "Lead marked as TaalkResolve successfully - lead is now frozen and will not be called, assigned, or displayed",
  "leadId": 123456,
  "taalk_lead_id": "18792580",
  "firstName": "KYLE",
  "lastName": "FARLEY",
  "phone": "5173583772",
  "TaalkResolve": true,
  "dnc": false,
  "session": "test-session-...",
  "campaign": "Test Campaign",
  "updatedAt": "2026-01-15T00:45:26.358Z"
}
```

### 5. **What Happens to the Lead After `TaalkResolve = true`**

#### ✅ **FROZEN - Completely Invisible to System:**
- ❌ **NOT assigned** to any agent (excluded from all assignment queries)
- ❌ **NOT displayed** in any agent queue
- ❌ **NOT shown** in Call Connector Pro
- ❌ **NOT available** for dialing
- ❌ **NOT counted** in callable lead counts
- ❌ **NOT included** in hotlead auto-assignment
- ❌ **NOT included** in manual lead requests
- ❌ **NOT shown** in live call board lead counts

#### ✅ **Still in Database:**
- Lead record remains in `masterlead` table
- All historical data preserved
- Can be queried directly if needed
- Just excluded from all active operations

### 6. **Error Responses**

#### 400 Bad Request - Missing Phone
```json
{
  "success": false,
  "error": "Missing required field: phone"
}
```

#### 400 Bad Request - Invalid Phone Format
```json
{
  "success": false,
  "error": "Invalid phone number format"
}
```

#### 404 Not Found - Lead Not Found
```json
{
  "success": false,
  "error": "No lead found with phone number: 15551234567",
  "phone": "15551234567",
  "dnc": false,
  "session": "...",
  "campaign": "..."
}
```

#### 500 Internal Server Error - Database Error
```json
{
  "success": false,
  "error": "Failed to update lead",
  "details": "Error message",
  "leadId": 123456
}
```

## Example Test

### Request:
```bash
curl -X POST https://aoirail-production.up.railway.app/api/webhook/remove-lead-by-phone \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5173583772",
    "dnc": false,
    "session": "test-session-123",
    "campaign": "Globe Market"
  }'
```

### Success Response:
```json
{
  "success": true,
  "message": "Lead marked as TaalkResolve successfully - lead is now frozen and will not be called, assigned, or displayed",
  "leadId": 542109,
  "taalk_lead_id": "18792580",
  "firstName": "KYLE",
  "lastName": "FARLEY",
  "phone": "5173583772",
  "TaalkResolve": true,
  "dnc": false,
  "session": "test-session-123",
  "campaign": "Globe Market",
  "updatedAt": "2026-01-15T00:45:26.358Z"
}
```

## Summary

**When `TaalkResolve = true` is set:**
- Lead is **FROZEN** - completely removed from active operations
- Lead is **INVISIBLE** - won't appear in any queues, assignments, or counts
- Lead is **PRESERVED** - still exists in database for historical records
- Lead is **IMMUTABLE** - cannot be called, assigned, or displayed until `TaalkResolve` is manually set back to `false`

This is effectively a "soft delete" that freezes the lead in time while preserving all data.
