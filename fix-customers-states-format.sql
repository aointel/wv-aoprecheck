-- Fix customers.states column: Convert comma-separated strings to JSON arrays
-- Only updates rows where states is currently a string (not already an array)
-- Example: "CA, IA, OR, VA, WA, WI" -> ["CA", "IA", "OR", "VA", "WA", "WI"]

-- First, check how many rows need fixing
-- Check if states is a JSON string (starts with ") vs JSON array (starts with [)
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE states IS NULL) as null_rows,
  COUNT(*) FILTER (WHERE states IS NOT NULL AND jsonb_typeof(states) = 'string') as string_rows,
  COUNT(*) FILTER (WHERE states IS NOT NULL AND jsonb_typeof(states) = 'array') as array_rows
FROM customers;

-- Check how many rows will be updated by the UPDATE query
SELECT 
  COUNT(*) as rows_to_update
FROM customers
WHERE states IS NOT NULL
  AND jsonb_typeof(states) = 'string'
  AND states#>>'{}' ~ ',';

-- Update rows where states is a JSON string containing commas
-- Convert "CA, IA, OR" format to ["CA", "IA", "OR"] JSON array
-- Only updates if states is currently a string (not already an array)
UPDATE customers
SET states = (
  SELECT jsonb_agg(trimmed_state)
  FROM (
    SELECT trim(unnest(string_to_array(states#>>'{}', ','))) as trimmed_state
  ) AS split_states
  WHERE trimmed_state != ''
)
WHERE states IS NOT NULL
  AND jsonb_typeof(states) = 'string'  -- It's a JSON string, not an array
  AND states#>>'{}' ~ ','; -- Only update if it contains commas (comma-separated format)

-- Verify the update - check if any string rows remain
SELECT 
  COUNT(*) FILTER (WHERE jsonb_typeof(states) = 'string') as remaining_string_rows,
  COUNT(*) FILTER (WHERE jsonb_typeof(states) = 'array') as array_rows,
  COUNT(*) FILTER (WHERE states IS NULL) as null_rows
FROM customers
WHERE states IS NOT NULL;

-- Show sample rows to verify format
SELECT 
  id,
  company_email,
  states,
  jsonb_typeof(states) as states_type
FROM customers
WHERE states IS NOT NULL
ORDER BY id DESC
LIMIT 20;

