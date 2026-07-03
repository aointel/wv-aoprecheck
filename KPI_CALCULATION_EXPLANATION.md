# EXACT KPI Calculation Logic - ConnectNow Analytics

## 1. **TRANSFERRED**
**Location**: `server/connectnow-analytics-service.ts:481`
- **Value**: **HARDCODED TO 0** 
- **Code**: `const transferred = 0; // Currently always 0`
- **This is not actually calculating anything - it's always zero**

---

## 2. **AGENT ANSWERED**
**Location**: `server/connectnow-analytics-service.ts:439-460`

**Calculation Process**:
1. Gets all phone numbers that belong to the campaign (using `getPhonesForCampaign()`)
2. For each phone, loops through its events
3. Counts **unique phone numbers** that have ANY of these events:
   - `PICK_UP`
   - `PICKED` 
   - `CONNECT` (only if `event.Agent` exists)
4. Uses a `Set` to ensure each phone is counted only once
5. Result: `agentAnsweredPhones.size`

**Code**:
```typescript
const agentAnsweredPhones = new Set<string>();
const campaignPhones = getPhonesForCampaign(phoneGroups, campaignId, dateFilter);

for (const phone of campaignPhones) {
  const phoneEvents = phoneGroups[phone] || [];
  const filteredEvents = dateFilter
    ? phoneEvents.filter(e => e.Date === dateFilter)
    : phoneEvents;
  
  for (const event of filteredEvents) {
    if (event.Event === 'PICK_UP' || event.Event === 'PICKED' || (event.Event === 'CONNECT' && event.Agent)) {
      agentAnsweredPhones.add(phone);
      break; // Count each phone only once
    }
  }
}

const agentAnswered = agentAnsweredPhones.size;
```

---

## 3. **BILLED**
**Location**: `server/connectnow-analytics-service.ts:482`
- **Value**: **Same as CONNECTED**
- **Code**: `const billed = connected; // Same as connected`
- So `billed = connects.length`

---

## 4. **CONNECTED**
**Location**: `server/connectnow-analytics-service.ts:199-333` (`findConnectsForCampaign()`)

**Calculation Process**:

**For INBOUND calls:**
- Finds all `CONNECT` events where `event.Agent` exists
- Checks if the CONNECT belongs to the campaign (via persona in Params, or by matching phone number)
- Counts each unique CONNECT event

**For OUTBOUND calls:**
- Gets all phones belonging to the campaign
- For each phone, looks for:
  1. `PICK_UP` or `PICKED` event
  2. `END` event that happens AFTER the PICK_UP
  3. Calculates call duration: `(END time - PICK_UP time)` in seconds
  4. **Only counts if call duration > 12 seconds**
- Also calculates ring duration: `(PICK_UP time - NEW time)` if NEW event exists

**Result**: Returns array of connects, then counts: `const connected = connects.length;`

---

## 5. **MISSED W/ AGENT**
**Location**: `server/connectnow-analytics-service.ts:336-392` (`findMissedCallsForCampaign()`) + Line 475

**Calculation Process**:
1. Gets all phones belonging to the campaign
2. For each phone:
   - **SKIPS if phone had PICK_UP/PICKED/CONNECT** (not actually missed)
   - Looks for `MISSED` or `NO_AGENT` events
   - Checks if agent was assigned by:
     - Looking for `BLASTER` event with `event.Agent` populated, OR
     - Checking if the MISSED/NO_AGENT event itself has an `Agent` field that's not empty
   - Sets `hadAgent = true` if either condition is met
3. Filters missed calls where `hadAgent === true`
4. Count: `const missedWithAgent = missedCalls.filter(m => m.hadAgent).length;`

**Code Logic**:
```typescript
let hadBlaster = false;
for (const event of filteredEvents) {
  if (event.Event === 'BLASTER' && event.Agent) {
    hadBlaster = true;
    break;
  }
}

hadAgent: hadBlaster || (missedEvent.Agent && missedEvent.Agent.trim() !== '')
```

---

## 6. **MISSED NO AGENT**
**Location**: Same as above, but filters opposite

**Calculation Process**:
- Same logic as "Missed w/ Agent"
- But filters where `hadAgent === false`
- Count: `const missedNoAgent = missedCalls.filter(m => !m.hadAgent).length;`

---

## SUMMARY OF ISSUES:

1. **Transferred** = Always 0 (not implemented)
2. **Billed** = Same as Connected (may not be correct if billing logic is different)
3. **Agent Answered** = Counts phones with PICK_UP/PICKED/CONNECT (may include calls that weren't actually answered by agent)
4. **Connected** = PICK_UP + END > 12 seconds OR CONNECT event (seems reasonable)
5. **Missed w/ Agent** = MISSED/NO_AGENT event + BLASTER event OR Agent field (depends on correct event data)
6. **Missed No Agent** = MISSED/NO_AGENT event without agent assignment (opposite of above)

**The main issues are likely:**
- Transferred is hardcoded to 0
- Agent Answered may be counting incorrectly
- Billed = Connected may not match actual billing logic

