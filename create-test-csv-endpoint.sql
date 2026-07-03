-- Create a SQL query that generates CSV-ready data
-- Use this in psql with \copy command or export from Supabase dashboard

-- Generate CSV data for testing (copy output to CSV file)
\copy (
  SELECT 
    id AS "Lead ID",
    '12345' AS "Associate ID",
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
  LIMIT 50
) TO 'test-leads-assignment.csv' WITH CSV HEADER;
