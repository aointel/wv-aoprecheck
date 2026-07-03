-- Generate CSV data from masterlead for testing CSV upload
-- This creates a CSV with Lead ID, Associate ID, and Lead inbox columns
-- Run this query and export results as CSV
--
-- PREREQUISITES: Run these SQL migrations first (in order):
-- 1. add-associate-id-to-masterlead.sql
-- 2. add-ao-lead-box-column.sql (or add-ao-lead-box-columns.sql)
-- 3. add-ao-lead-box-owners-column.sql (or add-ao-lead-box-columns.sql)

-- Generate test CSV data from existing masterlead records
-- This will create rows with: Lead ID, Associate ID, Lead inbox
-- NOTE: This query works even if ao_lead_box column doesn't exist yet
SELECT 
  id AS "Lead ID",
  '12345' AS "Associate ID", -- Sample associate ID - change this to actual associate IDs
  CASE (id % 4)
    WHEN 0 THEN 'intown'
    WHEN 1 THEN 'road trip'
    WHEN 2 THEN 'list'
    WHEN 3 THEN 'lapse'
  END AS "Lead inbox"
FROM masterlead
WHERE 
  id IS NOT NULL
  AND cnresolution = 'pending'
ORDER BY id
LIMIT 50; -- Generate 50 test rows

-- Alternative: Generate CSV for leads that need to be assigned
-- This creates a CSV with sample data for testing
SELECT 
  id AS "Lead ID",
  '12345' AS "Associate ID", -- Sample associate ID
  CASE (id % 4)
    WHEN 0 THEN 'intown'
    WHEN 1 THEN 'road trip'
    WHEN 2 THEN 'list'
    WHEN 3 THEN 'lapse'
  END AS "Lead inbox"
FROM masterlead
WHERE 
  id IS NOT NULL
  AND cnresolution = 'pending'
ORDER BY id
LIMIT 50;
