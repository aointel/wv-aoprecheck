# Missed Call Billing Script - Setup Guide

## Overview
This script processes missed calls from the `vdp_calls_BLASTPICK` database table and creates billing transactions at $4.00 per missed call.

**Runs every 5 minutes** to process missed calls in real-time.

## Required Files
1. `server/missed-call-billing-from-csv.ts` - Main processing script
2. `server/missed-call-billing-scheduler.ts` - Scheduler wrapper

## Environment Variables Required
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key  # MUST be service role key for writes
SUPABASE_ANON_KEY=your-anon-key  # Optional, not used by this script
```

## Database Tables Required

### 1. `vdp_calls_BLASTPICK` (READ)
**Required columns:**
- `id` - Primary key
- `event` - Event type (must be 'BLASTER' or 'PICK_UP')
- `phone` - Phone number (text)
- `agent` - Agent ID/associate ID (text)
- `time` - Timestamp (timestamp)
- `params` - JSON params (optional, for lead name extraction)

**Query:** Script queries for:
- `event = 'BLASTER'` events
- `event = 'PICK_UP'` events
- Date range: Last 7 days (or custom date filter)

### 2. `billing_transactions` (READ/WRITE)
**Required columns:**
- `transaction_id` - Unique identifier (text, primary key)
- `transaction_type` - Must include 'missed_call' (text)
- `agent_email` - Agent email (text)
- `agent_associate_id` - Associate ID (integer, nullable)
- `agent_name` - Agent name (text, nullable)
- `transaction_date` - Transaction date (timestamp)
- `amount_usd` - Amount in USD (numeric)
- `credits_charged` - Credits charged (numeric)
- `lead_name` - Lead name (text, nullable)
- `lead_phone` - Lead phone (text, nullable)
- `source_table` - Source table name (text, nullable)
- `description` - Description (text, nullable)
- `metadata` - JSON metadata (jsonb, nullable)

**Constraint:** `transaction_type` must allow 'missed_call' value

### 3. `agent_notifications` (WRITE)
**Required columns:**
- `agent_email` - Agent email (text)
- `notification_type` - Type (text)
- `title` - Title (text)
- `message` - Message (text)
- `read` - Read status (boolean)
- `metadata` - JSON metadata (jsonb, nullable)
- `created_at` - Created timestamp (timestamp, auto)

### 4. `user_credits` (READ)
**Required columns:**
- `email` - Email (text)
- `associate_id` - Associate ID (integer)
- `name` - Name (text)

**Used for:** Agent lookup by associate ID

### 5. `customers` (READ)
**Required columns:**
- `company_email` - Company email (text)
- `personal_email` - Personal email (text)
- `associate_id` - Associate ID (integer)
- `first_name` - First name (text)
- `last_name` - Last name (text)

**Used for:** Fallback agent lookup by associate ID

## NPM Dependencies
```json
{
  "@supabase/supabase-js": "^2.x.x",
  "date-fns": "^2.x.x or ^3.x.x",
  "node-cron": "^3.x.x"
}
```

## How It Works

### 1. Identifies Missed Calls
- Queries all `BLASTER` events from last 7 days
- Queries all `PICK_UP` events from same period
- A missed call = BLASTER event with NO PICK_UP for same phone/date

### 2. Agent Lookup
- Looks up agent email by associate ID from `user_credits` table
- Falls back to `customers` table if not found
- Requires email to create billing transaction

### 3. Duplicate Prevention
- Checks `billing_transactions` for existing `transaction_id`
- Format: `missed-call-{phone}-{date}-{time}`
- Skips if duplicate exists

### 4. Creates Transaction
- Inserts into `billing_transactions` with:
  - Amount: $4.00
  - Credits: 4
  - Transaction type: 'missed_call'

### 5. Creates Notification
- Inserts into `agent_notifications` to notify agent

## Usage

### Run Once (Manual)
```bash
tsx server/missed-call-billing-from-csv.ts
```

### Run for Specific Date
```bash
tsx server/missed-call-billing-from-csv.ts 2025-12-06
```

### Run with Scheduler (Every 5 minutes)
```typescript
import { missedCallBillingScheduler } from './missed-call-billing-scheduler';

missedCallBillingScheduler.start();
```

## Configuration

### Change Billing Amount
Edit `MISSED_CALL_AMOUNT` constant:
```typescript
const MISSED_CALL_AMOUNT = 4.00; // Change this
```

### Change Date Range
Edit in `queryMissedCallsFromDatabase()`:
```typescript
const cutoffDate = dateFilter ? null : subDays(new Date(), 7); // Change 7 to desired days
```

### Change Scheduler Frequency
Edit in `missed-call-billing-scheduler.ts`:
```typescript
this.cronJob = cron.schedule('*/5 * * * *', ...); // Change */5 to desired minutes
```

## Database Schema Requirements

### Allow 'missed_call' transaction type
```sql
ALTER TABLE public.billing_transactions
DROP CONSTRAINT IF EXISTS billing_transactions_transaction_type_check;

ALTER TABLE public.billing_transactions
ADD CONSTRAINT billing_transactions_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY['precheck'::text, 'recruit'::text, 'connect'::text, 'purchase'::text, 'refund'::text, 'adjustment'::text, 'missed_call'::text]));
```

## Key Logic

### Missed Call Definition
- Has `BLASTER` event
- NO `PICK_UP` event for same phone on same date
- Has agent ID in the `agent` column
- Counts blaster events (ring cycles) from already-fetched data

### Billing Amount
- $4.00 per missed call (4 credits)
- Billed per unique phone-date-time combination

## Performance Notes
- Processes last 7 days of data
- Limits to 10,000 events max per run
- Uses pagination for large datasets
- Minimal logging (1 summary log per run)
- No database queries inside loops

## Error Handling
- Gracefully handles missing agent emails
- Skips duplicates automatically
- Returns empty array on database errors
- Scheduler continues even if one run fails


