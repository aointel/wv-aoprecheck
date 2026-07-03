# Transfer Throttle Standard

## Overview

Agents who disposition leads with non-sale outcomes cause those leads to be **transferred** (unassigned) back to the pool. To prevent abuse (e.g., rapidly cycling through leads without real conversations), we enforce a **transfer rate limit** per 15-minute rolling window.

## Definitions

### Transfer (countable event)

A **transfer** is any disposition that results in the lead being unassigned and returned to the pool. These dispositions trigger unassign:

- All dispositions **except**:
  - `sale`
  - `already_been_sold`
  - `already_been_seen` / `already been seen`

Examples of transfer dispositions: `no_answer`, `wrong_number`, `not_interested`, `callback`, `booked` (when lead goes to pool), `dnc`, `duplicate`, etc.

### Window

- **Rolling 15 minutes** – we count transfers in the last 15 minutes before the current disposition attempt.
- Timezone: UTC for storage; displayed in agent’s timezone when relevant.

### Threshold

- **Default limit:** 5 transfers per 15-minute rolling window.
- Configurable via `TRANSFER_THROTTLE_MAX_PER_15_MIN` env var (default: 5).
- Threshold based on reach data: typical agents ~1–2 reaches/hour (~0.25–0.5 per 15 min); high performers ~3–4 per 15 min. Transfers are similar. 5 per 15 min catches outliers without blocking normal activity.

## Data Source

- **Table:** `agent_dial_metrics`
- **Filter:** `event_timestamp >= now() - 15 minutes`, `agent_email = <current agent>`
- **Transfer dispositions:** `disposition` NOT IN (`sale`, `already_been_sold`, `already_been_seen`, `already been seen`)

## Safeguard Behavior

1. **Before** processing a disposition in `/api/outbound-dialer/save-disposition`:
   - If the disposition is a **transfer disposition** (not sale, etc.):
     - Count transfers for this agent in the last 15 minutes.
     - If count ≥ `TRANSFER_THROTTLE_MAX_PER_15_MIN`, **reject** the disposition with HTTP 429.
2. **Response** when throttled:
   ```json
   { "success": false, "error": "Transfer rate limit exceeded", "retryAfterMinutes": 15 }
   ```
3. **Frontend:** Show a clear message such as:  
   “You’ve reached the maximum transfers allowed in 15 minutes. Please wait before dispositioning more leads.”

## Exemptions

- Dispositions that **do not** trigger unassign (e.g., `sale`, `already_been_sold`, `already_been_seen`) are **not** counted and are **never** throttled.
- Sysop/admin users may be exempt (configurable).

## Analysis Script

Run `npm run transfer-rates-per-15min` to analyze transfer rates per 15-minute window per agent. Use this to:

- Calibrate the threshold.
- Monitor agents who frequently hit the limit.
- Detect unusual transfer patterns.
