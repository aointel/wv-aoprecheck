# Verification Session Data Automation

## Overview
This document explains how verification sessions automatically collect IP addresses, transcripts, summaries, and perform IP analysis.

## Automatic Data Collection

### 1. IP Address Capture

**When Client Visits Verification Link:**
- Client visits `/client-verification?session=XXX`
- Frontend automatically:
  1. Fetches public IP using `ipify.org`
  2. Calls `/api/verification/session/:sessionId/capture-client-ip`
  3. Server captures IP, User Agent, and geolocation data
  4. Stores in Supabase: `client_ip_address`, `client_country`, `client_city`, `client_latitude`, `client_longitude`, `client_isp`, `client_timezone`

**When Agent Visits Verification Link:**
- Agent visits `/agent-verification?session=XXX`
- Frontend automatically:
  1. Fetches public IP using `ipify.org`
  2. Calls `/api/verification/session/:sessionId/capture-agent-ip`
  3. Server captures IP, User Agent, and geolocation data
  4. Stores in Supabase: `agent_ip_address`, `agent_country`, `agent_city`, `agent_latitude`, `agent_longitude`, `agent_isp`, `agent_timezone`

**No manual action required** - IPs are captured automatically when links are visited.

### 2. IP Analysis

**Automatic Analysis:**
- Runs automatically when BOTH IPs are available
- Triggers after:
  1. Client IP is captured (checks if agent IP exists)
  2. Agent IP is captured (checks if client IP exists)

**Analysis Checks:**
- **Critical**: Same IP address → Agent may be impersonating client
- **Flagged**: Same city or < 25 miles apart → Suspicious for Zoom presentations
- **Suspicious**: Same region or < 100 miles apart → Worth reviewing
- **Valid**: Different locations > 100 miles → Expected for Zoom

**Results Stored:**
- `ip_analysis` (JSONB): Full analysis with confidence, reason, distance
- `ip_flag_status`: `valid` | `flagged` | `suspicious` | `critical` | `pending`
- `ip_flag_reason`: Human-readable explanation

**Automation Scheduler:**
- Runs every 15 minutes
- Finds sessions with both IPs but no analysis
- Runs analysis and stores results
- Ensures no sessions are missed

### 3. Transcript & Summary Collection

**Automatic Collection:**
- Scheduler runs every 15 minutes
- Finds ALL sessions with `taalk_call_id` (REGARDLESS OF STATUS)
- Fetches missing transcripts and AI summaries from Taalk API
- Processes up to 100 sessions per run

**What Gets Stored:**
- `call_transcript`: Full call transcript text
- `taalk_ai_summary`: Raw AI summary JSON
- Parsed fields:
  - `ai_quick_recap`, `ai_next_steps`, `ai_key_topics`
  - `ai_sentiment_score`, `ai_result`, `ai_result_passed`
  - `ai_red_flags`, `ai_favorite_feature`
  - Compliance fields: `compliance_agent_confirmed`, `compliance_contact_verified`, etc.

**Manual Backfill:**
- Run `npm run backfill-all-transcripts` to process all historical sessions
- Options:
  - `--limit=N`: Process only first N sessions
  - `--force`: Re-fetch even if data exists

## Database Columns

### IP Address Columns
- `client_ip_address`, `agent_ip_address`
- `client_country`, `agent_country`
- `client_city`, `agent_city`
- `client_region`, `agent_region`
- `client_latitude`, `agent_latitude`
- `client_longitude`, `agent_longitude`
- `client_timezone`, `agent_timezone`
- `client_isp`, `agent_isp`
- `client_user_agent`, `agent_user_agent`

### IP Analysis Columns
- `ip_analysis` (JSONB): Full analysis result
- `ip_flag_status` (TEXT): `valid` | `flagged` | `suspicious` | `critical` | `pending`
- `ip_flag_reason` (TEXT): Human-readable explanation

### Transcript/Summary Columns
- `call_transcript` (TEXT): Full transcript
- `taalk_ai_summary` (TEXT/JSON): AI summary
- All parsed AI fields (see above)

## Schedulers

### 1. Verification Automation Scheduler
- **Frequency**: Every 15 minutes
- **Purpose**: Run IP analysis for sessions with both IPs
- **File**: `server/verification-automation-scheduler.ts`

### 2. Transcript/Summary Scheduler
- **Frequency**: Every 15 minutes
- **Purpose**: Fetch missing transcripts and summaries
- **File**: `server/transcript-summary-scheduler.ts`

### 3. ConnectNow Billing Daily Scheduler
- **Frequency**: Daily at midnight PST
- **Purpose**: Populate billing data for ConnectNow Analytics
- **File**: `server/connectnow-billing-daily-scheduler.ts`

## Manual Scripts

### Backfill All Transcripts
```bash
# Process all sessions
npm run backfill-all-transcripts

# Test with first 100
npm run backfill-all-transcripts -- --limit=100

# Force re-fetch
npm run backfill-all-transcripts -- --force
```

## Ensuring Data Collection

### IP Addresses
✅ **Automatic** - No action needed
- Frontend pages automatically capture IPs when visited
- Both client and agent IPs are captured

### IP Analysis
✅ **Automatic** - No action needed
- Runs automatically when both IPs are available
- Scheduler catches any missed sessions every 15 minutes

### Transcripts/Summaries
✅ **Automatic** - No action needed
- Scheduler fetches missing data every 15 minutes
- Processes ALL sessions with `taalk_call_id` regardless of status

## Verification

### Check IP Capture
```sql
SELECT 
  session_id,
  client_ip_address,
  agent_ip_address,
  client_city,
  agent_city,
  ip_flag_status
FROM verification_sessions
WHERE client_ip_address IS NOT NULL 
   OR agent_ip_address IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Check IP Analysis
```sql
SELECT 
  session_id,
  ip_flag_status,
  ip_flag_reason,
  ip_analysis->>'confidence' as confidence
FROM verification_sessions
WHERE ip_flag_status IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Check Transcripts
```sql
SELECT 
  session_id,
  status,
  taalk_call_id,
  call_transcript IS NOT NULL as has_transcript,
  taalk_ai_summary IS NOT NULL as has_summary
FROM verification_sessions
WHERE taalk_call_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

