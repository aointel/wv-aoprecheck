-- Map associate IDs to emails for agents with NULL company_email in vdp_calls

-- Find emails for associate IDs from the INSERT data
SELECT 
  associate_id,
  company_email,
  first_name,
  last_name
FROM customers
WHERE associate_id IN (
  200388,  -- 12 duplicates
  145691   -- 4 duplicates
)
ORDER BY associate_id;

