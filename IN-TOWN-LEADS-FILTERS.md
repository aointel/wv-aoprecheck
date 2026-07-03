# EXACT FILTERS FOR "IN TOWN" LEADS

## API Level (server/outbound-dialer-lead-cache.ts)

The API fetches ALL leads where:
- `cn_email` = agent's email **OR**
- `associate_id` = user's associate_id

**NO FILTER ON `ao_lead_box` AT API LEVEL** - all leads are returned

## Frontend Filter (OutboundDialerInterface.tsx)

After API returns leads, frontend filters to show "In Town" leads:

### 1. Must be in `allMyLeadsEligible`:
```typescript
const myLeadsEligible = regularLeads.filter(lead => {
  // NOT a Plus lead
  const taalkMarket = (lead.taalk_market || '').toLowerCase();
  const market = (lead.market || '').toLowerCase();
  const isPlusLead = taalkMarket.includes('plus') || market.includes('plus');
  if (isPlusLead) return false;
  
  // Resolution must be empty, 'pending', or 'new'
  const resolution = String(lead.cnresolution ?? '').toLowerCase().trim();
  if (resolution !== '' && resolution !== 'pending' && resolution !== 'new') return false;
  
  // Associate ID must match (if both exist)
  const leadAssociateId = lead.associate_id ?? lead.TAALK_AssociateID ?? lead.assigned_to ?? lead.assignedTo;
  if (userAssociateId != null && leadAssociateId != null && String(leadAssociateId) !== userAssociateId) return false;
  
  return true;
});
```

### 2. Must pass `inSelectedBox` check:
```typescript
const inSelectedBox = (lead: any) => {
  const aoLeadBox = lead.ao_lead_box || lead.aoLeadBox;
  if (selectedLeadPool === 'all') return true;
  
  // Normalize: "In Town", "in-town", "intown" → "intown"
  const normalizeLeadBox = (v: string) => (v || '').toLowerCase().replace(/[- ]/g, '').trim();
  const canonicalLeadBox = (normalized: string): string => {
    if (normalized === 'intown') return 'intown';
    // ... other mappings
  };
  
  const leadCanon = canonicalLeadBox(normalizeLeadBox(aoLeadBox || ''));
  const poolCanon = canonicalLeadBox(normalizeLeadBox(selectedLeadPool));
  return leadCanon !== '' && leadCanon === poolCanon;
};
```

### 3. Must be PENDING (not disposed):
```typescript
const isPendingOrNew = (lead: any) => {
  const r = String(lead?.cnresolution ?? '').toLowerCase().trim();
  return r === '' || r === 'pending' || r === 'new';
};
const pendingOnly = allMyLeadsEligible.filter(isPendingOrNew);
```

## SUMMARY: Exact Requirements for "In Town" Leads

A lead shows in "In Town" tab if **ALL** of these are true:

1. ✅ `associate_id` matches user's associate_id **OR** `cn_email` matches agent's email
2. ✅ `ao_lead_box` (normalized) = "intown" 
   - Accepts: "In Town", "in-town", "intown", "In Town" (case-insensitive, spaces/dashes removed)
3. ✅ `cnresolution` is empty, 'pending', or 'new' (NOT disposed)
4. ✅ NOT a Plus lead (`taalk_market` doesn't include "plus" AND `market` doesn't include "plus")
5. ✅ `associate_id` matches user's associate_id (if both exist)

## Common Issues

### Leads not showing? Check:

1. **`ao_lead_box` is NULL or wrong value**
   - Must be exactly "intown" (normalized) - check raw DB value
   - Run: `SELECT id, ao_lead_box, associate_id, cnresolution FROM masterlead WHERE associate_id = YOUR_ID LIMIT 20;`

2. **`cnresolution` is not pending**
   - Must be NULL, empty string, 'pending', or 'new'
   - If it's 'called', 'booked', 'no_answer', etc. → won't show

3. **Plus lead**
   - Check `taalk_market` and `market` columns
   - If either contains "plus" → filtered out

4. **Associate ID mismatch**
   - Lead's `associate_id` must match user's `associate_id`
   - OR lead's `cn_email` must match agent's email

5. **Priority 99 leads**
   - Priority 99 leads show in ALL boxes (including In Town) even if `ao_lead_box` doesn't match
   - This is intentional behavior

