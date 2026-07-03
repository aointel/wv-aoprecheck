-- ============================================================================
-- Tie Users to Carrington Hanna in agent_hierarchy
-- ============================================================================
-- This script ensures the specified users are tied to Carrington Hanna
-- as their MGA in the agent_hierarchy table
-- ============================================================================

-- First, get Carrington Hanna's associate_id
-- (Assuming carringtonhanna@aoglobelife.com)
DO $$
DECLARE
  carrington_associate_id INTEGER;
  carrington_name TEXT := 'CARRINGTON HANNA';
BEGIN
  -- Get Carrington Hanna's associate_id from customers table
  SELECT associate_id INTO carrington_associate_id
  FROM customers
  WHERE company_email = 'carringtonhanna@aoglobelife.com'
     OR personal_email = 'carringtonhanna@aoglobelife.com'
  LIMIT 1;

  IF carrington_associate_id IS NULL THEN
    RAISE EXCEPTION 'Carrington Hanna not found in customers table';
  END IF;

  RAISE NOTICE 'Carrington Hanna associate_id: %', carrington_associate_id;

  -- Update/Insert each user to be tied to Carrington Hanna
  -- First, get or create the agent_associate_id for each user
  
  -- Cameron Christensen
  DO $$
  DECLARE
    agent_id INTEGER;
    agent_name_val TEXT;
  BEGIN
    -- Get agent associate_id and name
    SELECT associate_id INTO agent_id
    FROM customers
    WHERE company_email = 'cameronchristensen@aoglobelife.com' 
       OR personal_email = 'cameronchristensen@aoglobelife.com'
    LIMIT 1;
    
    SELECT COALESCE(first_name || ' ' || last_name, 'Cameron Christensen') INTO agent_name_val
    FROM agent_profiles
    WHERE email = 'cameronchristensen@aoglobelife.com'
    LIMIT 1;
    
    IF agent_id IS NULL THEN
      RAISE WARNING 'No associate_id found for cameronchristensen@aoglobelife.com - skipping';
    ELSE
      INSERT INTO agent_hierarchy (
        agent_associate_id, agent_email, agent_name,
        mga_name, mga_associate_id,
        updated_at
      )
      VALUES (
        agent_id,
        'cameronchristensen@aoglobelife.com',
        COALESCE(agent_name_val, 'Cameron Christensen'),
        carrington_name,
        carrington_associate_id,
        NOW()
      )
      ON CONFLICT (agent_associate_id) 
      DO UPDATE SET
        agent_email = 'cameronchristensen@aoglobelife.com',
        agent_name = COALESCE(agent_name_val, 'Cameron Christensen'),
        mga_name = carrington_name,
        mga_associate_id = carrington_associate_id,
        updated_at = NOW();
    END IF;
  END $$;

  -- Caleb Brown
  INSERT INTO agent_hierarchy (
    agent_email, agent_name, agent_associate_id,
    mga_name, mga_associate_id,
    updated_at
  )
  SELECT 
    'calebbrown@aoglobelife.com',
    COALESCE((SELECT first_name || ' ' || last_name FROM agent_profiles WHERE email = 'calebbrown@aoglobelife.com'), 'Caleb Brown'),
    COALESCE((SELECT associate_id FROM customers WHERE company_email = 'calebbrown@aoglobelife.com' OR personal_email = 'calebbrown@aoglobelife.com' LIMIT 1), NULL),
    carrington_name,
    carrington_associate_id,
    NOW()
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    mga_name = carrington_name,
    mga_associate_id = carrington_associate_id,
    updated_at = NOW();

  -- Gavin Synder
  INSERT INTO agent_hierarchy (
    agent_email, agent_name, agent_associate_id,
    mga_name, mga_associate_id,
    updated_at
  )
  SELECT 
    'gavinsynder@aoglobelife.com',
    COALESCE((SELECT first_name || ' ' || last_name FROM agent_profiles WHERE email = 'gavinsynder@aoglobelife.com'), 'Gavin Synder'),
    COALESCE((SELECT associate_id FROM customers WHERE company_email = 'gavinsynder@aoglobelife.com' OR personal_email = 'gavinsynder@aoglobelife.com' LIMIT 1), NULL),
    carrington_name,
    carrington_associate_id,
    NOW()
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    mga_name = carrington_name,
    mga_associate_id = carrington_associate_id,
    updated_at = NOW();

  -- Bradlee Simmons
  INSERT INTO agent_hierarchy (
    agent_email, agent_name, agent_associate_id,
    mga_name, mga_associate_id,
    updated_at
  )
  SELECT 
    'bradleesimmons@aoglobelife.com',
    COALESCE((SELECT first_name || ' ' || last_name FROM agent_profiles WHERE email = 'bradleesimmons@aoglobelife.com'), 'Bradlee Simmons'),
    COALESCE((SELECT associate_id FROM customers WHERE company_email = 'bradleesimmons@aoglobelife.com' OR personal_email = 'bradleesimmons@aoglobelife.com' LIMIT 1), NULL),
    carrington_name,
    carrington_associate_id,
    NOW()
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    mga_name = carrington_name,
    mga_associate_id = carrington_associate_id,
    updated_at = NOW();

  -- Isaiah Newhouse
  INSERT INTO agent_hierarchy (
    agent_email, agent_name, agent_associate_id,
    mga_name, mga_associate_id,
    updated_at
  )
  SELECT 
    'isaiahnewhouse@aoglobelife.com',
    COALESCE((SELECT first_name || ' ' || last_name FROM agent_profiles WHERE email = 'isaiahnewhouse@aoglobelife.com'), 'Isaiah Newhouse'),
    COALESCE((SELECT associate_id FROM customers WHERE company_email = 'isaiahnewhouse@aoglobelife.com' OR personal_email = 'isaiahnewhouse@aoglobelife.com' LIMIT 1), NULL),
    carrington_name,
    carrington_associate_id,
    NOW()
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    mga_name = carrington_name,
    mga_associate_id = carrington_associate_id,
    updated_at = NOW();

  -- Shawn Sipes
  INSERT INTO agent_hierarchy (
    agent_email, agent_name, agent_associate_id,
    mga_name, mga_associate_id,
    updated_at
  )
  SELECT 
    'shawnsipes@aoglobelife.com',
    COALESCE((SELECT first_name || ' ' || last_name FROM agent_profiles WHERE email = 'shawnsipes@aoglobelife.com'), 'Shawn Sipes'),
    COALESCE((SELECT associate_id FROM customers WHERE company_email = 'shawnsipes@aoglobelife.com' OR personal_email = 'shawnsipes@aoglobelife.com' LIMIT 1), NULL),
    carrington_name,
    carrington_associate_id,
    NOW()
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    mga_name = carrington_name,
    mga_associate_id = carrington_associate_id,
    updated_at = NOW();

  -- Avery Flicky
  INSERT INTO agent_hierarchy (
    agent_email, agent_name, agent_associate_id,
    mga_name, mga_associate_id,
    updated_at
  )
  SELECT 
    'averyflicky@aoglobelife.com',
    COALESCE((SELECT first_name || ' ' || last_name FROM agent_profiles WHERE email = 'averyflicky@aoglobelife.com'), 'Avery Flicky'),
    COALESCE((SELECT associate_id FROM customers WHERE company_email = 'averyflicky@aoglobelife.com' OR personal_email = 'averyflicky@aoglobelife.com' LIMIT 1), NULL),
    carrington_name,
    carrington_associate_id,
    NOW()
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    mga_name = carrington_name,
    mga_associate_id = carrington_associate_id,
    updated_at = NOW();

  -- Taj Ward
  INSERT INTO agent_hierarchy (
    agent_email, agent_name, agent_associate_id,
    mga_name, mga_associate_id,
    updated_at
  )
  SELECT 
    'tajward@aoglobelife.com',
    COALESCE((SELECT first_name || ' ' || last_name FROM agent_profiles WHERE email = 'tajward@aoglobelife.com'), 'Taj Ward'),
    COALESCE((SELECT associate_id FROM customers WHERE company_email = 'tajward@aoglobelife.com' OR personal_email = 'tajward@aoglobelife.com' LIMIT 1), NULL),
    carrington_name,
    carrington_associate_id,
    NOW()
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    mga_name = carrington_name,
    mga_associate_id = carrington_associate_id,
    updated_at = NOW();

  -- Alonzo Alexander
  INSERT INTO agent_hierarchy (
    agent_email, agent_name, agent_associate_id,
    mga_name, mga_associate_id,
    updated_at
  )
  SELECT 
    'alonzoalexander@aoglobelife.com',
    COALESCE((SELECT first_name || ' ' || last_name FROM agent_profiles WHERE email = 'alonzoalexander@aoglobelife.com'), 'Alonzo Alexander'),
    COALESCE((SELECT associate_id FROM customers WHERE company_email = 'alonzoalexander@aoglobelife.com' OR personal_email = 'alonzoalexander@aoglobelife.com' LIMIT 1), NULL),
    carrington_name,
    carrington_associate_id,
    NOW()
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    mga_name = carrington_name,
    mga_associate_id = carrington_associate_id,
    updated_at = NOW();

  -- Will Musik
  INSERT INTO agent_hierarchy (
    agent_email, agent_name, agent_associate_id,
    mga_name, mga_associate_id,
    updated_at
  )
  SELECT 
    'willmusik@aoglobelife.com',
    COALESCE((SELECT first_name || ' ' || last_name FROM agent_profiles WHERE email = 'willmusik@aoglobelife.com'), 'Will Musik'),
    COALESCE((SELECT associate_id FROM customers WHERE company_email = 'willmusik@aoglobelife.com' OR personal_email = 'willmusik@aoglobelife.com' LIMIT 1), NULL),
    carrington_name,
    carrington_associate_id,
    NOW()
  ON CONFLICT (agent_email) 
  DO UPDATE SET
    mga_name = carrington_name,
    mga_associate_id = carrington_associate_id,
    updated_at = NOW();

  RAISE NOTICE '✅ Successfully tied all users to Carrington Hanna (associate_id: %)', carrington_associate_id;
END $$;

-- Verification query
SELECT 
  agent_email,
  agent_name,
  mga_name,
  mga_associate_id,
  rga_name,
  rga_associate_id
FROM agent_hierarchy
WHERE agent_email IN (
  'cameronchristensen@aoglobelife.com',
  'calebbrown@aoglobelife.com',
  'gavinsynder@aoglobelife.com',
  'bradleesimmons@aoglobelife.com',
  'isaiahnewhouse@aoglobelife.com',
  'shawnsipes@aoglobelife.com',
  'averyflicky@aoglobelife.com',
  'tajward@aoglobelife.com',
  'alonzoalexander@aoglobelife.com',
  'willmusik@aoglobelife.com'
)
ORDER BY agent_email;

