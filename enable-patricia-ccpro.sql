-- Enable Call Connector Pro access for Patricia Santamarina
UPDATE customers
SET CCPRO = true
WHERE company_email = 'patriciasantamarina@aoglobelife.com';

-- Verify the change
SELECT 
  company_email,
  first_name,
  last_name,
  CCPRO,
  PLUSACTIVE,
  states,
  market
FROM customers
WHERE company_email = 'patriciasantamarina@aoglobelife.com';

