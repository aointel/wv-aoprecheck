# Daily Workflow - Staging & Production (Existing Setup)

## 🎯 You Have:
- ✅ Staging server already configured
- ✅ Production server (master branch)
- ✅ Need to keep them separate

---

## 🚀 Quick Start - Create Staging Branch (One Time)

```bash
# Commit any current changes first
git add .
git commit -m "Current work before staging setup"

# Create staging branch from master
git checkout -b staging

# Push staging branch to GitHub
git push -u origin staging
```

**Configure your staging server to deploy from `staging` branch instead of `master`**

---

## 📋 Daily Workflow

### Every Day - Work on Staging

```bash
# 1. Start on staging branch
git checkout staging

# 2. Pull latest changes
git pull origin staging

# 3. Make your changes
# ... edit files, code features ...

# 4. Commit your work
git add .
git commit -m "Feature: Description of what you did"

# 5. Push to staging
git push origin staging
```

**Your staging server automatically deploys! ✅**

---

## 🚢 Deploy to Production (Approval Required!)

### ⚠️ NEVER push directly to master!

### After testing in staging, use the deployment script:

**Windows:**
```bash
.\deploy-to-production.bat
```

**Mac/Linux:**
```bash
./deploy-to-production.sh
```

**The script will:**
1. ✅ Verify you tested in staging
2. ✅ Require approver name
3. ✅ Require confirmation: "DEPLOY TO PRODUCTION"
4. ✅ Safely merge staging to master
5. ✅ Push to production
6. ✅ Return you to staging branch

**Your production server automatically deploys! ✅**

See `PRODUCTION_DEPLOYMENT_APPROVAL.md` for full approval process.

---

## 🔄 Simple Commands

### Check which branch you're on:
```bash
git branch
# * staging  ← asterisk shows current branch
#   master
```

### Switch branches:
```bash
git checkout staging     # Work on staging
git checkout master      # Deploy to production
```

### Current status:
```bash
git status
```

---

## ⚡ Super Quick Reference

```bash
# Work on staging (do this daily)
git checkout staging
git pull
# ... make changes ...
git add .
git commit -m "message"
git push

# Deploy to production (after testing)
git checkout master
git pull
git merge staging
git push
git checkout staging  # back to work
```

---

## 🛡️ Safety Rules

1. **Always work on `staging` branch**
2. **Never push directly to `master`**
3. **Test in staging before merging to master**
4. **Keep staging and master separate**

---

## 📊 Your Setup

```
Local Computer
    ↓
    git push origin staging
    ↓
GitHub (staging branch)
    ↓
    Auto-deploy
    ↓
aoirail-beta-staging.up.railway.app ← Test here first!
    
    ↓ (after testing)
    
    git checkout master
    git merge staging
    git push origin master
    ↓
GitHub (master branch)
    ↓
    Auto-deploy
    ↓
aoirail-production.up.railway.app ← Live users!
```

## 🌐 Your Server URLs

**Staging:** https://aoirail-beta-staging.up.railway.app
**Production:** https://aoirail-production.up.railway.app

---

## 🆘 Emergency Commands

### Undo last commit (keep changes):
```bash
git reset --soft HEAD~1
```

### See recent commits:
```bash
git log --oneline -5
```

### Discard all local changes:
```bash
git checkout -- .
```

### Start fresh from remote:
```bash
git fetch origin
git reset --hard origin/staging
```

---

## ✅ Before You Start Today

Run this once to set up staging:

**Windows:**
```bash
.\setup-staging-branch.bat
```

**Mac/Linux:**
```bash
chmod +x setup-staging-branch.sh
./setup-staging-branch.sh
```

Or manually:
```bash
git checkout -b staging
git push -u origin staging
```

Then configure your staging server to deploy from the `staging` branch.

---

**Remember:** 
- `staging` = your daily workspace ✏️
- `master` = production only 🚫

