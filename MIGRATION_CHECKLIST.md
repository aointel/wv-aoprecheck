# Missed Call Billing - Migration Checklist

## Files to Copy

### From this repo:
1. `server/missed-call-billing-from-csv.ts` - Main script
2. `server/missed-call-billing-scheduler.ts` - Scheduler (optional)

### Template files created for you:
1. `STANDALONE_SUPABASE_CONFIG.ts` - Supabase config (update import path)
2. `STANDALONE_PACKAGE_JSON.json` - Package.json template
3. `MISSED_CALL_BILLING_SETUP.md` - Complete documentation

## Quick Setup Steps

### 1. Install Dependencies
```bash
npm install @supabase/supabase-js date-fns node-cron tsx typescript @types/node
```

### 2. Set Environment Variables
```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_KEY=your-service-role-key  # MUST be service role key
```

### 3. Update Import in Script
In `missed-call-billing-from-csv.ts`, change:
```typescript
import { supabaseAdmin } from './supabase';
```
To:
```typescript
import { supabaseAdmin } from './STANDALONE_SUPABASE_CONFIG';
```

### 4. Run Database Migration
Execute `server/add-missed-call-transaction-type.sql` on your database

### 5. Test Run
```bash
tsx missed-call-billing-from-csv.ts
```

### 6. Run with Scheduler (Optional)
```typescript
import { missedCallBillingScheduler } from './missed-call-billing-scheduler';
missedCallBillingScheduler.start();
```

## Database Tables Required

See `MISSED_CALL_BILLING_SETUP.md` for complete table schema requirements.

### Required Tables:
- `vdp_calls_BLASTPICK` (READ)
- `billing_transactions` (READ/WRITE)
- `agent_notifications` (WRITE)
- `user_credits` (READ)
- `customers` (READ)

## Configuration

- **Billing Amount**: $4.00 per missed call (edit `MISSED_CALL_AMOUNT` constant)
- **Date Range**: Last 7 days (edit in `queryMissedCallsFromDatabase`)
- **Scheduler Frequency**: Every 5 minutes (edit cron schedule)

## Verification

After setup, verify:
1. ✅ Script runs without errors
2. ✅ Creates billing transactions in `billing_transactions` table
3. ✅ Creates notifications in `agent_notifications` table
4. ✅ No duplicate transactions (check `transaction_id` uniqueness)


