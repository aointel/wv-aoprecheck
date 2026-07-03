# 🚀 Electron App Rollout Plan - Version 1.0.3

## ✅ What's Implemented

### **1. Auto HPPRO Tracking** 
- ✅ Detects when agents open `hppro.planetaltig.com`
- ✅ Auto-starts screenshot capture (every 30 seconds)
- ✅ Auto-starts page scraping (every 10 seconds)
- ✅ Uploads screenshots to Live Board automatically
- ✅ Tracks all presentation activity in database

### **2. Page Scraping**
- ✅ Captures URL, title, text content
- ✅ Captures forms, links, images, headings
- ✅ Sends to `/api/presentations/scrape-data`
- ✅ Tracks navigation through presentation

### **3. Version Enforcement**
- ✅ Server rejects old versions (< 1.0.3)
- ✅ Shows update dialog with download link
- ✅ Forces app to quit if too old

---

## 📦 Distribution Files

### **Location:** `electron-dist/` and `public/uploads/installers/`

1. **`ConnectNow-Setup.exe`** (NSIS Installer)
   - Full installer with uninstaller
   - Creates Start Menu shortcuts
   - Creates Desktop shortcut
   - ~130 MB

2. **`ConnectNow.exe`** (Portable)
   - No installation needed
   - Run from any location
   - ~130 MB

---

## 🔄 How to Force Everyone to Update

### **Step 1: Deploy to Production**
```bash
# Commit the changes
git add .
git commit -m "Version 1.0.3 with HPPRO tracking and version enforcement"
git push origin master

# Railway auto-deploys from master branch
```

### **Step 2: What Happens Automatically**

**When users log in via web browser:**
- ✅ See prominent update banner at top
- ✅ "Download Now" button → downloads page
- ✅ Banner dismisses for 24 hours then reappears

**When users try to use old Electron app:**
- ❌ App gets rejected by server (HTTP 426)
- ❌ Error dialog shows: "Update Required"
- ❌ App force-quits
- ✅ Dialog shows download link

---

## 📧 Communication Plan

### **Email Template:**

```
Subject: 🚀 ACTION REQUIRED: Update AO Intelligence Desktop App

Hi Team,

We've released a major update to the AO Intelligence Desktop App (Version 1.0.3) with powerful new features:

✅ AUTOMATIC HPPRO TRACKING
   • Screenshots captured every 30 seconds
   • Visible on Live Board in real-time
   • No manual start needed!

✅ FULL PAGE SCRAPING
   • Tracks every slide viewed
   • Captures form interactions
   • Complete presentation analytics

✅ ENHANCED PERFORMANCE
   • Faster startup
   • Reduced memory usage
   • Better stability

🔴 IMPORTANT: Old versions will stop working on [DATE]

👉 Download Now:
   • Windows Installer: https://aoirail-production.up.railway.app/downloads
   • Portable Version: Also available on downloads page

Installation takes 2 minutes. Please update before [DATE].

Questions? Reply to this email.

Thanks!
[Your Name]
```

### **Slack/Teams Announcement:**

```
@channel 🚨 MANDATORY APP UPDATE

New desktop app (v1.0.3) is live with automatic HPPRO tracking!

🎯 What's New:
• Auto-capture screenshots during presentations
• Live Board shows current slide
• Enhanced performance

📅 Deadline: [DATE]
📥 Download: https://aoirail-production.up.railway.app/downloads

Old versions will stop working after deadline. Update now! ⚡
```

---

## 📊 Monitoring Rollout

### **Check Who's Updated:**

Run this query in Supabase or database:

```sql
-- See who's using the new version
SELECT DISTINCT 
  agent_email,
  MAX(created_at) as last_seen
FROM presentation_sessions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY agent_email
ORDER BY last_seen DESC;
```

### **Check Version Rejections:**

Look for these in server logs:
```
❌ OLD APP VERSION DETECTED: 1.0.2 (minimum: 1.0.3)
```

---

## 🎯 Rollout Timeline

### **Day 1-2: Soft Launch**
- ✅ Update banner shows for web users
- ✅ Old Electron still works
- ✅ Send announcement email

### **Day 3-5: Grace Period**
- ✅ Follow up with non-updaters
- ✅ Test enforcement in staging
- ✅ Old versions still work

### **Day 6: Enforcement**
- ✅ Activate version enforcement
- ❌ Old Electron apps rejected
- ✅ Users must update to continue

### **Day 7+: Full Rollout**
- ✅ Everyone on v1.0.3
- ✅ HPPRO tracking active for all
- ✅ Live Board fully populated

---

## 🔧 Technical Details

### **Files to Deploy:**

1. **Server-side:**
   - `server/version-enforcement.ts` (updated)
   - `server/routes.ts` (adds middleware)

2. **Client-side:**
   - `client/src/components/UpdateBanner.tsx` (new)
   - `client/src/App.tsx` (updated)
   - `client/src/pages/Downloads.tsx` (bilingual)

3. **Installers:**
   - `public/uploads/installers/ConnectNow-Setup.exe`
   - `public/uploads/installers/ConnectNow.exe`

### **Electron App Features:**

- **Auto-detection:** Opens `hppro.planetaltig.com` → tracking starts
- **Screenshot interval:** 30 seconds
- **Scrape interval:** 10 seconds
- **Upload endpoint:** `/api/presentations/screenshot`
- **Scrape endpoint:** `/api/presentations/scrape-data`
- **Version header:** `X-App-Version: 1.0.3`

---

## ✅ Verification Checklist

Before enforcement:
- [ ] Test installer on fresh Windows machine
- [ ] Test portable version
- [ ] Verify old version gets rejected (< 1.0.3)
- [ ] Verify new version passes (1.0.3)
- [ ] Test HPPRO auto-tracking
- [ ] Test Live Board screenshot display
- [ ] Test download page (English/Español)
- [ ] Send test emails
- [ ] Post in Slack/Teams

After enforcement:
- [ ] Monitor server logs for rejections
- [ ] Check Live Board for active presentations
- [ ] Verify all agents updated
- [ ] Respond to support requests

---

## 🆘 Support Issues

### **"I can't install the app"**
→ Use portable version (`ConnectNow.exe`) - no install needed

### **"Installer hangs at 70%"**
→ Copy installer to `C:\Temp\` first, run from there (not OneDrive)

### **"App won't start"**
→ Run portable version directly

### **"App says update required but I just updated"**
→ Check version in Help menu - must be 1.0.3 or higher

### **"HPPRO tracking not working"**
→ Must be logged in BEFORE opening HPPRO
→ Check console logs: Should see "✅ PRESENTATION WINDOW DETECTED"

---

## 📈 Success Metrics

Track these after rollout:
- [ ] 100% of agents on v1.0.3
- [ ] HPPRO presentations showing on Live Board
- [ ] Screenshots captured for all presentations
- [ ] Page scraping data in database
- [ ] Zero version rejection errors

---

## 🎉 Next Steps

1. **Test everything** locally with the built app
2. **Deploy to Railway** (git push master)
3. **Wait 5 minutes** for deployment
4. **Test on staging** with old version
5. **Send announcements** to team
6. **Set deadline** (recommend 5-7 days)
7. **Monitor progress** via database queries
8. **Activate enforcement** on deadline day

---

**Current Status:** Ready to deploy! 🚀
**Installers Location:** `electron-dist/` and `public/uploads/installers/`
**Download Page:** `/downloads` (bilingual EN/ES)

