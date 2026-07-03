# Changelog Summary - Recent Updates

## Call Connector Pro & Subscription Management

### 🎯 Call Connector Pro Access Updates
- **Stricter Access Control**: Only agents with **active** Stripe subscriptions now have access to Call Connector Pro. Inactive or cancelled subscriptions no longer grant access.
- **Improved Video Display**: All agents without active Call Connector Pro subscriptions now see the introductory video, regardless of market.
- **Globe Market Sign-Up**: Only Globe Market agents see the "Subscribe to Call Connector Pro" button below the video. Other markets (e.g., Veteran) see the video but not the sign-up option.
- **New Banner**: Updated promotional banner for Globe Market agents: "Call Connector Pro Subscriptions ARE NOW ENABLED FOR GLOBE MARKET - We have limited space and they won't last long!"

### 💳 Billing & Subscription Management
- **Stripe Billing Portal**: Agents can now manage all their Stripe subscriptions directly from the billing dashboard, including:
  - View all active subscriptions
  - Change payment methods
  - Update billing information
  - View billing history
  - Cancel subscriptions
- **Unified Credit Purchase**: All "Buy Credits" and "Purchase Credits" buttons throughout the app now link to the same billing dashboard for consistency.
- **Individual Billing API**: Fixed 404 error for `/api/billing/all-charges` endpoint - agents can now view their individual billing transactions.

## Call Metrics & Analytics

### 📊 Dial Counting Fixes
- **Fixed Double-Counting**: Resolved issue where parent and child WebRTC calls were both being counted, causing inflated dial numbers. Now only child calls (actual dials) are counted.
- **Improved Filtering**: Dial counting now correctly filters calls based on duration and status, matching the Sales Activity totals logic.
- **5-Minute Deduplication**: Redials to the same number within 5 minutes are correctly deduplicated and count as a single dial.

### 📈 Real-Time Statistics
- **Pagination Fix**: Totals (dialed, reached, booked, connects, instant presentations, missed calls) are now calculated from ALL agents before pagination, ensuring accurate totals even when viewing paginated results.
- **Instant Presentations**: Now correctly counted from `twilio_call_logs` for outbound calls with duration >= 10 minutes.

## Twilio Integration

### 🤖 Answering Machine Detection (AMD)
- **AMD Enabled**: Twilio outbound calls now include Answering Machine Detection to identify if calls were answered by humans or machines.
- **AMD Data Storage**: AMD results (answered_by, amd_duration_ms) are now stored in `twilio_call_logs` table for analysis.
- **Backfill Available**: Script available to backfill AMD data from Twilio's API for recent calls (last 30 days).

## User Experience Improvements

### 🔔 Notification Fixes
- **Reduced Toast Spam**: Fixed recurring "call inactive webrtc" toast notifications that appeared after every completed call. Toasts are now suppressed for 5 seconds after a call ends.

### 🎨 UI/UX Enhancements
- **Subscribe Button**: Fixed "Subscribe to Call Connector Pro" button to properly open the Stripe subscription modal.
- **Consistent Navigation**: All credit purchase buttons now use the same link to the billing dashboard for a consistent user experience.

## Data Backfilling

### 📅 Historical Data
- **Booked Events Backfill**: Scripts available to backfill missing "booked" events from `masterlead` into `agent_dial_metrics`:
  - Today's bookings: `backfill-booked-today.ts`
  - Recent period (30 days): `backfill-booked-recent.ts`
- **AMD Backfill**: Script available to backfill AMD data from Twilio API for calls from the last 30 days.

## Technical Improvements

### 🛠️ Database Updates
- Added `answered_by` and `amd_duration_ms` columns to `twilio_call_logs` table for AMD tracking.
- Updated `agent_dial_metrics` constraint to allow `'instant_presentation'` as a valid event type.

### 🔧 Code Quality
- Improved error handling and consistent response structures across API endpoints.
- Added debug logging for subscription flow troubleshooting.
- Enhanced type safety with proper TypeScript interfaces.

---

**Note**: Some changes require database migrations. SQL migration files are available in the repository and should be run in Supabase.
