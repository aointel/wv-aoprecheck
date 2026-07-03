#!/bin/bash

# Create temp table and import data
psql $DATABASE_URL << 'EOF'
DROP TABLE IF EXISTS vdp_raw_import;
CREATE TEMP TABLE vdp_raw_import (
  date_col TEXT,
  time_col TEXT,
  event_type TEXT,
  phone TEXT,
  agent_id TEXT,
  params_json TEXT
);
EOF

# Use \copy to import from file
psql $DATABASE_URL -c "\copy vdp_raw_import FROM '/tmp/vdp_complete.csv' WITH CSV HEADER"

# Process and insert the data
psql $DATABASE_URL << 'EOF'
-- Clear existing data first
TRUNCATE TABLE vdp_events_complete RESTART IDENTITY;

-- Insert processed data
INSERT INTO vdp_events_complete (
  event_date, event_time, event_type, phone, agent_id, 
  first_name, last_name, client_type, market, lead_id,
  secret_key, email, address, city, state, associate_id,
  referred_by, relationship, sponsors_org, beneficiary,
  client_phone, taalk_campaign, taalk_session, raw_params
)
SELECT 
  -- Convert date format from MM/DD/YYYY to YYYY-MM-DD
  TO_DATE(date_col, 'MM/DD/YYYY'),
  -- Convert time from 12-hour to 24-hour format
  TO_TIMESTAMP(time_col, 'HH12:MI:SS AM')::TIME,
  event_type,
  phone,
  agent_id,
  -- Extract JSON fields using PostgreSQL JSON functions
  COALESCE(params_json::json->>'First Name', ''),
  COALESCE(params_json::json->>'Last Name', ''),
  COALESCE(params_json::json->>'Type', ''),
  COALESCE(params_json::json->>'Market', ''),
  CASE WHEN params_json::json->>'Leadid' ~ '^[0-9]+$' 
       THEN (params_json::json->>'Leadid')::BIGINT 
       ELSE NULL END,
  COALESCE(params_json::json->>'Secretkey', ''),
  COALESCE(params_json::json->>'Email', ''),
  COALESCE(params_json::json->>'Address', ''),
  COALESCE(params_json::json->>'City', ''),
  COALESCE(params_json::json->>'State', ''),
  COALESCE(params_json::json->>'AsscociateId', ''),
  params_json::json->>'Reffered by',
  params_json::json->>'Relationship',
  params_json::json->>'Sponsors Org',
  COALESCE(params_json::json->>'Beneficiary', ''),
  COALESCE(params_json::json->>'Phone', ''),
  COALESCE(params_json::json->>'Taalk_Campaign', ''),
  COALESCE(params_json::json->>'Taalk_Session', ''),
  params_json
FROM vdp_raw_import
WHERE params_json IS NOT NULL AND params_json != '';

-- Show import statistics
SELECT 'Import completed. Total records:', COUNT(*) FROM vdp_events_complete;

SELECT 'Event type breakdown:' as info;
SELECT event_type, COUNT(*) FROM vdp_events_complete GROUP BY event_type ORDER BY COUNT(*) DESC LIMIT 10;

SELECT 'Sample CONNECT events with full client data:' as info;
SELECT 
  event_date, 
  agent_id, 
  first_name || ' ' || last_name as client_name,
  phone as client_phone,
  email,
  address,
  city,
  state,
  market
FROM vdp_events_complete 
WHERE event_type = 'CONNECT' 
AND first_name != '' 
LIMIT 5;
EOF