# AWS Outage Banner - Instructions

## Overview
A prominent banner has been added to alert users about the current AWS outage affecting the application.

## Location
**File:** `client/src/App.tsx`  
**Lines:** 910-927

## Banner Features
- **Fixed position** at the top of all pages
- **High z-index (9999)** to appear above all content
- **Gradient background** (red to orange) for high visibility
- **Animated warning icon** (pulsing)
- **Responsive design** works on all screen sizes
- **Clear messaging** about AWS outage affecting USA businesses

## How to Remove the Banner

When AWS services are restored and the outage is resolved:

1. Open `client/src/App.tsx`
2. Find and **DELETE** lines 910-927:
   ```tsx
   {/* AWS Outage Banner */}
   <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 via-orange-600 to-red-600 text-white shadow-2xl">
     ...entire banner div...
   </div>
   {/* Add padding to prevent content from being hidden under the banner */}
   <div className="pt-28"></div>
   ```

3. Save the file
4. The banner will disappear immediately (no rebuild needed in development)

## How to Modify the Banner Message

To change the banner text:

1. Open `client/src/App.tsx`
2. Find line 919: `<p className="font-bold text-lg">⚠️ SYSTEM ALERT - AWS OUTAGE</p>`
3. Find line 920: `<p className="text-sm opacity-90">The application is currently experiencing issues...</p>`
4. Update the text as needed

### Example - Change to "Resolved" message:
```tsx
<p className="font-bold text-lg">✅ SYSTEM RESTORED</p>
<p className="text-sm opacity-90">AWS services have been restored. The application is now fully operational.</p>
```

And change the background color from red to green:
```tsx
<div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 text-white shadow-2xl">
```

## Banner Colors

Change the banner severity by modifying the background gradient:

- **Critical/Outage:** `from-red-600 via-orange-600 to-red-600` (current)
- **Warning:** `from-yellow-600 via-amber-600 to-yellow-600`
- **Info:** `from-blue-600 via-cyan-600 to-blue-600`
- **Success/Resolved:** `from-green-600 via-emerald-600 to-green-600`

## Visual Preview

The banner appears as:
```
⚠️ SYSTEM ALERT - AWS OUTAGE
The application is currently experiencing issues due to an ongoing AWS 
outage affecting businesses throughout the USA. We are monitoring the 
situation and services will be restored as soon as AWS resolves the issue.
```

## Technical Details

- **Component:** Rendered in `AppWithAccountability` function
- **Applies to:** All pages (logged in and logged out)
- **Position:** Fixed at top with 28 units of padding below
- **Animation:** Warning icon pulses to draw attention
- **Responsive:** Uses Tailwind container classes for mobile/desktop

## Quick Commands

### Remove Banner (Terminal)
```bash
# Open file in editor
code client/src/App.tsx

# Or use sed to remove lines (backup recommended)
# Manually remove lines 910-927
```

## Notes
- The banner loads immediately when users open the app
- No page refresh needed after removal in development mode
- Production deploy required for production users to see changes
- Banner does not block any functionality, purely informational

