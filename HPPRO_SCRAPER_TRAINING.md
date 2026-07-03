# HPPRO Data Scraper Training Guide

## Current Scraping (Every 10 seconds)

**Basic Data:**
- ✅ URL (current page in HPPRO)
- ✅ Page title
- ✅ Full text content (5KB limit)
- ✅ HTML content (10KB limit)
- ✅ All forms with field names and values
- ✅ All links (first 50)
- ✅ All images (first 20)
- ✅ All headings (H1, H2, H3)

## What AI Extracts

**Client Information:**
- Primary first/last name
- Primary age, phone, email
- Primary address (city, state, zip)
- Spouse first/last name
- Sponsor first/last name & organization

**Premium Amounts:**
- Selected plan ALP (Accidental Life Premium)
- Selected plan AHP (Accidental Health Premium)
- Combined daily premium
- Summary daily premium
- Summary MBD (Monthly Bank Draft)

**Presentation Progress:**
- Milestones reached (intro → sponsorship → needs_analysis → plan_generator → benefits_summary → finish)
- Furthest milestone
- Duration spent in each section
- Was it an actual presentation? (needs_analysis or beyond)

**Sales Outcome:**
- Disposition (ENROLLMENT, NOT INTERESTED, CANT AFFORD, POSTPONED, etc.)
- Market type (VETERAN, GLOBE MARKET, OTHER)
- Selected plan (ENHANCED, RECOMMENDED, BASIC, NONE)
- Products discussed/sold

## HPPRO-Specific Fields to Train On

### 1. **Lead Selection Page**
Look for:
- State dropdown
- Lead type/market (Veteran, Medicare, etc.)
- Lead search/selection

### 2. **Client Info Form**
Extract from inputs with these patterns:
```javascript
// Look for input names like:
- firstName, first_name, clientFirstName
- lastName, last_name, clientLastName
- phone, phoneNumber, client_phone
- email, clientEmail
- age, dateOfBirth, dob
- address, street, city, state, zip
- spouseFirstName, spouseLastName
```

### 3. **Sponsorship/No Cost Benefits**
Look for:
- Sponsor name fields
- Organization name
- Military branch (for Veterans)
- Group affiliation

### 4. **Plan Generator**
Extract:
- Selected coverage amounts
- Plan type selected (checkboxes/radio buttons)
- Product checkboxes (ALP, AHP, Cancer, etc.)

### 5. **Premium Summary**
Look for dollar amounts in these patterns:
```javascript
// Text patterns:
- "$123.45 daily"
- "$45.67 per month"
- "ALP: $50.00"
- "Total: $X.XX"

// Field names:
- dailyPremium, monthlyPremium
- alpAmount, ahpAmount
- totalPremium, combinedPremium
```

### 6. **E-App/Enrollment**
Check for:
- Signature fields
- Payment method inputs
- Beneficiary information
- Health questions answered

## Training Improvements Needed

### A. Better Form Field Detection

Current:
```javascript
fields: Array.from(form.elements).map(el => ({
  name: el.name,
  type: el.type,
  value: el.value
}))
```

Improved:
```javascript
fields: Array.from(form.elements).map(el => ({
  name: el.name,
  id: el.id,
  type: el.type,
  value: el.type === 'password' ? '[REDACTED]' : el.value,
  label: el.labels?.[0]?.innerText || el.placeholder || '',
  checked: el.checked,
  selected: el.selected
}))
```

### B. Extract Visible Text Blocks

Add extraction of key data displays:
```javascript
visibleData: {
  // All div/span elements with class containing "premium", "price", "total"
  premiumDisplays: [...document.querySelectorAll('[class*="premium"], [class*="price"], [class*="total"]')]
    .map(el => ({
      class: el.className,
      text: el.innerText,
      html: el.innerHTML
    })),
  
  // Client name displays
  clientDisplays: [...document.querySelectorAll('[class*="client"], [class*="name"]')]
    .filter(el => el.innerText.length < 100)
    .map(el => el.innerText)
}
```

### C. Track Page Navigation

Add URL tracking to detect milestone progression:
```javascript
// Track when URL changes to know which section they're in
const urlPatterns = {
  'lead-selection': /#\/lead/,
  'client-info': /#\/client|#\/info/,
  'sponsorship': /#\/sponsor|#\/benefits/,
  'plan-generator': /#\/plan|#\/quote/,
  'summary': /#\/summary|#\/review/,
  'enrollment': /#\/enroll|#\/eapp|#\/application/
};
```

## Testing the Scraper

### Manual Test:
1. Open HPPRO in desktop app
2. Check console logs for scraped data
3. Verify all fields are captured
4. Check database for saved data

### Verify Extraction:
```sql
-- Check what's being scraped
SELECT 
  session_id,
  scraped_data->>'url' as url,
  scraped_data->>'title' as title,
  jsonb_array_length(scraped_data->'forms') as form_count,
  created_at
FROM scraped_presentation_data
ORDER BY created_at DESC
LIMIT 10;
```

## Next Steps

**What specific fields are you having trouble extracting?**

I can:
1. Add more specific selectors for HPPRO fields
2. Improve form field labeling
3. Add better premium amount detection
4. Track page transitions better
5. Extract specific HPPRO element IDs/classes

**Show me an example HPPRO page or tell me what fields to focus on!**

