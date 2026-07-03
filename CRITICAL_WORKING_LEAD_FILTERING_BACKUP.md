# CRITICAL WORKING LEAD FILTERING SYSTEM - DO NOT MODIFY
## Status: CONFIRMED WORKING - Christmas Miracle! 🎄

**Date:** August 01, 2025
**Status:** HARD LOCKED - System confirmed working by user

## Lead Filtering Logic That WORKS

### 1. User Email Filtering (WORKING)
```javascript
// Query ONLY the masterlead table with cn_email filter
const { data: leads, error } = await supabaseAdmin
  .from('masterlead')
  .select('*')
  .eq('cn_email', queryEmail)
  .order('created_at', { ascending: false });

// Special handling for chrislafond typo
if (userEmail === 'chrislafond@aoglobelife.com') {
  queryEmail = 'chrislafond@aoglboelife.com'; // Database has typo - missing 'i'
}
```

### 2. Market Filtering (WORKING)
```javascript
// Filter by market if specified - map frontend market names to database values
let filteredLeads = leads;
if (selectedMarkets && selectedMarkets.length > 0) {
  filteredLeads = leads.filter(lead => {
    const leadMarket = (lead.taalk_market || '').toLowerCase();
    
    return selectedMarkets.some((market: string) => {
      const requestedMarket = market.toLowerCase();
      
      // Map frontend market names to database values with flexible matching
      if (requestedMarket.includes('veteran')) {
        return leadMarket.includes('veteran');
      }
      if (requestedMarket.includes('globe')) {
        return leadMarket.includes('globe') || leadMarket.includes('global');
      }
      if (requestedMarket.includes('plus')) {
        return leadMarket.includes('plus');
      }
      if (requestedMarket.includes('will') || requestedMarket.includes('kit')) {
        return leadMarket.includes('will') || leadMarket.includes('kit');
      }
      if (requestedMarket.includes('connectnow') || requestedMarket.includes('connect')) {
        return leadMarket.includes('connectnow') || leadMarket.includes('connect') || 
               leadMarket.includes('cn') || leadMarket.includes('globe');
      }
      return leadMarket === requestedMarket || leadMarket.includes(requestedMarket);
    });
  });
}
```

### 3. Data Quality Filtering (WORKING)
```javascript
const formattedLeads = filteredLeads.filter((lead) => {
  const hasValidName = lead.first_name && lead.last_name && 
    !lead.first_name.includes("call(s) made") && 
    !lead.last_name.includes("SMS sent");
  const hasValidPhone = lead.phone && lead.phone !== "null" && lead.phone.length >= 10;
  return hasValidName && hasValidPhone;
});
```

### 4. Key Endpoints (DO NOT MODIFY)
- `/api/outbound-dialer/leads` (POST) - Main lead filtering endpoint
- Uses `server/masterleads-sync.ts` for Supabase queries
- Exclusively uses Supabase masterlead table (no local fallback)

### 5. Console Log Evidence of Working System
```
✅ Found X leads from masterlead for [email]
🎯 Filtering: Found X total leads, returning Y leads after filtering for markets: [selected markets]
📋 Sample lead: [name] [phone]
```

## CRITICAL DEPENDENCIES
- Supabase connection via `supabaseAdmin`
- masterlead table structure with fields:
  - `cn_email` (user assignment)
  - `taalk_market` (campaign type)
  - `first_name`, `last_name` (lead names)
  - `phone` (contact number)
  - `created_at` (ordering)

## WARNING
This system is confirmed working by the user. Any modifications to the filtering logic could break lead assignment and market filtering functionality.

**PRESERVE THIS EXACT LOGIC AT ALL COSTS**