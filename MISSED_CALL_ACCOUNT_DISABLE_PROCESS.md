# Missed Call Account Disabling Process

## Overview
The system automatically disables (pauses) accounts when they have missed calls to prevent further charges and protect the agent's credits.

## How It Works

### 1. **Missed Call Detection**
Missed calls are detected when:
- A `BLASTER` event occurs (call attempt made)
- **NO** `PICK_UP`, `PICKED`, or `CONNECT` event occurs (call never answered)
- Call attempt lasted at least **10 seconds** (filters out very short attempts)
- Only charged **once per unique Agent + Phone combination**

**Detection Sources:**
- CSV files from VDP (Voice Dialer Platform) call blaster system
- `vdp_calls_BLASTPICK` table in database
- Processed by `server/real-billing-service.ts` and `server/missed-call-billing-from-csv.ts`

### 2. **Billing Transaction Creation**
When a missed call is detected:
- A `billing_transaction` record is created with:
  - `transaction_type = 'missed_call'`
  - `agent_email` (required)
  - `amount_usd = $4.00`
  - `credits_charged = 4`
  - `transaction_id` (unique identifier: `missed-call-{phone}-{date}-{time}`)

**Location:** `billing_transactions` table

### 3. **Account Pausing Process**

The account is paused **immediately** when a missed call billing transaction is created:

**Process Flow:**
1. **Check if already paused** (`isAccountAlreadyPaused`)
   - Queries `customers` table for `VDPACTIVE` status
   - If `VDPACTIVE = 'INACTIVE'`, skip (already paused)

2. **Disable VDP** (`pauseAccountForMissedCall`)
   - Updates `customers` table: `VDPACTIVE = 'INACTIVE'`
   - This disables inbound/VDP connections to prevent further missed call charges
   - Location: `server/process-missed-call-billing-transactions.ts` and `server/missed-call-billing-from-csv.ts`

3. **Create Notification**
   - Creates `agent_notifications` record with:
     - Title: `🚨 Account Paused - Missed Call Charge`
     - Message explaining the charge and pause
     - `metadata.account_paused = true`
     - `metadata.requires_policy_review = true`

4. **Create Missed Call Notification Record**
   - Triggers VDP alert system
   - Location: `server/missed-call-notification-service.ts`

### 4. **Processing Script**

**Main Processing Script:** `server/process-missed-call-billing-transactions.ts`

This script:
- Queries `billing_transactions` for `transaction_type = 'missed_call'`
- Processes each transaction that hasn't been processed yet
- Checks if transaction already processed (via `agent_notifications.metadata.account_paused`)
- For NEW transactions:
  1. Pauses account (if not already paused)
  2. Creates missed call notification record
  3. Updates/creates billing notification

**Run manually:**
```bash
tsx server/process-missed-call-billing-transactions.ts
```

### 5. **How the System Determines "Keeps Missing Calls"**

**Current Logic:**
- **ONE missed call = Account paused immediately**
- The system does NOT wait for multiple missed calls
- Each missed call triggers an immediate pause (if not already paused)

**No Pattern Detection:**
- The system does NOT currently:
  - Count missed calls over time
  - Detect patterns (e.g., "3 missed calls in 24 hours")
  - Use thresholds (e.g., "pause after 5 missed calls")
  - Track missed call frequency

**Why:**
- Each missed call costs $4.00
- Immediate pause prevents further charges
- Agent must review policy and manually re-enable

### 6. **Account Re-enabling**

To re-enable an account:
- Agent must review the missed call policy
- Manually set `VDPACTIVE = 'ACTIVE'` in `customers` table
- Or use admin interface to re-enable

**Note:** The system does NOT automatically re-enable accounts.

## Database Tables Involved

1. **`billing_transactions`**
   - Stores missed call charges
   - `transaction_type = 'missed_call'`
   - `agent_email` identifies the account

2. **`customers`**
   - `VDPACTIVE` field controls account status
   - `'ACTIVE'` = Account enabled
   - `'INACTIVE'` = Account paused/disabled

3. **`agent_notifications`**
   - Stores pause notifications
   - `metadata.account_paused = true` indicates processed transaction
   - Used to prevent duplicate processing

## Key Functions

- `pauseAccountForMissedCall(agentEmail)` - Disables VDP by setting `VDPACTIVE = 'INACTIVE'`
- `isAccountAlreadyPaused(agentEmail)` - Checks if account is already paused
- `isTransactionAlreadyProcessed(transactionId, agentEmail)` - Checks if transaction was already processed
- `processMissedCallBillingTransactions()` - Main processing function

## Summary

**The system disables accounts on the FIRST missed call**, not after multiple missed calls. This is a protective measure to prevent further charges. There is no threshold or pattern detection - each missed call immediately triggers a pause if the account isn't already paused.

