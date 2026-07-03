# Production & Dev Environment Setup

## Overview
- **Master Branch** = Production (LIVE) - Protected, requires approval
- **Dev Branch** = Development - Separate Railway instance for testing

## Step 1: Protect Master Branch (GitHub)

### Via GitHub Web UI:
1. Go to: `https://github.com/aointel/AOIrail/settings/branches`
2. Under "Branch protection rules", click "Add rule"
3. Branch name pattern: `master`
4. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require approvals (set to 1 or more)
   - ✅ Require status checks to pass before merging
   - ✅ Do not allow bypassing the above settings
   - ✅ Include administrators (optional - if you want even admins to need approval)
5. Click "Create"

### Via GitHub CLI:
```bash
gh api repos/aointel/AOIrail/branches/master/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":[]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}' \
  --field restrictions=null
```

## Step 2: Set Up Dev Branch Locally

```bash
# Checkout dev branch (or create if it doesn't exist locally)
git checkout dev

# If dev doesn't exist locally, create it from remote
git checkout -b dev origin/dev

# Make sure it's up to date
git pull origin dev
```

## Step 3: Create Separate Railway Project for Dev

### Option A: Via Railway Web UI (Easiest)
1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose repository: `aointel/AOIrail`
5. **IMPORTANT**: In deployment settings:
   - Branch: `dev` (not `master`)
   - Root Directory: `/` (or leave default)
6. Name the project: `AOIrail-Dev` (or similar)
7. Click "Deploy"

### Option B: Via Railway CLI
```bash
# Login to Railway
railway login

# Create new project for dev
railway init --name aoirail-dev

# Link to the project
railway link

# Set the branch to deploy from
railway variables set RAILWAY_GIT_BRANCH=dev

# Or configure in Railway dashboard:
# Settings > Source > Branch: dev
```

## Step 4: Configure Dev Environment Variables

In Railway Dev project, add all the same environment variables as production, but you can:
- Use different database (optional - can use same Supabase)
- Use different Twilio test credentials (optional)
- Set `NODE_ENV=development` (or keep as `production` for testing)

### Required Variables (same as production):
```
NODE_ENV=development
PORT=5000
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
SESSION_SECRET=...
```

## Step 5: Workflow Going Forward

### For Development Work:
```bash
# 1. Make sure you're on dev branch
git checkout dev

# 2. Make your changes
# ... edit files ...

# 3. Commit to dev
git add .
git commit -m "Your dev changes"
git push origin dev

# 4. Railway Dev will auto-deploy from dev branch
```

### For Production Deployment:
```bash
# 1. Make sure dev is tested and working
git checkout dev
# Test everything works

# 2. Create a pull request
# Go to GitHub: https://github.com/aointel/AOIrail/compare/master...dev
# Or use GitHub CLI:
gh pr create --base master --head dev --title "Deploy to Production" --body "Changes ready for production"

# 3. Get approval (required by branch protection)

# 4. Merge PR (this will update master)
# Railway Production will auto-deploy from master branch
```

## Step 6: Configure Railway Auto-Deploy

### Production Railway Project:
- Settings > Source > Branch: `master`
- Auto-deploy: Enabled

### Dev Railway Project:
- Settings > Source > Branch: `dev`
- Auto-deploy: Enabled

## Branch Protection Summary

**Master Branch:**
- ✅ Protected from direct pushes
- ✅ Requires pull request
- ✅ Requires approval before merge
- ✅ Auto-deploys to Production Railway

**Dev Branch:**
- ✅ Free to push/commit
- ✅ Auto-deploys to Dev Railway
- ✅ Used for all development work

## Quick Reference

```bash
# Switch to dev for development
git checkout dev

# Switch to master (read-only, use PRs)
git checkout master

# View current branch
git branch

# Push to dev (allowed)
git push origin dev

# Push to master (BLOCKED - must use PR)
git push origin master  # ❌ Will fail if protection is enabled
```

## Emergency Production Fix

If you need to hotfix production immediately:

1. **Option 1: Temporarily disable protection** (not recommended)
   - GitHub Settings > Branches > Edit master protection > Disable temporarily
   - Push fix
   - Re-enable protection

2. **Option 2: Use GitHub UI to merge** (recommended)
   - Create PR from dev to master
   - Approve your own PR (if you're admin)
   - Merge immediately

3. **Option 3: Force merge via GitHub API** (last resort)
   ```bash
   gh pr create --base master --head dev --title "Hotfix" --body "Emergency fix"
   gh pr merge <PR_NUMBER> --admin --merge
   ```
