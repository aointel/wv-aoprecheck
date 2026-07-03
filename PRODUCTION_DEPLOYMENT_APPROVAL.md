# 🚨 Production Deployment - Approval Required

## ⛔ NEVER Push Directly to Master

**Rule:** All production deployments require approval and must use the deployment script.

---

## ✅ Pre-Deployment Checklist

Before requesting approval, ensure:

- [ ] **Feature is complete** and tested locally
- [ ] **Pushed to staging branch** (`git push origin staging`)
- [ ] **Tested on staging server:** `aoirail-beta-staging.up.railway.app`
- [ ] **No console errors** in browser DevTools
- [ ] **All critical features work:**
  - [ ] Login/Signup flows
  - [ ] Dashboard loads
  - [ ] Calling functionality
  - [ ] Lead management
  - [ ] Any new features added
- [ ] **Railway staging logs** show no errors
- [ ] **Database changes** tested (if applicable)
- [ ] **Webhooks tested** in staging (if applicable)
- [ ] **Code reviewed** (if team review process exists)

---

## 👤 Who Can Approve?

List authorized approvers here:
- **Michael Mandella** - Owner
- **[Add other authorized names]**

---

## 🚀 Deployment Process

### Step 1: Get Approval

Contact an authorized approver and get verbal/written approval.

Example message:
```
"Ready to deploy to production:
- Feature: [Description]
- Tested in staging: [URL]
- Test results: All passing
- Requesting approval from: [Name]"
```

### Step 2: Use Deployment Script

**DO NOT manually push to master!**

**Windows:**
```bash
.\deploy-to-production.bat
```

**Mac/Linux:**
```bash
chmod +x deploy-to-production.sh
./deploy-to-production.sh
```

The script will:
1. ✅ Check you're on the right branch
2. ✅ Verify staging is up to date
3. ✅ Require approver name entry
4. ✅ Require confirmation phrase: "DEPLOY TO PRODUCTION"
5. ✅ Merge staging to master safely
6. ✅ Push to production
7. ✅ Return you to staging branch

### Step 3: Monitor Deployment

After the script completes:

1. **Wait 2-3 minutes** for Railway to deploy
2. **Test production URL:** `https://aoirail-production.up.railway.app`
3. **Check Railway logs** for deployment status
4. **Verify key features** work in production
5. **Monitor for errors** for 10-15 minutes

---

## 🛡️ Safety Features

### The Deployment Script Prevents:

- ❌ Accidental direct pushes to master
- ❌ Deploying without approval
- ❌ Deploying with uncommitted changes
- ❌ Deploying without testing in staging
- ❌ Deploying from wrong branch

### The Script Requires:

- ✅ Approver name (logged in commit message)
- ✅ Exact confirmation phrase
- ✅ Staging branch to be up to date
- ✅ Multi-step confirmation process

---

## ⚠️ Emergency Hotfix Process

For critical production bugs:

### 1. Create Hotfix
```bash
# From master branch
git checkout master
git checkout -b hotfix-description

# Make the fix
# ... edit files ...

# Commit
git add .
git commit -m "Hotfix: Description of critical fix"
```

### 2. Get Emergency Approval
Contact authorized approver immediately.

### 3. Deploy Hotfix
```bash
# Merge to master
git checkout master
git merge hotfix-description

# Deploy (with approval)
./deploy-to-production.sh

# Sync back to staging
git checkout staging
git merge master
git push origin staging

# Delete hotfix branch
git branch -d hotfix-description
```

---

## 🚫 What NOT to Do

### ❌ NEVER do these:

```bash
# DON'T push directly to master
git checkout master
git push origin master  # ❌ NO!

# DON'T force push to master
git push -f origin master  # ❌ NEVER!

# DON'T skip the deployment script
git checkout master
git merge staging
git push  # ❌ Use the script instead!

# DON'T deploy without approval
# Even if it's "just a small change"  # ❌ Always get approval!
```

---

## 📋 Deployment Log Template

Keep a log of deployments (can be in Slack/Teams/Email):

```
Date: 2025-01-24
Time: 3:45 PM
Deployed by: [Your Name]
Approved by: [Approver Name]
Changes: 
  - Fixed signup page SPA routing
  - Added credit adjustment webhook
  - Updated staging deployment workflow
Staging tests: All passed
Production status: Deployed successfully
Issues: None
```

---

## 🔐 GitHub Branch Protection (Recommended)

To enforce approval at GitHub level:

1. Go to GitHub repo → **Settings** → **Branches**
2. Add rule for `master` branch:
   - ✅ Require a pull request before merging
   - ✅ Require approvals (1)
   - ✅ Require status checks to pass
   - ✅ Do not allow bypassing the above settings
3. Save

**With branch protection:**
- Can't push directly to master
- Must create Pull Request
- Must get approval
- Then merge via GitHub

---

## 📊 Deployment Workflow Diagram

```
Developer → Make changes on staging branch
    ↓
Push to staging
    ↓
Test on staging: aoirail-beta-staging.up.railway.app
    ↓
    Pass all tests?
    ↙        ↘
   NO        YES
   ↓          ↓
Fix issues   Request approval from authorized person
   ↓          ↓
   ↓       Got approval?
   ↓       ↙        ↘
   ↓      NO        YES
   ↓      ↓          ↓
   └──────┘      Run: ./deploy-to-production.sh
                     ↓
                Enter approver name
                     ↓
                Type confirmation phrase
                     ↓
              Deploy to production
                     ↓
         Wait 2-3 min for Railway deploy
                     ↓
            Test production URL
                     ↓
                Monitor ✓
```

---

## 🆘 Rollback Procedure

If production breaks after deployment:

### Quick Rollback:
```bash
# Switch to master
git checkout master

# Find last good commit
git log --oneline -10

# Revert to it
git revert <commit-hash>

# Push with approval
# (In emergency, contact approver immediately)
git push origin master
```

### Better: Fix Forward
1. Fix the issue on staging
2. Test thoroughly
3. Get approval
4. Deploy fix using deployment script

---

## 📞 Emergency Contacts

If deployment goes wrong:

- **Primary:** [Name] - [Phone/Email]
- **Secondary:** [Name] - [Phone/Email]
- **Railway Support:** https://railway.app/help

---

## ✅ Quick Reference

### Daily Work (No Approval Needed):
```bash
git checkout staging
git add .
git commit -m "message"
git push origin staging
```

### Production Deploy (Approval Required):
```bash
./deploy-to-production.sh
```

---

**Remember:** 
- Staging = Push freely ✅
- Production = Approval required 🚨
- When in doubt = Ask for approval ✅

