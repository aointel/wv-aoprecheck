# How Missed Calls Are Detected

## Detection Process

Missed calls are detected by analyzing CSV data from the VDP (Voice Dialer Platform) call blaster system.

### 1. **Data Source**
- CSV files containing call events from the VDP system
- Events include: `BLASTER` (call attempt), `PICK_UP`/`PICKED` (call answered), `END` (call ended)

### 2. **Detection Logic** (`server/real-billing-service.ts`)

```typescript
// Groups call attempts by unique Agent + Phone combination
uniqueCallAttempts.forEach((blasters, key) => {
  const [agentId, phone] = key.split('-');
  
  // Check if there's ANY PICK_UP for this Agent + Phone combination
  const hasAnyPickUp = allEvents.some(event => 
    event.event === 'PICK_UP' && 
    event.agent === agentId && 
    event.phone === phone
  );
  
  if (!hasAnyPickUp) {
    // This is a missed call
    const totalDuration = Math.round((lastBlaster.timestamp - firstBlaster.timestamp) / 1000);
    
    // Only bill if the call attempt lasted at least 10 seconds (shows real attempt)
    if (totalDuration >= 10) {
      // Bill $4.00 per unique missed call
    }
  }
});
```

### 3. **Criteria for Missed Call**

A call is considered "missed" if:
- ✅ Has `BLASTER` events (call was attempted)
- ❌ NO `PICK_UP`/`PICKED`/`CONNECT` events (call was never answered)
- ⏱️ Call attempt lasted at least **10 seconds** (filters out very short attempts)
- 📞 Only charged **once per unique Agent + Phone combination** (prevents duplicate billing)

### 4. **Billing**

- **Amount**: $4.00 per missed call
- **Storage**: Recorded in `billing_transactions` table with `transaction_type = 'missed_call'`
- **Deduplication**: Only one charge per Agent + Phone combination, even if multiple blaster cycles occurred

### 5. **Display in Billing Dashboard**

The billing API (`/api/billing/all-charges`) queries `billing_transactions` table:
- Filters by `agent_email` and date range
- Maps `transaction_type = 'missed_call'` to `type: 'AOI_MISSED'`
- Displays in the "Missed Calls" tab

### 6. **Additional Actions**

When a missed call is detected:
1. **Billing Transaction Created**: Recorded in `billing_transactions` table
2. **Account Paused**: VDP/inbound connections disabled to prevent further missed call charges
3. **Notification Sent**: Agent receives notification about the missed call
4. **Credit Deducted**: $4.00 deducted from agent's credits

## Files Involved

- `server/real-billing-service.ts` - Main detection logic
- `server/missed-call-billing-from-csv.ts` - CSV processing
- `server/routes.ts` - API endpoints for billing display
- `server/missed-call-billing-service.ts` - Billing service

## Example Flow

1. Agent receives a call via VDP system
2. System generates `BLASTER` events (call attempts)
3. Call rings for 15 seconds but no one answers
4. No `PICK_UP` event is generated
5. System detects: BLASTER events exist + No PICK_UP + Duration > 10s = **MISSED CALL**
6. $4.00 is charged to agent's account
7. Transaction appears in billing dashboard under "Missed Calls" tab

