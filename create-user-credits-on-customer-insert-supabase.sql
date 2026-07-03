-- SUPABASE TRIGGER: Auto-create user_credits record when new customer is created
-- This ensures every customer automatically gets a user_credits record
-- 
-- TO APPLY IN SUPABASE:
-- 1. Go to SQL Editor in Supabase Dashboard
-- 2. Paste this entire file
-- 3. Run the query
-- 4. Verify the trigger was created by checking the triggers table

-- Step 1: Create function to auto-create user_credits
CREATE OR REPLACE FUNCTION auto_create_user_credits_on_customer_insert()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only create user_credits if company_email exists
  IF NEW.company_email IS NOT NULL THEN
    -- Check if user_credits record already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.user_credits 
      WHERE email = NEW.company_email
    ) THEN
      -- Create user_credits record
      -- Note: credits_remaining is a generated column (calculated from credits_purchased - credits_used), so we don't set it
      INSERT INTO public.user_credits (
        email,
        associate_id,
        name,
        credits_used,
        credits_purchased,
        missed_calls,
        aoi_missed_calls,
        created_at,
        updated_at
      ) VALUES (
        NEW.company_email,
        NEW.associate_id, -- Use associate_id from customers table if available
        COALESCE(
          NULLIF(NEW.agent_name, ''), 
          NULLIF(NEW.first_name || ' ' || NEW.last_name, ' '), 
          SPLIT_PART(NEW.company_email, '@', 1)
        ), -- Use agent_name, or first+last, or email username
        0, -- Start with 0 credits used
        0, -- Start with 0 credits purchased
        0, -- Start with 0 missed calls
        0, -- Start with 0 AOI missed calls
        COALESCE(NEW.created_at, NOW()), -- Use customer created_at if available, otherwise NOW()
        NOW()
      )
      ON CONFLICT (email) DO NOTHING; -- Skip if already exists (shouldn't happen, but safe)
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 2: Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_customer_insert_create_user_credits ON public.customers;

-- Step 3: Create trigger on customers table
CREATE TRIGGER on_customer_insert_create_user_credits
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_user_credits_on_customer_insert();

-- Step 4: Verify trigger was created
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_customer_insert_create_user_credits';

