# List of Changes to Apply One at a Time

## Change 1: Remove Excessive Logging from taalk-vdp-poller.ts
**File:** `server/taalk-vdp-poller.ts`
**Issue:** Excessive per-item logging during startup causing Railway rate limit issues
**Change:** Remove per-item console.log for associate ID mappings (line ~82), keep only summary log
**Risk:** Low - just removing logs

---

## Change 2: Fix missed-call-notification-scheduler.ts - Use call_status instead of status
**File:** `server/missed-call-notification-scheduler.ts`
**Issue:** Querying non-existent `status` column in `twilio_call_logs` table
**Change:** Line 97 - Change `.eq('status', 'no-answer')` to `.eq('call_status', 'no-answer')`
**Risk:** Medium - fixes schema error

---

## Change 3: Fix missed-call-notification-scheduler.ts - Remove notification_sent column
**File:** `server/missed-call-notification-scheduler.ts`
**Issue:** Querying and updating non-existent `notification_sent` column
**Changes:**
- Line 98 - Remove `.is('notification_sent', null)` filter
- Lines 207-212 - Remove entire `markAsNotified` function that updates `notification_sent`
**Risk:** Medium - fixes schema error

---

## Change 4: Fix billing-transaction-sync.ts - Remove agent_email/company_email from verification_sessions
**File:** `server/billing-transaction-sync.ts`
**Issue:** Querying non-existent `agent_email` and `company_email` columns in `verification_sessions`
**Changes:**
- Line 298 - Remove `agent_email` and `company_email` from select statement
- Line 346 - Change `session.agent_email || session.company_email` to `session.associate_id`
**Risk:** Medium - fixes schema error, changes data source

---

## Change 5: Fix timezone-helper.ts - Disable countPendingVerificationSessions
**File:** `server/timezone-helper.ts`
**Issue:** Function queries non-existent `agent_email` or `company_email` columns
**Change:** Lines 270-296 - Make function return 0 immediately with warning log
**Risk:** Low - disables functionality but prevents crash

---

## Change 6: Fix admin-service.ts - Handle missing admin_roles table
**File:** `server/admin-service.ts`
**Issue:** Crashes if `admin_roles` table doesn't exist
**Change:** Lines 121-135 - Add try-catch around role initialization loop
**Risk:** Low - graceful error handling

---

## Change 7: Fix routes.ts - Remove FTCRESTRICTED column queries
**File:** `server/routes.ts`
**Issue:** Querying non-existent `FTCRESTRICTED` column in `masterlead` table
**Changes:**
- Lines 11784-11785 - Remove `.or('ftcrestricted.is.null,ftcrestricted.neq.YES')` and `.or('FTCRESTRICTED.is.null,FTCRESTRICTED.is.not.true')`
- Lines 12610-12611 - Remove same filters
- Lines 12631-12632 - Remove same filters
- Add comments indicating FTC filtering handled in frontend
**Risk:** High - changes business logic, removes FTC filtering

---

## Change 8: Fix ftc-queue-cleaner.ts - Remove FTCRESTRICTED column operations
**File:** `server/ftc-queue-cleaner.ts`
**Issue:** Selecting and updating non-existent `FTCRESTRICTED` column
**Changes:**
- Line 82 - Remove `FTCRESTRICTED` from select statement
- Lines 101-140 - Disable core logic, add return statement with warning
**Risk:** High - disables FTC queue cleaner functionality

---

## Change 9: Migrate missed-call-notification-service.ts to agent_notifications table
**File:** `server/missed-call-notification-service.ts`
**Issue:** Using non-existent `missed_call_notifications` table
**Changes:**
- `processPendingNotifications()` - Change from `missed_call_notifications` to `agent_notifications` with `notification_type = 'missed_call'` and `read = false`
- `createMissedCallNotification()` - Insert into `agent_notifications` with proper structure
- `markNotificationSent()` - Update `read = true` in `agent_notifications`
- `getNotificationStats()` - Query `agent_notifications` for stats
- `sendNotificationForMissedCall()` - Extract data from `agent_notifications` metadata
**Risk:** High - major schema change, requires table to exist

---

## Change 10: Update missed-call-notification-scheduler.ts to create agent_notifications records
**File:** `server/missed-call-notification-scheduler.ts`
**Issue:** Should create records in Supabase when processing missed calls
**Change:** In `sendMissedCallNotification()` - Add insert into `agent_notifications` table before sending emails
**Risk:** Medium - adds new functionality

---

## Change 11: Create agent_notifications table SQL
**File:** `create-agent-notifications-table.sql` (new file)
**Issue:** Table doesn't exist in Supabase
**Change:** Create SQL schema for `agent_notifications` table with all required fields
**Risk:** Low - just SQL, needs to be run in Supabase

---

## Change 12: Add ccpro_enabled field to agent_live_call_status table
**File:** `create-agent-live-call-status-table.sql`
**Issue:** Missing `ccpro_enabled` column that code uses
**Change:** Add `ccpro_enabled boolean DEFAULT false NOT NULL` to table schema
**Risk:** Low - just SQL, needs to be run in Supabase

---

## Recommended Order (Lowest Risk First):
1. Change 1 - Remove excessive logging
2. Change 6 - Handle missing admin_roles table
3. Change 5 - Disable countPendingVerificationSessions
4. Change 2 - Fix call_status column name
5. Change 3 - Remove notification_sent column references
6. Change 4 - Fix verification_sessions queries
7. Change 11 - Create agent_notifications table (SQL)
8. Change 12 - Add ccpro_enabled field (SQL)
9. Change 9 - Migrate to agent_notifications table
10. Change 10 - Update scheduler to create records
11. Change 7 - Remove FTCRESTRICTED queries (HIGH RISK - changes business logic)
12. Change 8 - Disable FTC queue cleaner (HIGH RISK - disables functionality)

