-- Fix credits_used for associate_id 205404 (carlosfarge@aoglobelife.com)
-- Based on sum of billing_transactions.credits_charged

-- First, check current state
SELECT 
  email,
  credits_used,
  credits_remaining,
  credits_purchased
FROM user_credits
WHERE email = 'carlosfarge@aoglobelife.com';

-- Calculate total credits charged
SELECT 
  COUNT(*) as transaction_count,
  SUM(credits_charged) as total_credits_charged
FROM billing_transactions
WHERE agent_email = 'carlosfarge@aoglobelife.com';

-- Update credits_used to match billing_transactions
UPDATE user_credits
SET credits_used = (
  SELECT COALESCE(SUM(credits_charged), 0)
  FROM billing_transactions
  WHERE agent_email = 'carlosfarge@aoglobelife.com'
)
WHERE email = 'carlosfarge@aoglobelife.com';

-- Verify the update
SELECT 
  email,
  credits_used,
  credits_remaining,
  credits_purchased
FROM user_credits
WHERE email = 'carlosfarge@aoglobelife.com';
