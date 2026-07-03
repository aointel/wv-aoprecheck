# ConnectNow Analytics Database Setup

This document explains how to set up and use the ConnectNow Analytics database-backed system.

## Overview

Instead of processing the CSV file on every request, we now:
1. **Pre-calculate KPIs** from CSV and store them in a database
2. **Frontend reads** from the database (fast and efficient)
3. **Database can be updated** on a schedule or manually

## Setup Steps

### 1. Create Database Tables

Run the SQL schema file in your Supabase SQL Editor:

```bash
# The SQL file is at: server/connectnow-analytics-schema.sql
```

Or manually run the SQL in Supabase Dashboard → SQL Editor.

This creates:
- `connectnow_daily_kpis` table - stores daily KPIs by campaign
- `connectnow_weekly_summary` view - optional aggregated weekly view

### 2. Populate the Database

#### Option A: Populate Current Rolling Week (Recommended for daily updates)

```bash
npm run populate-analytics -- --week
```

This updates data for the current rolling week (Thursday - Wednesday PST).

#### Option B: Populate All Dates from CSV

```bash
npm run populate-analytics -- --all
```

This processes all dates found in the CSV file. **Warning**: This may take a while if the CSV is large.

#### Option C: Populate Specific Date Range

```bash
npm run populate-analytics -- 11/21/2025 11/27/2025
```

Replace with your desired start and end dates (MM/DD/YYYY format).

### 3. Add Script to package.json

Add this script to your `package.json`:

```json
{
  "scripts": {
    "populate-analytics": "tsx server/connectnow-analytics-populate-db.ts"
  }
}
```

## How It Works

### Database Structure

**Table: `connectnow_daily_kpis`**
- One row per date + campaign combination
- Stores all 14 KPIs pre-calculated
- Has indexes for fast date range queries
- Uses `UPSERT` to handle duplicates (can re-run safely)

### API Endpoint

The `/api/connectnow-analytics/weekly-report` endpoint now:
1. Calculates current rolling week (Thursday - Wednesday PST)
2. Queries database for those dates
3. Formats data for frontend
4. Returns JSON response

### Data Updates

**Recommended Schedule:**
- Run `npm run populate-analytics -- --week` daily to update current week
- Or run it automatically via cron job / scheduled task

**Manual Updates:**
- After CSV file is updated, run the populate script
- Can update specific date ranges if needed

## Benefits

✅ **Fast**: No CSV parsing on every request  
✅ **Scalable**: Can handle large date ranges efficiently  
✅ **Reliable**: Data is pre-validated and stored  
✅ **Flexible**: Can query specific dates, date ranges, etc.  
✅ **Maintainable**: Clear separation of data processing and serving

## Troubleshooting

### "No data found in database"
- Run the populate script: `npm run populate-analytics -- --week`
- Check that the CSV file exists at: `server/3d973e15-379a-4f5e-be4d-7628529c9401.csv`

### "Table doesn't exist"
- Run the SQL schema file in Supabase SQL Editor
- Check table name: `connectnow_daily_kpis`

### "Data seems outdated"
- Run the populate script to update: `npm run populate-analytics -- --week`
- Check the CSV file's last modified date

## Migration from CSV Processing

The old CSV-processing code is still available in `connectnow-analytics-service.ts` but is now only used by the populate script. The API endpoint reads from the database instead.

