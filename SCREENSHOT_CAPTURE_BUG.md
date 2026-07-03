# Screenshot Capture Bug - Not Working for All Users

## Problem
- **Patricia** has v1.0.3, session active 5+ minutes, **ZERO screenshots**
- **Leyna** has v1.0.3, screenshots ARE working
- Both have the same version, but inconsistent behavior

## Root Cause
The screenshot capture in `electron/screenshotCapture.cjs` (lines 72-87) searches for windows by name:

```javascript
source = sources.find(s => 
  s.name.toLowerCase().includes('hp-pro') || 
  s.name.toLowerCase().includes('hppro') ||
  s.name.toLowerCase().includes('aoi presentation') ||
  s.name.toLowerCase().includes('presentation')
);

if (!source) {
  console.log('⚠️ HPPRO window not found. Available windows:');
  // ... logs available windows ...
  console.log('❌ Skipping screenshot - HPPRO window not detected');
  return null; // ← NO SCREENSHOT CAPTURED
}
```

**This is FRAGILE:**
- If the HPPRO window title changes, screenshots stop working
- Different HPPRO pages might have different window titles
- The window title might include the client name or other dynamic text

## Solution
Instead of searching by window name, we should:

1. **Pass the actual window object** from the presentation detection code
2. **Get the window ID** when HPPRO is detected
3. **Use that specific window ID** for screenshots

The code already passes `targetWindow` to `startCapture()` but then **ignores it** and searches by name instead!

## Fix Required
Modify `electron/screenshotCapture.cjs` to:
1. Store the `targetWindow` parameter
2. Use the window's ID/title directly instead of searching
3. Fall back to search only if no targetWindow is provided

## Immediate Workaround
Add MORE window title patterns to the search:
- Add actual HPPRO window titles
- Make it case-insensitive
- Search for partial matches more broadly
- Log ALL available window titles when detection fails (for debugging)

## Testing
After fix, verify:
1. Patricia's presentations capture screenshots
2. ALL agents with v1.0.3 get screenshot capture
3. VIEW button appears on Live Board for all active presentations

