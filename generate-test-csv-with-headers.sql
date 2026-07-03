-- Generate CSV with headers for testing CSV upload
-- Copy this output and save as a CSV file

-- First row: Headers
SELECT 'Lead ID' AS "Lead ID", 'Associate ID' AS "Associate ID", 'Lead inbox' AS "Lead inbox"
UNION ALL
-- Data rows: Generate test data from masterlead
SELECT 
  id::text AS "Lead ID",
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
ORDER BY "Lead ID"
LIMIT 50;
