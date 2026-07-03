# Support Tables in Supabase

The help queue and live support bookings use two tables: `support_queue` and `support_bookings`. Add them to Supabase so they persist and survive redeploys.

## Run in Supabase

1. Open your project: **Supabase Dashboard** → **SQL Editor**
2. Open `db/supabase-support-tables.sql`
3. Copy the full contents and paste into the SQL Editor
4. Click **Run**

## Tables Created

| Table | Purpose |
|-------|---------|
| `support_bookings` | 10-minute slot bookings from the scheduling flow |
| `support_queue` | Live queue when agents join; manager can accept and assign Zoom link |

## Verify

```sql
SELECT COUNT(*) FROM support_bookings;
SELECT COUNT(*) FROM support_queue;
```

Both should return `0` initially (or row counts if data exists).
