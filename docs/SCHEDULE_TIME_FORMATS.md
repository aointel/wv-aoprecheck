# Schedule Time Format Standards

This document defines the time formats used for scheduling across the AOIrail codebase.

## Storage (Database)

- **Format**: ISO 8601 UTC strings
- **Examples**: `2026-02-10T17:00:00.000Z`, `2026-02-10T18:00:00.000Z`
- **Usage**: All `slot_start`, `slot_end`, `scheduled_date` values in `master_schedule`, `meets`, and `appointments` are stored in UTC.

## API Responses (Time-of-Day)

- **Format**: `HH:mm` (24-hour, zero-padded)
- **Examples**: `09:00`, `09:30`, `14:00`, `17:30`
- **Usage**: 
  - `GET /api/schedule/availability` returns a `time` field in HH:mm for each booked slot, interpreted in the request's `timezone` (IANA).
  - This matches the modal's `TIME_SLOTS` for slot comparison.

## Client / UI

- **Slot comparison**: Use `HH:mm` format (e.g. `"09:00"`, `"14:30"`) for consistency with the availability API.
- **Display**: Use `formatTimeDisplay()` or `toLocaleTimeString()` for user-facing AM/PM display.
- **Timezone**: When booking, the selected `timezone` (IANA, e.g. `America/New_York`) defines how the chosen date/time is interpreted.

## Conventions

1. **Store in UTC** – Always persist dates/times as ISO UTC.
2. **API time-of-day** – Use HH:mm in the requested timezone for availability and slot comparisons.
3. **Single format for comparison** – Modal `TIME_SLOTS` and availability API both use HH:mm to avoid mismatch (e.g. `"9:00 AM"` vs `"09:00"`).
