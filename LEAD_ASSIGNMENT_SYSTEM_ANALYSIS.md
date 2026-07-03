# Lead Assignment & Rotation System Analysis

## Executive Summary

The system uses a **manual lead request model** with automatic refill and recycling. Agents request leads via API endpoints, and the system maintains a **50 callable lead limit** per agent. There is **no dedicated queue table** - leads are stored in `masterlead` with assignment tracked via `cn_email`. Concurrency protection uses a `currently_calling` flag, but **NO database-level locking** (no `FOR UPDATE SKIP LOCKED`).

---

## 1. Relevant Files & Functions

### Main API Endpoints:
- **`server/routes.ts`**:
  - `GET /api/outbound-dialer/leads` (line 20285) - Main endpoint for fetching agent's leads
  - `POST /api/leads/request-leads` (line 9986) - Manual lead request endpoint
  - `GET /api/outbound-dialer/leads/search` (line 21486) - Search leads for an agent

### Lead Assignment Logic:
- **`server/lead-assignment-scheduler.ts`**:
  - `assignLeadsToAgent()` (line 261) - Assigns leads to a specific agent
  - `recycleCalledLeads()` (line 348) - Recycles leads every 30 minutes
  - `midnightReset()` (line 45) - Daily reset at midnight
- **`server/hotlead-auto-assign.ts`**:
  - `autoAssignHotleadsToActiveAgents()` (line 9) - Auto-assigns hotleads to active agents
- **`server/hotlead-sync-service.ts`**:
  - `assignHotleads()` (line 456) - Assigns hotleads based on availability

### Lead Counting/Filtering:
- **`server/timezone-helper.ts`**:
  - `countCallableLeads()` (line 235) - Counts callable leads for an agent
  - `isSafeToCall()` (line 179) - Checks if lead is within timezone restriction

### Caching:
- **`server/outbound-dialer-lead-cache.ts`**:
  - `OutboundDialerLeadCache` class - Caches agent leads for search

---

## 2. Data Model

### Primary Table: `masterlead`

**Key columns:**
- `id` - Primary key
- `cn_email` - Assigned agent email (NULL = unassigned)
- `cnresolution` - Lead status: `null`, `'pending'`, `'called'`, `'no_answer_vm'`, `'booked'`, `'closed'`, `'sale'`, etc.
- `assigned_date` - When lead was assigned to agent
- `previous_cn_email` - Previous agent assignment (for rotation)
- `last_assigned_date` - Last assignment timestamp
- `currently_calling` - Boolean flag indicating if lead is actively being called
- `dnc` - Do Not Call flag
- `taalk_market` - Market type (e.g., 'Veteran', 'Plus Lead', 'Plus Leads')
- `taalk_state` / `state` - Lead's state
- `is_hot_lead` - Boolean flag for hotleads
- `priority_score` - Priority score for hotleads
- `ftcrestricted` / `FTCRESTRICTED` - FTC restriction flag ('NO' = no restriction)

### Supporting Tables:
- `customers` - Agent profiles with `states` (JSON array) and `market` (JSON array)
- `agent_live_call_status` - Tracks active calls (`status`, `call_started_at`)
- `agent_lead_progress` - Tracks agent position in lead queue (for resume functionality)

### TypeScript Interfaces:
```typescript
// From server/outbound-dialer-lead-cache.ts
interface OutboundLeadRecord {
  id: number | string;
  taalk_lead_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  state?: string | null;
  cnresolution?: string | null;
  cn_email?: string | null;
  updated_at?: string | null;
}
```

---

## 3. Current Lead Allocation Logic

### Main "Get Next Lead" Flow (`GET /api/outbound-dialer/leads`):

**Step 1: Auto-Refill Check (lines 20335-20504)**
- Counts callable leads using `countCallableLeads()`
- If agent has ≤ 10 callable leads, auto-refills to 50
- Fetches unassigned leads matching agent's market/states
- Sorts by state rarity (states with fewest licensed agents first)
- Assigns exactly `50 - currentCount` leads

**Step 2: Lead Fetching Query (lines 20506-20524)**
```typescript
supabaseQuery = supabase
  .from('masterlead')
  .select('*, FTCRESTRICTED')
  .eq('cnresolution', 'pending')
  .eq('cn_email', userEmail)
  .not('taalk_market', 'in', '(Plus Lead,Plus Leads)')
  .limit(10000);
```

**Step 3: Manual Lead Request (`POST /api/leads/request-leads`)**
- Counts current callable leads
- Calculates `needed = 50 - current`
- Fetches unassigned leads matching agent's market/states
- Sorts by state rarity
- Assigns leads via update:
```typescript
await supabaseAdmin
  .from('masterlead')
  .update({
    cn_email: agentEmail,
    assigned_date: new Date().toISOString(),
    cnresolution: 'pending'
  })
  .in('id', leadIds);
```

### Lead Selection Criteria:
- **Unassigned**: `cn_email IS NULL`
- **Not DNC**: `dnc = false`
- **Exclude DC state**: `state != 'DC' AND taalk_state != 'DC'`
- **Exclude booked/closed/sale**: `cnresolution NOT IN ('booked', 'closed', 'sale')`
- **Exclude plus leads**: `taalk_market NOT IN ('Plus Lead', 'Plus Leads')`
- **Match agent's market**: `taalk_market = agentMarket`
- **Match agent's states**: `state IN agentStates OR taalk_state IN agentStates`
- **Exclude recently assigned**: `previous_cn_email != agentEmail OR last_assigned_date < 7 days ago`
- **Ordering**: State rarity (fewest licensed agents first), then FIFO

---

## 4. Queue / Per-Agent Bucket Behavior

### No Dedicated Queue Table:
- Leads are stored in `masterlead` with `cn_email` indicating assignment
- Agent's "queue" = all leads where `cn_email = agentEmail`

### Lead Limit:
- **Maximum**: 50 callable leads per agent
- **Callable leads defined as**: `cnresolution IN (null, 'pending', 'called', 'no_answer_vm')` AND NOT plus leads AND NOT DNC
- **Timezone restriction does NOT affect count** (timezone is for "can call RIGHT NOW", not "is callable")

### Refill Triggers:
1. **Auto-refill**: When agent fetches leads via `GET /api/outbound-dialer/leads` and has ≤ 10 callable leads
2. **Manual request**: Agent calls `POST /api/leads/request-leads`
3. **Hotlead auto-assignment**: Runs every minute, assigns unassigned hotleads to active agents

### Recycling Logic (`recycleCalledLeads()` - runs every 30 minutes):
1. **Recycles `'called'` and `'no_answer_vm'` leads** (unassigns and resets to `'pending'`)
2. **Unassigns timezone-restricted leads** (only for pending/called/no_answer)
3. **Enforces 50 callable lead limit**: If agent has > 50 callable leads, unassigns excess (prioritizes timezone-restricted first)

---

## 5. Concurrency / Safety

### Current Protection:
- **`currently_calling` flag**: Used to prevent unassigning leads during active calls
  - Queries filter: `.or('currently_calling.is.null,currently_calling.eq.false')`
  - Example: `server/lead-assignment-scheduler.ts` lines 408, 413, 452, 457, etc.

### No Database-Level Locking:
- ❌ **NO `FOR UPDATE SKIP LOCKED`** in SQL queries
- ❌ **NO row-level locking** when assigning leads
- ⚠️ **Race condition risk**: Two agents could potentially be assigned the same lead if they request simultaneously

### Assignment Process:
1. Query for unassigned leads: `cn_email IS NULL`
2. Select leads (no locking)
3. Update leads: `cn_email = agentEmail`

### Potential Issues:
- **Race condition**: If two agents request leads simultaneously, they could both see the same unassigned leads and both get assigned
- **No transaction isolation**: Assignment is not atomic with the selection query
- **`currently_calling` flag** helps prevent unassignment during calls, but doesn't prevent double-assignment

---

## Main "Get Next Lead" Query

```typescript
// From server/routes.ts lines 20420-20428 (auto-refill)
const baseQuery = supabaseAdmin
  .from('masterlead')
  .select('id, state, taalk_state, taalk_market')
  .is('cn_email', null)  // Unassigned only
  .eq('dnc', false)  // Not DNC
  .neq('state', 'DC')  // Exclude DC
  .neq('taalk_state', 'DC')
  .not('taalk_market', 'in', '(Plus Lead,Plus Leads)')  // Exclude plus leads
  .or('cnresolution.is.null,cnresolution.eq.pending,cnresolution.eq.called,cnresolution.eq.new');

// Then filtered by market and states, sorted by state rarity, limited to needed count
// Finally updated:
await supabaseAdmin
  .from('masterlead')
  .update({
    cn_email: agentEmail,
    assigned_date: new Date().toISOString(),
    cnresolution: 'pending'
  })
  .in('id', leadIds);
```

---

## Notes & Potential Issues

1. ⚠️ **No atomic assignment**: Selection and update are separate operations, allowing race conditions
2. ⚠️ **No `FOR UPDATE SKIP LOCKED`**: Could use PostgreSQL row-level locking for safer concurrent assignment
3. ✅ **Callable lead definition**: Includes `'called'` and `'no_answer_vm'` in addition to `null` and `'pending'`
4. ✅ **Timezone handling**: Timezone restriction doesn't affect callable count, only whether you can call RIGHT NOW
5. ✅ **Plus leads**: Excluded from callable count and recycling, but still assigned to agents
6. ✅ **State rarity sorting**: Prioritizes states with fewest licensed agents for better distribution
7. ✅ **7-day cooldown**: Prevents re-assigning same lead to same agent within 7 days
8. 🧪 **TEST MODE**: Currently only processing `cameronchristensen@aoglobelife.com` in cleanup script (line 388)

---

## File Locations Summary

### Core Files:
- `server/routes.ts` - Main API endpoints (35,000+ lines)
- `server/lead-assignment-scheduler.ts` - Scheduled assignment/recycling (815 lines)
- `server/timezone-helper.ts` - Lead counting and timezone logic (372 lines)
- `server/hotlead-auto-assign.ts` - Hotlead auto-assignment (183 lines)
- `server/outbound-dialer-lead-cache.ts` - Lead caching for search (203 lines)

### Key Functions:
- `countCallableLeads()` - Counts callable leads (null/pending/called/no_answer_vm, excludes plus leads)
- `assignLeadsToAgent()` - Assigns leads matching agent's territory
- `recycleCalledLeads()` - Recycles leads and enforces 50-lead limit
- `autoAssignHotleadsToActiveAgents()` - Auto-assigns hotleads every minute

---

## Recommendations

1. **Add database-level locking** using `FOR UPDATE SKIP LOCKED` to prevent race conditions
2. **Make assignment atomic** by combining selection and update in a single transaction
3. **Consider adding a queue table** for better performance and tracking
4. **Add retry logic** for failed assignments
5. **Monitor for duplicate assignments** and add alerts

---

*Analysis completed: 2025-01-XX*
*Codebase version: Current master branch*




