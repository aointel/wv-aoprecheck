-- Creates a trigger that automatically inserts AO Connect billing transactions
-- whenever a new vdp_calls row with event = 'end' (case-insensitive) is inserted.

CREATE OR REPLACE FUNCTION public.insert_connect_billing_transaction()
RETURNS TRIGGER AS $$
DECLARE
  customer_record        customers%ROWTYPE;
  hierarchy_record       agent_hierarchy%ROWTYPE;
  resolved_email         TEXT;
  resolved_associate_id  INTEGER;
  resolved_name          TEXT;
  trimmed_agent          TEXT;
  lead_name              TEXT;
  lead_phone             TEXT;
  txn_exists             BOOLEAN;
BEGIN
  -- Only handle rows whose event is "end" in any casing.
  IF LOWER(COALESCE(NEW.event, '')) <> 'end' THEN
    RETURN NEW;
  END IF;

  trimmed_agent := NULLIF(TRIM(NEW.agent::TEXT), '');

  -- Start with the email coming in from vdp_calls directly.
  resolved_email := NULLIF(TRIM(NEW.company_email), '');

  -- Try to find matching customer information by associate id or email.
  SELECT c.*
    INTO customer_record
    FROM customers c
    WHERE c.associate_id::TEXT = trimmed_agent
       OR LOWER(c.company_email) = LOWER(trimmed_agent)
       OR LOWER(c.personal_email) = LOWER(trimmed_agent)
    ORDER BY c.created_at DESC NULLS LAST
    LIMIT 1;

  IF resolved_email IS NULL AND customer_record.company_email IS NOT NULL THEN
    resolved_email := NULLIF(TRIM(customer_record.company_email), '');
  END IF;

  IF resolved_email IS NULL AND customer_record.personal_email IS NOT NULL THEN
    resolved_email := NULLIF(TRIM(customer_record.personal_email), '');
  END IF;

  -- Capture associate id (if any) from customers.
  resolved_associate_id := customer_record.associate_id;

  -- Try agent_hierarchy when customers lookup did not produce everything.
  SELECT ah.*
    INTO hierarchy_record
    FROM agent_hierarchy ah
    WHERE ah.agent_associate_id::TEXT = trimmed_agent
    ORDER BY ah.created_at DESC NULLS LAST
    LIMIT 1;

  IF resolved_email IS NULL AND hierarchy_record.agent_email IS NOT NULL THEN
    resolved_email := NULLIF(TRIM(hierarchy_record.agent_email), '');
  END IF;

  IF resolved_associate_id IS NULL THEN
    resolved_associate_id := hierarchy_record.agent_associate_id;
  END IF;

  -- If everything else failed and agent looks numeric, use it as associate id.
  IF resolved_associate_id IS NULL AND trimmed_agent ~ '^[0-9]+$' THEN
    resolved_associate_id := trimmed_agent::INTEGER;
  END IF;

  -- Build a human-readable agent name.
  resolved_name := NULL;
  IF customer_record.first_name IS NOT NULL OR customer_record.last_name IS NOT NULL THEN
    resolved_name := NULLIF(TRIM(CONCAT(
      COALESCE(customer_record.first_name, ''),
      ' ',
      COALESCE(customer_record.last_name, '')
    )), '');
  END IF;

  IF resolved_name IS NULL THEN
    resolved_name := NULLIF(TRIM(hierarchy_record.agent_name), '');
  END IF;

  IF resolved_name IS NULL THEN
    resolved_name := trimmed_agent;
  END IF;

  -- Provide a deterministic fallback email so billing_transactions.agent_email never stays NULL.
  IF resolved_email IS NULL OR resolved_email = '' THEN
    resolved_email := CONCAT('associate-', COALESCE(trimmed_agent, 'unknown'), '@pending-lookup.aogi');
  END IF;

  resolved_email := LOWER(resolved_email);

  -- Build lead metadata from the call.
  lead_name := NULLIF(TRIM(CONCAT(
    COALESCE(NEW."firstName", ''),
    ' ',
    COALESCE(NEW."lastName", '')
  )), '');

  lead_phone := NULLIF(TRIM(NEW.phone), '');

  -- Prevent duplicate entries if the trigger fires again for the same call.
  SELECT EXISTS (
    SELECT 1
    FROM billing_transactions bt
    WHERE bt.transaction_id = CONCAT('connect-', NEW.id)
  )
  INTO txn_exists;

  IF NOT txn_exists THEN
    INSERT INTO billing_transactions (
      transaction_id,
      transaction_type,
      agent_email,
      agent_associate_id,
      agent_name,
      transaction_date,
      amount_usd,
      credits_charged,
      lead_name,
      lead_phone,
      source_table,
      source_id,
      description,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      CONCAT('connect-', NEW.id),
      'connect',
      resolved_email,
      resolved_associate_id,
      resolved_name,
      COALESCE(NEW.updated_at, NOW()),
      8.00,
      0,
      lead_name,
      lead_phone,
      'vdp_calls',
      NEW.id,
      'AO Connect charge',
      jsonb_build_object(
        'sessionID', NEW.sessionID,
        'taalk_call_id', NEW.sessionID
      ),
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vdp_calls_connect_billing_insert ON vdp_calls;

CREATE TRIGGER vdp_calls_connect_billing_insert
AFTER INSERT ON vdp_calls
FOR EACH ROW
EXECUTE FUNCTION public.insert_connect_billing_transaction();




