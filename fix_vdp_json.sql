-- Fix the VDP data by extracting fields from the malformed JSON
UPDATE vdp_events_complete SET
  first_name = CASE 
    WHEN raw_params ~ 'First Name":"([^"]+)"' 
    THEN substring(raw_params from 'First Name":"([^"]+)"')
    ELSE ''
  END,
  last_name = CASE 
    WHEN raw_params ~ 'Last Name":"([^"]+)"' 
    THEN substring(raw_params from 'Last Name":"([^"]+)"')
    ELSE ''
  END,
  email = CASE 
    WHEN raw_params ~ 'Email":"([^"]+)"' 
    THEN substring(raw_params from 'Email":"([^"]+)"')
    ELSE ''
  END,
  address = CASE 
    WHEN raw_params ~ 'Address":"([^"]+)"' 
    THEN substring(raw_params from 'Address":"([^"]+)"')
    ELSE ''
  END,
  city = CASE 
    WHEN raw_params ~ 'City":"([^"]+)"' 
    THEN substring(raw_params from 'City":"([^"]+)"')
    ELSE ''
  END,
  state = CASE 
    WHEN raw_params ~ 'State":"([^"]+)"' 
    THEN substring(raw_params from 'State":"([^"]+)"')
    ELSE ''
  END,
  market = CASE 
    WHEN raw_params ~ 'Market":"([^"]+)"' 
    THEN substring(raw_params from 'Market":"([^"]+)"')
    ELSE ''
  END,
  client_type = CASE 
    WHEN raw_params ~ 'Type":"([^"]+)"' 
    THEN substring(raw_params from 'Type":"([^"]+)"')
    ELSE ''
  END,
  secret_key = CASE 
    WHEN raw_params ~ 'Secretkey":"([^"]+)"' 
    THEN substring(raw_params from 'Secretkey":"([^"]+)"')
    ELSE ''
  END,
  lead_id = CASE 
    WHEN raw_params ~ 'Leadid":([0-9]+)' 
    THEN substring(raw_params from 'Leadid":([0-9]+)')::BIGINT
    ELSE NULL 
  END
WHERE raw_params IS NOT NULL AND raw_params != '';

-- Show results
SELECT 'Data extraction results:' as status;
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN first_name != '' THEN 1 END) as with_names,
  COUNT(CASE WHEN email != '' THEN 1 END) as with_emails,
  COUNT(CASE WHEN address != '' THEN 1 END) as with_addresses,
  COUNT(CASE WHEN event_type = 'CONNECT' AND first_name != '' THEN 1 END) as connects_with_names
FROM vdp_events_complete;