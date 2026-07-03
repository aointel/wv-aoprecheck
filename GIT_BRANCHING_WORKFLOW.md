# Git Branching Workflow - Staging & Production

## 🌳 Branch Structure

```
master (production)    ← Production-ready code, deployed to Railway production
  ↑
  └── staging          ← Development work, deployed to Railway staging
        ↑
        └── feature-*  ← Individual features (optional)
```

## 🚀 Quick Setup (One-Time)

### Step 1: Create Staging Branch
```bash
# Create staging branch from current master
git checkout -b staging

# Push staging branch to GitHub
git push -u origin staging
```

### Step 2: Configure Railway for Staging
1. Go to Railway dashboard
2. Create a new service called "staging"
3. Connect to your GitHub repo
4. Set it to deploy from `staging` branch
5. Add environment variables (same as production but with staging URLs)

---

## 📋 Daily Workflow

### Working on New Features

```bash
# 1. Make sure you're on staging branch
git checkout staging

# 2. Pull latest changes
git pull origin staging

# 3. Make your changes
# ... edit files ...

# 4. Stage and commit
git add .
git commit -m "Description of changes"

# 5. Push to staging
git push origin staging
```

**Result:** Railway automatically deploys to staging environment ✅

---

### Deploying to Production (After Testing)

```bash
# 1. Make sure staging is working correctly
# Test at: https://your-app-staging.railway.app

# 2. Switch to master branch
git checkout master

# 3. Pull latest master
git pull origin master

# 4. Merge staging into master
git merge staging

# 5. Push to production
git push origin master
```

**Result:** Railway automatically deploys to production environment ✅

---

## 🔄 Common Scenarios

### Scenario 1: Daily Development Work
```bash
# Always work on staging
git checkout staging
git pull
# ... make changes ...
git add .
git commit -m "Feature: Add new functionality"
git push origin staging
```

### Scenario 2: Hotfix on Production
```bash
# Switch to master for urgent fixes
git checkout master
git pull

# Make the fix
# ... edit files ...

git add .
git commit -m "Hotfix: Critical bug fix"
git push origin master

# Merge hotfix back to staging
git checkout staging
git merge master
git push origin staging
```

### Scenario 3: Create Feature Branch (Optional)
```bash
# Branch from staging for big features
git checkout staging
git checkout -b feature-new-dashboard

# Work on feature
# ... make changes ...

# When done, merge back to staging
git checkout staging
git merge feature-new-dashboard
git push origin staging

# Delete feature branch
git branch -d feature-new-dashboard
```

---

## 🛡️ Branch Protection Rules

### Protect Master Branch (Recommended)

On GitHub:
1. Go to repo → Settings → Branches
2. Add rule for `master` branch
3. Enable:
   - ✅ Require pull request before merging
   - ✅ Require approvals (at least 1)
   - ✅ Require status checks to pass

**This prevents accidental pushes to production!**

---

## 📊 Workflow Diagram

```
Developer         Staging Branch           Production Branch
   │                    │                         │
   ├─ Make changes      │                         │
   ├─ Commit ──────────>│                         │
   ├─ Push ────────────>│                         │
   │                    │                         │
   │              Railway deploys                 │
   │              to staging ✓                    │
   │                    │                         │
   │              Test & Verify                   │
   │                    │                         │
   │              Ready for prod?                 │
   │                    │                         │
   ├─ Merge ────────────┼───────────────────────>│
   │                    │                         │
   │                    │                   Railway deploys
   │                    │                   to production ✓
   │                    │                         │
```

---

## 🎯 Best Practices

### ✅ DO:
- Work on `staging` branch for all new features
- Test thoroughly in staging before merging to master
- Use descriptive commit messages
- Pull before you push to avoid conflicts
- Keep staging and master in sync regularly

### ❌ DON'T:
- Push directly to master unless it's a hotfix
- Skip testing in staging
- Merge untested code to production
- Force push to master (`git push -f`)
- Work directly on master branch

---

## 🔧 Git Commands Reference

### Branch Management
```bash
# List all branches
git branch -a

# Switch branches
git checkout staging          # Switch to staging
git checkout master           # Switch to master

# Create new branch
git checkout -b feature-name  # Create and switch

# Delete branch
git branch -d feature-name    # Delete local branch
git push origin --delete feature-name  # Delete remote branch
```

### Syncing
```bash
# Pull latest changes
git pull origin staging
git pull origin master

# Fetch all branches
git fetch --all

# See what changed
git log staging..master       # Commits in master not in staging
git diff staging master       # Differences between branches
```

### Merging
```bash
# Merge staging into master
git checkout master
git merge staging

# Merge master into staging (sync back)
git checkout staging
git merge master
```

### Undoing Changes
```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo changes to a file
git checkout -- filename.js

# Discard all local changes
git reset --hard HEAD
```

---

## 🚨 Conflict Resolution

When you get merge conflicts:

```bash
# 1. Git will mark conflicts in files
# Look for:
<<<<<<< HEAD
Your changes
=======
Incoming changes
>>>>>>> staging

# 2. Edit files to resolve conflicts

# 3. Stage resolved files
git add .

# 4. Complete the merge
git commit -m "Resolved merge conflicts"

# 5. Push
git push
```

---

## 📦 Railway Configuration

### Production Service
```
Branch: master
Environment: production
Domain: aoirail-production.up.railway.app
```

### Staging Service
```
Branch: staging
Environment: staging
Domain: aoirail-staging.up.railway.app
```

### Environment Variables
Set these separately for each service:
- `NODE_ENV=production` (production) / `NODE_ENV=staging` (staging)
- Different database URLs if needed
- Same Twilio/Supabase credentials (or separate test accounts)

---

## 🧪 Testing Workflow

1. **Develop** on `staging` branch
2. **Push** to staging → Railway auto-deploys
3. **Test** on staging URL
4. **Verify** everything works
5. **Merge** to master → Railway auto-deploys to production
6. **Verify** production
7. **Celebrate** 🎉

---

## 📱 Quick Commands

### Start Your Day
```bash
git checkout staging
git pull origin staging
```

### End of Feature Work
```bash
git add .
git commit -m "Feature: Description"
git push origin staging
```

### Deploy to Production
```bash
git checkout master
git merge staging
git push origin master
git checkout staging  # Back to staging for next work
```

---

## 🆘 Emergency Rollback

If production breaks:

```bash
# Find the last good commit
git log

# Revert to it
git checkout master
git reset --hard <commit-hash>
git push origin master --force  # Only for emergencies!
```

**Better approach:** Fix forward on staging, test, then deploy

---

## 📞 Support

If you need help:
1. Check branch you're on: `git branch`
2. Check status: `git status`
3. Check recent commits: `git log --oneline -5`
4. If stuck, don't force push - ask for help!

---

**Remember:** `staging` is your playground, `master` is sacred! 🛡️

