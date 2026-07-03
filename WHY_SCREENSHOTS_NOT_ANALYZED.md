# Why Screenshots Aren't Being Analyzed

## 🔴 The Problem

Screenshots showing as "—" (not analyzed) even though they're uploaded.

---

## 🐛 Root Causes Found

### 1. **Query Logic Bug** ✅ FIXED

**The Issue:**
- Scheduler query was: `.or('screenshot_url.not.is.null,screenshot_path.not.is.null').neq('screenshot_url', 'PENDING')`
- This excluded sessions where `screenshot_url = 'PENDING'` even if `screenshot_path` had the actual screenshot
- Sessions with screenshots weren't being found

**The Fix:**
- Changed query to fetch all sessions with screenshots
- Added JavaScript filter to properly check both `screenshot_url` AND `screenshot_path`
- Excludes 'PENDING' from both fields

### 2. **Scheduler Runs Too Infrequently** ✅ FIXED

**The Issue:**
- Scheduler ran every **30 minutes**
- If screenshot uploaded at minute 1, it waits 29 minutes to be analyzed
- Too slow for production use

**The Fix:**
- Changed to run every **5 minutes**
- Screenshots analyzed within 5 minutes of upload

### 3. **Immediate Analysis May Fail Silently**

**The Issue:**
- Upload endpoint tries to analyze immediately (lines 17087-17137)
- If it fails, it just logs a warning and relies on scheduler
- No retry mechanism if immediate analysis fails

**Status:**
- Scheduler will catch it within 5 minutes now
- But immediate analysis should still work

---

## ✅ Fixes Applied

1. **Fixed query logic** - Now properly finds sessions with screenshots
2. **Reduced scheduler interval** - 30 minutes → 5 minutes
3. **Better filtering** - JavaScript filter ensures only sessions with actual screenshots are processed

---

## 🔍 How to Verify It's Working

1. **Check server logs** for:
   ```
   📸 Processing X session(s) for screenshot analysis
   🤖 Analyzing screenshot with AI...
   ✅ Screenshot analyzed and MARKED COMPLETE
   ```

2. **Check database**:
   ```sql
   SELECT 
     id,
     agent_email,
     client_first_name,
     client_last_name,
     screenshot_url,
     screenshot_path,
     screenshot_analysis_complete,
     screenshot_validation,
     created_at
   FROM verification_sessions
   WHERE status = 'PENDING'
     AND (screenshot_url IS NOT NULL OR screenshot_path IS NOT NULL)
     AND screenshot_analysis_complete IS NULL
   ORDER BY created_at DESC
   LIMIT 10;
   ```

3. **Wait 5 minutes** after upload - scheduler should pick it up

---

## 🚀 Expected Behavior Now

1. **Screenshot uploaded** → Immediate analysis attempted
2. **If immediate fails** → Scheduler picks it up within 5 minutes
3. **Scheduler finds session** → Downloads screenshot → Analyzes with AI → Updates database
4. **UI updates** → Screenshot AI column shows results

---

## ⚠️ If Still Not Working

1. **Check if scheduler is running**:
   - Look for "✅ Verification analysis scheduler started" in server logs
   - Check `server/index.ts` line 617

2. **Check for errors**:
   - Look for "❌ Error fetching sessions for screenshot analysis"
   - Look for "❌ Failed to analyze screenshot"

3. **Manual trigger** (if needed):
   ```bash
   node server/manual-screenshot-analysis.ts
   ```
