# How Live Call Board Separates Hierarchy

## Overview

The Live Call Board uses the `agent_hierarchy` table to filter which agents are visible to each user based on their MGA/RGA role.

## Hierarchy Structure

The `agent_hierarchy` table contains:
- `agent_email` - The agent's email
- `mga_associate_id` - The MGA (Master General Agent) associate ID
- `rga_associate_id` - The RGA (Regional General Agent) associate ID

## How Filtering Works

### 1. **Automatic Filtering (Non-SysOp Users)**

If the user is **NOT** a sysop (`cnsysop@aoglobelife.com` or `chrislafond@aoglobelife.com`):

1. Gets the user's `associate_id` from the `customers` table
2. Queries `agent_hierarchy` to find all agents where:
   - User is the **MGA** (`mga_associate_id = userAssociateId`), OR
   - User is the **RGA** (`rga_associate_id = userAssociateId`)
3. Only shows agents that match this hierarchy

**Code:**
```typescript
if (!isSysOp && userAssociateId) {
  // Get agents where user is MGA
  const { data: mgaAgents } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_email')
    .eq('mga_associate_id', userAssociateId);
  
  // Get agents where user is RGA
  const { data: rgaAgents } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_email')
    .eq('rga_associate_id', userAssociateId);
  
  // Combine both lists (user can see agents where they're MGA OR RGA)
  const allowedEmails = new Set([
    ...(mgaAgents || []).map(a => a.agent_email?.toLowerCase()),
    ...(rgaAgents || []).map(a => a.agent_email?.toLowerCase())
  ]);
  
  // Filter to only show allowed agents
  filteredAgentEmails = uniqueAgents.filter(email => allowedEmails.has(email.toLowerCase()));
}
```

### 2. **Manual Filtering (Query Parameters)**

Users can also filter by specific MGA/RGA using query parameters:

- `mgaFilter` - Filter by specific MGA associate ID
- `rgaFilter` - Filter by specific RGA associate ID

**Examples:**
- `/api/live-call-board/agents?mgaFilter=123` - Shows all agents under MGA 123
- `/api/live-call-board/agents?rgaFilter=456` - Shows all agents under RGA 456
- `/api/live-call-board/agents?mgaFilter=123&rgaFilter=456` - Shows agents under BOTH MGA 123 AND RGA 456

**Code:**
```typescript
if (mgaFilter || rgaFilter) {
  const filterMgaId = mgaFilter ? parseInt(mgaFilter as string) : null;
  const filterRgaId = rgaFilter ? parseInt(rgaFilter as string) : null;
  
  if (filterMgaId) {
    // Get agents under this MGA
    const { data: mgaAgents } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_email')
      .eq('mga_associate_id', filterMgaId);
    
    if (filterRgaId) {
      // Filter by BOTH MGA and RGA
      const { data: filtered } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('agent_email')
        .eq('mga_associate_id', filterMgaId)
        .eq('rga_associate_id', filterRgaId);
      filteredByHierarchy = (filtered || []).map(a => a.agent_email?.toLowerCase());
    } else {
      filteredByHierarchy = (mgaAgents || []).map(a => a.agent_email?.toLowerCase());
    }
  } else if (filterRgaId) {
    // Filter by RGA only
    const { data: rgaAgents } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_email')
      .eq('rga_associate_id', filterRgaId);
    filteredByHierarchy = (rgaAgents || []).map(a => a.agent_email?.toLowerCase());
  }
  
  // Apply the filter
  if (filteredByHierarchy.length > 0) {
    const allowedSet = new Set(filteredByHierarchy);
    filteredAgentEmails = filteredAgentEmails.filter(email => allowedSet.has(email.toLowerCase()));
  }
}
```

### 3. **SysOp Users**

SysOp users (`cnsysop@aoglobelife.com` or `chrislafond@aoglobelife.com`) see **ALL agents** with no hierarchy filtering.

## Data Source

The Live Call Board reads from:
- **Primary**: `live_call_boardt` table (updated by SQL triggers from `agent_dial_metrics`)
- **Hierarchy**: `agent_hierarchy` table (for filtering)
- **User Info**: `customers` table (to get user's `associate_id`)

## Summary

**Hierarchy Separation Logic:**
1. Get all agents from `live_call_boardt`
2. If user is NOT sysop → Filter to agents where user is MGA or RGA
3. If `mgaFilter`/`rgaFilter` provided → Further filter by those IDs
4. Return filtered list of agents

**Key Points:**
- Hierarchy is stored in `agent_hierarchy` table
- Each agent has one MGA and one RGA
- Users see agents where they are the MGA OR RGA
- SysOps see all agents
- Manual filters can narrow down to specific MGA/RGA

