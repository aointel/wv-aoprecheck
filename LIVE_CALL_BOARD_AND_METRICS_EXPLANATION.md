# Live Call Board & Agent Dial Metrics System - Complete Explanation

## Overview

The AO Intelligence platform uses two interconnected systems to track and display real-time agent performance metrics:

1. **`agent_dial_metrics`** - The source of truth for all dial/reach/booked events
2. **`live_call_board`** - The real-time display table that aggregates data from `agent_dial_metrics` and other sources

Both systems work together to provide accurate, real-time tracking of agent activity that persists even when leads are cleaned up, reassigned, or deleted from the masterlead table.

---

## PART 1: Agent Dial Metrics (`agent_dial_metrics` table)

### Purpose

The `agent_dial_metrics` table is the **independence layer** that tracks dial/reach/booked metrics separately from the `masterlead` table. This critical design decision allows:

- **Historical accuracy**: Metrics persist even when leads are deleted or reassigned in `masterlead`
- **Data integrity**: Performance metrics remain accurate across date ranges regardless of lead cleanup operations
- **Flexible reporting**: Enables accurate reporting for any time period without dependency on lead status

### Table Structure

```sql
CREATE TABLE agent_dial_metrics (
  id BIGSERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL,
  agent_name TEXT,
  lead_id BIGINT,              -- Reference to masterlead.id (nullable - leads can be deleted)
  lead_phone TEXT NOT NULL,    -- Stored for historical tracking even if lead is deleted
  lead_name TEXT,
  lead_state TEXT,
  event_type TEXT NOT NULL,    -- 'dial', 'reach', or 'booked'
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  call_duration INTEGER,       -- Duration in seconds
  call_status TEXT,            -- 'completed', 'no_answer', 'busy', 'failed', etc.
  disposition TEXT,            -- Call disposition if available
  call_sid TEXT,               -- Twilio call SID if available
  source TEXT,                 -- 'dialer', 'vdp', 'manual', 'hotlead', 'ao_intel_inbound', etc.
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Event Types

The table tracks three distinct event types:

1. **`dial`** - A contact attempt was made (call was initiated)
2. **`reach`** - Human contact was made (call was answered and connected)
3. **`booked`** - An appointment was set (qualifies as both reach and booked)

### When Events Are Logged

Events are logged through the `logCallOutcome()` function in `server/agent-dial-metrics-tracker.ts`:

#### Dial Events
- **Always logged** when a contact attempt is made
- Triggered for: outbound calls, inbound calls (PICK_UP events), manual dials, VDP connects

#### Reach Events
- **Logged conditionally** when human contact is made
- Criteria:
  - Disposition indicates contact: 'contacted', 'connected', 'talked', 'qualified', 'interested', etc.
  - **OR** call duration >= 15 seconds
  - Excludes: 'no_answer', 'busy', 'failed', 'voicemail', 'bad_number', 'no_answer_vm'

#### Booked Events
- **Logged conditionally** when an appointment is set
- Criteria:
  - Disposition indicates booking: 'appointment', 'booked', 'qualified', 'instant_presentation', 'sale'
  - **OR** disposition = 'interested' AND duration >= 60 seconds
  - Requires duration >= 60 seconds if duration is available

### Key Features

1. **Phone Number Normalization**: All phone numbers are cleaned (non-digits removed) before storage
2. **Validation**: Ensures phone numbers have at least 10 digits
3. **Non-blocking**: Logging failures don't crash the application - errors are logged but don't throw
4. **Source Tracking**: Every event records its source ('dialer', 'vdp', 'ao_intel_inbound', etc.)

### Indexes for Performance

```sql
-- Fast lookups by agent and date
CREATE INDEX idx_agent_dial_metrics_agent_email ON agent_dial_metrics(agent_email);
CREATE INDEX idx_agent_dial_metrics_event_timestamp ON agent_dial_metrics(event_timestamp DESC);
CREATE INDEX idx_agent_dial_metrics_agent_date ON agent_dial_metrics(agent_email, event_timestamp DESC);

-- Event type filtering
CREATE INDEX idx_agent_dial_metrics_event_type ON agent_dial_metrics(event_type);

-- Composite index for common queries
CREATE INDEX idx_agent_dial_metrics_agent_date_type ON agent_dial_metrics(agent_email, event_timestamp DESC, event_type);
```

---

## PART 2: Live Call Board (`live_call_board` table)

### Purpose

The `live_call_board` table is the **display layer** that aggregates data from multiple sources to provide real-time agent status and performance metrics. The application **ONLY reads** from this table - it never writes directly to it.

### Table Structure

```sql
CREATE TABLE live_call_board (
  agent_email TEXT PRIMARY KEY,
  
  -- Agent Info
  agent_name TEXT,
  associate_id INTEGER,
  mga_name TEXT,
  rga_name TEXT,
  mga_associate_id INTEGER,
  rga_associate_id INTEGER,
  mga_team TEXT,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('online', 'calling', 'presenting', 'live', 'dialing', 'active', 'offline')),
  ccpro_enabled BOOLEAN DEFAULT false,
  available_for_inbound BOOLEAN DEFAULT false,
  has_call_connector_heartbeat BOOLEAN DEFAULT false,
  has_recruit_heartbeat BOOLEAN DEFAULT false,
  
  -- Current Activity (JSONB for flexibility)
  current_call JSONB,          -- { phoneNumber, duration, clientName, direction, callStatus, callSid, startedAt, answeredAt }
  current_presentation JSONB,  -- { type, presentationType, duration, clientName, clientPhone, presentationUrl, sessionId, startTime }
  current_live JSONB,          -- { type, lastActivity, duration }
  
  -- Today's Stats (calculated from agent_dial_metrics)
  today_dialed INTEGER DEFAULT 0,
  today_reached INTEGER DEFAULT 0,
  today_booked INTEGER DEFAULT 0,
  today_presentations INTEGER DEFAULT 0,
  today_sales INTEGER DEFAULT 0,
  today_alp NUMERIC DEFAULT 0,
  
  -- Time Tracking (in seconds)
  available_time INTEGER DEFAULT 0,
  waiting_time INTEGER DEFAULT 0,
  call_time INTEGER DEFAULT 0,
  
  -- Other Metrics
  connects INTEGER DEFAULT 0,
  credits_remaining INTEGER,
  pending_leads INTEGER DEFAULT 0,
  
  -- Timestamps
  last_activity TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### How Today's Stats Are Calculated

The `today_dialed`, `today_reached`, and `today_booked` fields are **automatically calculated** from `agent_dial_metrics` using SQL functions:

#### Timezone Handling
- "Today" is calculated based on **PST timezone** (America/Los_Angeles)
- The system converts PST day boundaries to UTC for querying (database stores everything in UTC)
- Formula: `today_start := (date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles'))::timestamp AT TIME ZONE 'America/Los_Angeles'`

#### Automatic Updates via Triggers

1. **Trigger on INSERT**: When a new row is inserted into `agent_dial_metrics`, a trigger automatically calls `update_live_call_board_stats_for_agent()` to update that agent's stats in real-time.

2. **Trigger on UPDATE**: If an `agent_dial_metrics` row is updated (event_type changes, timestamp changes, etc.), the trigger recalculates the agent's stats.

3. **Periodic Sync Function**: `update_live_call_board_stats_from_metrics()` can be run periodically (e.g., every minute via Supabase cron) to sync all agents' stats. This ensures data consistency even if triggers miss something.

#### Update Logic

```sql
-- For each agent, count events of each type for "today" (PST timezone)
SELECT 
  agent_email,
  COUNT(*) FILTER (WHERE event_type = 'dial') as dialed,
  COUNT(*) FILTER (WHERE event_type = 'reach') as reached,
  COUNT(*) FILTER (WHERE event_type = 'booked') as booked
FROM agent_dial_metrics
WHERE event_timestamp >= today_start
  AND event_timestamp < today_end
  AND agent_email IS NOT NULL
GROUP BY agent_email;
```

Then these counts are written to `live_call_board.today_dialed`, `today_reached`, and `today_booked`.

### Data Flow

```
Agent makes call
    ↓
logCallOutcome() logs to agent_dial_metrics
    ↓
INSERT trigger fires on agent_dial_metrics
    ↓
update_live_call_board_stats_for_agent() executes
    ↓
live_call_board.today_dialed/reached/booked updated in real-time
    ↓
Frontend reads from live_call_board and displays updated stats
```

### Other Data Sources

While today's stats come from `agent_dial_metrics`, other fields in `live_call_board` are updated by different services:

- **Status, heartbeats, current_call**: Updated by agent presence/heartbeat system
- **Current_presentation**: Updated when presentations start/end
- **Credits_remaining**: Updated from credit system
- **Pending_leads**: Calculated from masterlead table queries

---

## PART 3: AO Intel Inbound Call Handling

### Overview

AO Intel inbound calls are handled through the VDP webhook system (`/api/vdp/events`) and immediately assigned to the receiving agent with special processing to ensure they appear in Call Connector Pro.

### Event Types

AO Intel inbound calls trigger two VDP events:

1. **`PICK_UP`** - Incoming call received (lead calling agent back)
2. **`CONNECT`** - Call answered and connected (call in progress)

### PICK_UP Event Processing

When a `PICK_UP` event is received:

#### Step 1: Agent Identification
- Extract `agentId` (associate_id) from the webhook payload
- Look up agent's email from `user_credits` table using `associate_id`

#### Step 2: Lead Data Extraction
- Extract lead information from webhook:
  - `leadId` (taalk_lead_id)
  - `firstName` / `lastName`
  - `phone` / `phoneNumber` (caller's phone)
  - `state` (lead's state)
  - `market` (lead's market)

#### Step 3: Market Filtering
- Only process leads from specific markets:
  - **Veteran markets** (market name contains "veteran")
  - **Globe Market** (market name contains "globe market")
- All other markets are skipped with log message

#### Step 4: Masterlead Sync
- **Upsert** lead into `masterlead` table with:
  - `id` = leadId (from webhook)
  - `taalk_lead_id` = leadId (string format)
  - `cn_email` = agent's email (assigned to receiving agent)
  - `cnresolution` = **'AOIntel'** (special resolution indicating inbound call)
  - `source_table` = **'ao_intel_inbound'** (identifies it as AO Intel inbound)
  - All other lead data (name, phone, state, market)

**Purpose**: Ensures the lead appears in Call Connector Pro for the receiving agent immediately, allowing them to see the inbound call and disposition it properly.

#### Step 5: Dial Metric Logging
- Log a **"dial"** event to `agent_dial_metrics`:
  - `event_type` = 'dial'
  - `source` = 'ao_intel_inbound'
  - `agent_email` = agent's email
  - `lead_id` = leadId
  - `lead_phone` = caller's phone
  - No disposition or duration yet (call just received)

**Result**: 
- Lead appears in agent's Call Connector Pro queue
- `live_call_board.today_dialed` increments for that agent
- Agent can see and answer the inbound call

### CONNECT Event Processing

When a `CONNECT` event is received (call answered):

#### Step 1: Client Data Extraction
- Extract client information from `agent.params`:
  - `first_name` / `last_name` → `clientName`
  - `market` → market information
- Extract phone from `task.phone` or fallback to `phoneNumber`

#### Step 2: Special Handling for AO Recruit
- If market contains "recruit":
  - Look up agent email from `customers` table using `associate_id`
  - Check if recruit candidate already exists for this phone
  - If not exists and name available:
    - **Auto-create** `recruit_candidates` record:
      - `first_name`, `last_name`, `phone`
      - `status` = 'contacted'
      - `current_stage_id` = 1 (AO Recruit stage)
      - `agent_email` = agent's email
      - `notes` = "Auto-created from inbound VDP call on [date] at [time]"

#### Step 3: Billing Processing
- Create `vdp_connects` record to link the transaction
- Deduct credits using `creditService.deductCreditsForConnect()`:
  - **Service type**: Always `'aoi_connect'` (all VDP connects are $8.00 AOI Connect)
  - **Duration**: 60 seconds (estimated for real-time connects)
  - **Rate**: $8.00 per connect

#### Step 4: Reach/Booked Metric Logging
- Log **"dial"** and **"reach"** events to `agent_dial_metrics`:
  - `event_type` = 'reach' (call answered and connected)
  - `source` = 'ao_intel_inbound'
  - `disposition` = 'connected'
  - `call_duration` = 60 (estimated)
  - `call_status` = 'completed'

**Result**:
- Credits deducted from agent's account ($8.00)
- `live_call_board.today_reached` increments for that agent
- If recruit market, candidate automatically created in recruit system

### Complete Flow Diagram

```
Inbound call received from lead
    ↓
VDP webhook fires: PICK_UP event
    ↓
Agent identified via associate_id → email lookup
    ↓
Lead data extracted from webhook
    ↓
Market checked (Veteran or Globe Market only)
    ↓
Upsert to masterlead:
  - cn_email = agent email
  - cnresolution = 'AOIntel'
  - source_table = 'ao_intel_inbound'
    ↓
Log 'dial' event to agent_dial_metrics
    ↓
[Agent answers call]
    ↓
VDP webhook fires: CONNECT event
    ↓
Process billing (deduct $8.00 AOI Connect credits)
    ↓
If recruit market: Auto-create recruit_candidate
    ↓
Log 'reach' event to agent_dial_metrics
    ↓
Triggers update to live_call_board:
  - today_dialed++ (from PICK_UP)
  - today_reached++ (from CONNECT)
```

### Key Characteristics

1. **Immediate Assignment**: AO Intel inbound leads are immediately assigned to the receiving agent (`cn_email` set on masterlead)

2. **Special Resolution**: Uses `cnresolution = 'AOIntel'` to distinguish inbound calls from outbound dials

3. **Source Tracking**: All metrics logged with `source = 'ao_intel_inbound'` for accurate reporting

4. **Market Filtering**: Only processes Veteran and Globe Market calls (skips others silently)

5. **Automatic Candidate Creation**: Recruit calls automatically create candidate records in the recruit system

6. **Billing**: All AO Intel connects are billed as AOI Connect ($8.00) regardless of market

---

## Summary

### Key Takeaways

1. **`agent_dial_metrics` is the source of truth** for all dial/reach/booked tracking
2. **`live_call_board` aggregates data** from multiple sources for real-time display
3. **Today's stats are calculated** from `agent_dial_metrics` using PST timezone
4. **Triggers keep data in sync** automatically when new metrics are logged
5. **AO Intel inbound calls** are immediately assigned to agents and tracked with special resolution
6. **Metrics persist** even when leads are deleted or reassigned
7. **Timezone handling** ensures accurate "today" calculations regardless of server timezone

### Benefits of This Architecture

- **Data Integrity**: Metrics cannot be lost when leads are cleaned up
- **Real-Time Updates**: Triggers ensure live_call_board updates immediately
- **Historical Accuracy**: Can generate accurate reports for any date range
- **Performance**: Indexed tables and efficient queries ensure fast dashboard loading
- **Flexibility**: JSONB fields allow storing varying call/presentation data structures

---

## Maintenance & Monitoring

### Manual Sync

If stats appear incorrect, manually trigger a full sync:

```sql
SELECT update_live_call_board_stats_from_metrics();
```

Or via API endpoint:

```bash
POST /api/live-call-board/sync-today-stats
```

### Periodic Sync (Recommended)

Set up a Supabase cron job or pg_cron to run every minute:

```sql
-- Run every minute via Supabase cron
SELECT cron.schedule(
  'sync-live-call-board',
  '* * * * *',  -- Every minute
  $$SELECT update_live_call_board_stats_from_metrics()$$
);
```

### Verification Queries

Check if stats are syncing correctly:

```sql
-- Compare agent_dial_metrics counts vs live_call_board
SELECT 
  lcb.agent_email,
  lcb.today_dialed as lcb_dialed,
  (SELECT COUNT(*) FROM agent_dial_metrics 
   WHERE agent_email = lcb.agent_email 
   AND event_type = 'dial' 
   AND event_timestamp >= (date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles'))::timestamp AT TIME ZONE 'America/Los_Angeles'
   AND event_timestamp < (date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles'))::timestamp AT TIME ZONE 'America/Los_Angeles' + interval '1 day'
  ) as adm_dialed,
  lcb.today_reached as lcb_reached,
  (SELECT COUNT(*) FROM agent_dial_metrics 
   WHERE agent_email = lcb.agent_email 
   AND event_type = 'reach' 
   AND event_timestamp >= (date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles'))::timestamp AT TIME ZONE 'America/Los_Angeles'
   AND event_timestamp < (date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles'))::timestamp AT TIME ZONE 'America/Los_Angeles' + interval '1 day'
  ) as adm_reached
FROM live_call_board lcb
WHERE lcb.today_dialed > 0 OR lcb.today_reached > 0
ORDER BY lcb.agent_email;
```

Stats should match between `agent_dial_metrics` (adm_*) and `live_call_board` (lcb_*).

