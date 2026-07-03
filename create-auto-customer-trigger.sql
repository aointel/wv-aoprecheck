-- SUPABASE TRIGGER: Auto-create customer record when new auth user is created
-- This ensures every signup automatically gets a customer record

-- Step 1: Create function to auto-create customer
CREATE OR REPLACE FUNCTION auto_create_customer_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  user_metadata jsonb;
  first_name text;
  last_name text;
  user_phone text;
BEGIN
  -- Extract user metadata from auth.users
  user_metadata := NEW.raw_user_meta_data;
  first_name := COALESCE(user_metadata->>'firstName', user_metadata->>'first_name', 'New');
  last_name := COALESCE(user_metadata->>'lastName', user_metadata->>'last_name', 'Agent');
  user_phone := COALESCE(user_metadata->>'phone', '+1-555-0000');

  RAISE LOG 'Auto-creating customer for new auth user: %', NEW.email;

  -- Create customer record
  INSERT INTO public.customers (
    company_email,
    personal_email,
    first_name,
    last_name,
    phone,
    agent_name,
    VDPACTIVE,
    PLUSACTIVE,
    RECRUITACTIVE,
    AOICONNECT,
    CCPRO,
    primary_market,
    secondary_market,
    market,
    states,
    created_at,
    updated_at
  ) VALUES (
    NEW.email,
    NEW.email,
    first_name,
    last_name,
    user_phone,
    first_name || ' ' || last_name,
    'INACTIVE',
    'INACTIVE',
    'INACTIVE',
    'INACTIVE',
    false,
    COALESCE(user_metadata->>'primaryMarket', ''),
    COALESCE(user_metadata->>'secondaryMarket', ''),
    COALESCE((user_metadata->>'market')::jsonb, '[]'::jsonb), -- Market array from signup form
    COALESCE((user_metadata->>'states')::jsonb, '[]'::jsonb), -- States array from signup form
    NOW(),
    NOW()
  )
  ON CONFLICT (company_email) DO NOTHING; -- Skip if already exists

  -- Also create agent_profiles record
  INSERT INTO public.agent_profiles (
    supabase_user_id,
    email,
    first_name,
    last_name,
    phone,
    zoom_id,
    zoom_password,
    primary_market,
    secondary_market,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    first_name,
    last_name,
    user_phone,
    COALESCE(user_metadata->>'zoomId', ''),
    COALESCE(user_metadata->>'zoomPassword', '1'),
    COALESCE(user_metadata->>'primaryMarket', ''),
    COALESCE(user_metadata->>'secondaryMarket', ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO NOTHING; -- Skip if already exists

  -- Create initial credit record
  INSERT INTO public.user_credits (
    email,
    credits_remaining,
    credits_used,
    last_updated
  ) VALUES (
    NEW.email,
    0, -- Start with 0 credits
    0,
    NOW()
  )
  ON CONFLICT (email) DO NOTHING; -- Skip if already exists

  RAISE LOG 'Successfully auto-created customer, profile, and credits for: %', NEW.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_customer_on_signup();

-- Step 3: Verify trigger is created
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

RAISE NOTICE '✅ Auto-customer creation trigger installed successfully!';
RAISE NOTICE 'New auth signups will automatically create customer, profile, and credit records.';

