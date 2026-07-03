# Notification System Flow

## How Notifications Are Created

Notifications are created by inserting records into the `agent_notifications` table in Supabase. Here's how different notification types are generated:

### 1. **Billing Transaction Notifications** 
**Location:** `server/billing-transaction-sync.ts`

When billing transactions are synced (AO Connect, PreCheck, Recruit charges), the system automatically creates notifications:

```typescript
// Called after inserting a billing transaction
await this.createBillingNotification(
  agentEmail,
  'connect' | 'precheck' | 'recruit',
  amountUsd,
  creditsCharged,
  leadName,
  transactionId
);
```

**Flow:**
1. `BillingTransactionSync` syncs transactions from source tables (`vdp_calls`, `precheck_calls`, etc.)
2. After inserting a transaction into `billing_transactions` table
3. Calls `createBillingNotification()` which inserts into `agent_notifications`
4. Notification appears in real-time via Supabase Realtime subscription

### 2. **Credit Low Notifications**
**Location:** `server/credit-service.ts` (likely)

When an agent's credit balance drops below a threshold, a notification is created.

### 3. **Missed Call Notifications**
**Location:** `server/missed-call-notification-service.ts`

When missed calls are detected, notifications are created for agents.

### 4. **System Notifications**
Created manually via API endpoints or admin scripts.

### 5. **Appointment & Waiting Room Notifications**
Created when appointments are scheduled or clients enter waiting rooms.

---

## Notification Structure

```typescript
{
  agent_email: string,           // Lowercase email
  notification_type: string,     // 'billing_transaction', 'credit_low', 'missed_call', etc.
  title: string,                 // Display title
  message: string,               // Display message
  read: boolean,                // Default: false
  urgent: boolean,              // Default: false
  actionUrl?: string,           // Optional URL to navigate to
  metadata: {                    // Additional data
    transaction_id?: string,
    amount_usd?: number,
    lead_name?: string,
    // ... other fields
  }
}
```

---

## How Frontend Receives Notifications

1. **Real-time Subscription** (Primary):
   - `HeaderToolbar.tsx` subscribes to Supabase Realtime
   - Listens for `INSERT` events on `agent_notifications` table
   - Filters by `agent_email`
   - Triggers sound, toast, and visual alerts

2. **Polling Fallback** (Backup):
   - Queries notifications every 10 seconds
   - Compares notification IDs to detect new ones
   - Triggers alerts if real-time doesn't work

3. **Display**:
   - Badge count on bell icon
   - Toast notification popup
   - Sound alert (chime)
   - Bell icon pulse animation
   - Dropdown menu with all notifications

---

## Creating Notifications Programmatically

### Via Supabase Client (Server-side):
```typescript
await supabaseAdmin
  .from('agent_notifications')
  .insert({
    agent_email: 'agent@example.com',
    notification_type: 'billing_transaction',
    title: 'AO Connect Charge',
    message: 'You were charged $2.50 (2 credits)',
    read: false,
    urgent: false,
    metadata: {
      transaction_id: 'connect-123',
      amount_usd: 2.50,
      credits_charged: 2,
    }
  });
```

### Via Test Script:
```bash
node test-single-notification.cjs
```

---

## Notification Types

- `billing_transaction` - Charges for AO Connect, PreCheck, Recruit
- `credit_low` - Low credit balance warnings
- `missed_call` - Missed call alerts
- `system` - System updates and announcements
- `appointment` - Appointment reminders
- `waiting_room` - Client in waiting room alerts

































