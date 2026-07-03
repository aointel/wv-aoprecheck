# Missing MGAs - Summary Report

## Status: 12 of 15 MGAs Found ✅

### ✅ MGAs Already in Directory (12)
1. Joseph Tomanovich (ID: 21812)
2. Maria Lagios (ID: 111822)
3. Allissa Collins (ID: 132872)
4. Jennifer Jantzen (ID: 24330)
5. ROGER FREDERICKS (ID: 65269)
6. STEPHEN BOWEN (ID: 68092)
7. HEMAWATTIE MOOLOO (ID: 187284)
8. VICTORIA MARTINEZ (ID: 134549)
9. JESSICA OLANDRIA (ID: 71940)
10. JACQUELINE PRIETO (ID: 118232)
11. LEYNA TRAN (ID: 117239)
12. MEGHAN HENDRICKSON (ID: 107127)

### ❌ MGAs Missing from Directory (3)
1. **GEORGE OSHEA** (ID: 165833, Email: georgeoshea@aoglobelife.com)
2. **KALEN DUGAN** (ID: 72882, Email: kalendugan@aoglobelife.com)
3. **GABRIELLE GARCIA** (ID: 159740, Email: garciagabrielle@aoglobelife.com)

## Why They're Missing
These 3 agents appear in the Producer List CSV but are NOT listed as MGAs in column 1. They're listed as agents reporting to other MGAs:
- GEORGE OSHEA → reports to JOSEPH TOMANOVICH
- KALEN DUGAN → reports to JOSEPH TOMANOVICH
- GABRIELLE GARCIA → reports to STEPHEN BOWEN

## How to Add Them

### Step 1: Add to `mga_rga_directory`
Run the SQL script: **`add-3-missing-mgas-complete.sql`**

This will insert all 3 MGAs into the directory with their associate IDs and contact info.

### Step 2: Add to `qm_mga_assignments`
In the same SQL file, uncomment the INSERT block and choose which Quality Manager should manage these MGAs.

**Current QM Options:**
- `tomanovichqm@aoglobelife.com` (currently manages ~217 MGAs including JOSEPH TOMANOVICH and STEPHEN BOWEN)
- Other QMs as needed

## Files Created
1. **`add-3-missing-mgas-complete.sql`** ← **USE THIS ONE** (Complete solution)
2. `add-missing-mgas-to-directory.sql` (Part 1 only)
3. `add-missing-mgas-to-qm-assignments.sql` (Part 2 only)
4. `check-mga-directory-names.cjs` (Verification script)
5. `check-qm-table-structure.cjs` (Table structure checker)

## Quick Start
```bash
# Run in Supabase SQL Editor:
# 1. Open add-3-missing-mgas-complete.sql
# 2. Run PART 1 (mga_rga_directory) - no changes needed
# 3. Uncomment PART 2 (qm_mga_assignments) and choose QM email
# 4. Run verification queries
```

## Table Structures (Reference)

### `mga_rga_directory`
- `associate_id` (primary key)
- `name`
- `email`
- `role` ('MGA', 'RGA', 'BOTH')
- `aoi_market`
- `designated_market`

### `qm_mga_assignments`
- `id` (primary key)
- `mga` (MGA name - **not** mga_name!)
- `rga` (RGA name)
- `quality_manager` (QM email - **not** qm_email!)
- `created_at`
- `updated_at`






