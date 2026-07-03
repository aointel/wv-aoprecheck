# Fix: Screenshot Analysis Not Running

## 🔴 The Problem

Screenshots showing as "PENDING" with "—" in Screenshot AI column means:
- Screenshots ARE uploaded
- But `screenshot_analysis_complete` is NULL/false
- Scheduler isn't finding/processing them

---

## 🐛 Root Cause

The scheduler query had a logic issue:

**Before:**
```typescript
.or('screenshot_url.not.is.null,screenshot_path.not.is.null')
.neq('screenshot_url', 'PENDING')
```

**Problem:**
- `.neq('screenshot_url', 'PENDING')` only checks `screenshot_url`
- If `screenshot_url = 'PENDING'` but `screenshot_path` has the actual screenshot, it might be excluded
- The query logic wasn't properly handling both fields

---

## ✅ The Fix

### 1. Fixed Query Logic

**After:**
```typescript
.or('and(screenshot_url.not.is.null,screenshot_url.neq.PENDING),and(screenshot_path.not.is.null,screenshot_path.neq.PENDING)')
```

**What this does:**
- Finds sessions where EITHER:
  - `screenshot_url` is NOT NULL AND != 'PENDING' (has real URL)
  - OR `screenshot_path` is NOT NULL AND != 'PENDING' (has real path)
- Properly excludes 'PENDING' from both fields

### 2. Added Extra Filtering

Added JavaScript filter to double-check:
```typescript
const hasScreenshot = (session.screenshot_url && session.screenshot_url !== 'PENDING') ||
                       (session.screenshot_path && session.screenshot_path !== 'PENDING');
const needsAnalysis = session.screenshot_analysis_complete === null || 
                      session.screenshot_analysis_complete === false;
return hasScreenshot && needsAnalysis;
```

---

## 🔍 Why It Wasn't Working

1. **Sessions created** with `screenshot_url = 'PENDING'`
2. **Screenshots uploaded** → `screenshot_path` gets set, but `screenshot_url` might still be 'PENDING'
3. **Scheduler query** excluded sessions where `screenshot_url = 'PENDING'` even if `screenshot_path` had the screenshot
4. **Result**: Sessions never analyzed

---

## 🚀 How It Works Now

1. **Scheduler runs every 30 minutes**
2. **Finds sessions** with actual screenshots (not 'PENDING')
3. **Downloads screenshot** from storage
4. **Calls AI** to analyze
5. **Updates database** with results:
   - `screenshot_validation` = AI results
   - `screenshot_analysis_complete` = true
   - `screenshot_analysis_confidence` = confidence score

---

## ⚠️ Important Notes

- **Scheduler is running** (started in `server/index.ts` line 617)
- **Runs every 30 minutes** - so new screenshots might take up to 30 min to analyze
- **If analysis fails**, it retries once, then marks as failed
- **Check logs** for "📸 Processing X session(s) for screenshot analysis" to confirm it's running

---

## 🔧 Manual Trigger (If Needed)

If you need to analyze screenshots immediately:

```bash
node server/manual-screenshot-analysis.ts
```

Or create an API endpoint to trigger analysis manually.
