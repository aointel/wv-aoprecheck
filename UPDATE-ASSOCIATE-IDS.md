# Update Associate IDs from CSV

This script updates the `associate_id` field in the `customers` table from the Producer List CSV file.

## How It Works

1. Parses the CSV file: `client/src/components/connectnow/Copy of Producer List 1.2.26.csv`
2. Matches customers by `company_email` or `personal_email`
3. Updates the `associate_id` field in the `customers` table

## Usage

### Option 1: API Endpoint (Recommended)

Call the API endpoint after deployment:

```bash
curl -X POST https://your-server.com/api/admin/update-associate-ids-from-csv \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie"
```

**Note:** Requires MGA/RGA access (uses `checkMgaRgaAccess` middleware)

### Option 2: Direct Script Execution

If you have Node.js available:

```bash
node server/update-associate-ids-from-csv.ts
```

Or using the .mjs version:

```bash
node update-associate-ids-from-csv.mjs
```

## CSV Format Expected

The CSV should have these columns:
- `Associate ID` - The associate ID to update
- `Company Email` - Used to match customer records
- `Personal Email` - Fallback if company email doesn't match
- `Agent` - Agent name (for logging)

## What Gets Updated

- **Matches by:** `company_email` first, then `personal_email` if not found
- **Updates:** `associate_id` field in `customers` table
- **Skips:** 
  - Rows with empty Associate ID or "0"
  - Customers that already have the correct associate_id
  - Customers not found in database

## Output

The script will show:
- ✅ Updated records (with before/after associate_id)
- ⚠️ Not Found (emails in CSV but not in customers table)
- ⏭️ Skipped (already correct or invalid data)
- ❌ Errors (database errors)

Example output:
```
✅ Updated andrewbishop@aoglobelife.com: associate_id NULL → 3 (ANDREW BISHOP)
✅ Updated kevinappasamy@aoglobelife.com: associate_id 129 → 129 (KEVIN APPASAMY)
⏭️ Skipping roberthamilton@aoglobelife.com - associate_id already 151
⚠️ Customer not found: nonexistent@aoglobelife.com (Associate ID: 999)

📊 SUMMARY:
   ✅ Updated: 150
   ⚠️ Not Found: 25
   ⏭️ Skipped: 50
   ❌ Errors: 0
   📝 Total Processed: 225
```

## Safety Features

- Only updates if associate_id is different (prevents unnecessary writes)
- Handles missing or invalid data gracefully
- Continues processing even if individual records fail
- Provides detailed logging for debugging

