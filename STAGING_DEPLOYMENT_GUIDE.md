# Staging/Beta Deployment Guide

## Overview
This guide explains how to deploy changes to the **staging/beta environment** instead of production.

## 🎯 Quick Start

### For Railway Deployment (Recommended)

**Windows:**
```bash
./deploy-railway-staging.bat
```

**Mac/Linux:**
```bash
chmod +x deploy-railway-staging.sh
./deploy-railway-staging.sh
```

### For Google Cloud Run

**Build for staging:**
```bash
chmod +x deploy-staging.sh
./deploy-staging.sh
```

**Deploy to staging:**
```bash
gcloud app deploy app.staging.yaml --project=YOUR_PROJECT_ID --version=staging
```

## 📋 Deployment Workflow

### 1. Make Your Changes
- Develop and test locally as usual
- Commit your changes to git

### 2. Deploy to Staging
- Use the staging deployment scripts (see above)
- Verify deployment was successful

### 3. Test in Staging
- Test all new features thoroughly
- Check for bugs or issues
- Get stakeholder approval

### 4. Deploy to Production (Only After Staging Approval)
- Only after staging tests pass
- Use production deployment scripts

## 🔧 Setup Instructions

### Railway Setup (Recommended)

1. **Create Staging Service in Railway:**
   ```bash
   railway login
   railway init
   ```

2. **Create a new service called "staging":**
   - Go to Railway dashboard
   - Create a new service named "staging"
   - Link it to your repository
   - Set environment variables for staging

3. **Deploy to staging:**
   ```bash
   railway up --service staging
   ```

### Environment Variables

Make sure to set these variables in your Railway staging service:

- `NODE_ENV=staging`
- `DATABASE_URL=<your-staging-database-url>`
- `SUPABASE_URL=<your-staging-supabase-url>`
- `SUPABASE_ANON_KEY=<your-staging-key>`
- `TWILIO_ACCOUNT_SID=<your-twilio-sid>`
- `TWILIO_AUTH_TOKEN=<your-twilio-token>`
- Any other environment-specific variables

## 🚨 Important Notes

### DO NOT Deploy Directly to Production
- Always deploy to staging first
- Test thoroughly in staging
- Get approval before production deployment

### Separate Databases
- Use separate databases for staging and production
- Never point staging to production database
- Use test data in staging

### Staging URL
- Railway: `https://your-app-staging.railway.app`
- GCloud: `https://staging-dot-your-project.appspot.com`

## 📦 NPM Scripts

Add these to your workflow:

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production (use with caution!)
npm run deploy:production
```

## 🔄 Git Branch Strategy (Optional)

Consider using branches:
- `main` or `master` → Production
- `staging` or `beta` → Staging environment
- `develop` → Development work

### Workflow:
1. Develop in feature branches
2. Merge to `staging` branch → Auto-deploy to staging
3. Test in staging
4. Merge `staging` to `main` → Manual deploy to production

## 🛠 Rollback Procedure

If something goes wrong in staging:

**Railway:**
```bash
railway rollback --service staging
```

**GCloud:**
```bash
gcloud app versions list
gcloud app versions stop VERSION_ID
```

## 📞 Support

If you need help with deployment:
1. Check Railway/GCloud logs
2. Review environment variables
3. Verify database connectivity
4. Check service status

---

**Remember:** Staging is your safety net. Always test there first! 🛡️

