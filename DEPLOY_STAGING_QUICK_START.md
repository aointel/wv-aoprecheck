# 🧪 Quick Start: Deploy to Staging Only

## TL;DR - What You Need to Do

**To deploy to staging (beta) instead of production:**

### Windows Users:
```bash
npm run deploy:staging
```
or double-click: `deploy-railway-staging.bat`

### Mac/Linux Users:
```bash
npm run deploy:staging
```

---

## Setup (One-Time Only)

### 1. Install Railway CLI (if not already installed)
```bash
npm install -g @railway/cli
```

### 2. Login to Railway
```bash
railway login
```

### 3. Create Staging Environment in Railway Dashboard

1. Go to https://railway.app/dashboard
2. Open your project
3. Click "New Service" or add a new environment
4. Name it **"staging"** or **"beta"**
5. Link it to your repository
6. Set environment variables:
   - `NODE_ENV=staging`
   - Copy all production variables but use staging database URLs
   - Use test Twilio numbers, test Supabase instances, etc.

---

## Daily Workflow

### ✅ Deploy to Staging (Do This)
```bash
npm run deploy:staging
```

### ❌ DO NOT Deploy to Production
```bash
# Don't use this anymore without approval:
npm run deploy:production
```

---

## Testing Your Changes

1. **Deploy to staging:**
   ```bash
   npm run deploy:staging
   ```

2. **Get your staging URL:**
   ```bash
   railway domain --service staging
   ```

3. **Test thoroughly:**
   - Check all new features
   - Verify database changes
   - Test with real scenarios
   - Get approval from team

4. **Only then, deploy to production:**
   - Get approval first
   - Use `npm run deploy:production` carefully

---

## Environment URLs

After setup, you'll have:
- **Staging:** `https://your-app-staging.railway.app`
- **Production:** `https://your-app-production.railway.app`

Always test in staging first! 🛡️

---

## Troubleshooting

**"Railway not found":**
```bash
npm install -g @railway/cli
railway login
```

**"Service not found":**
- Create a "staging" service in Railway dashboard
- Make sure you're logged in: `railway whoami`

**"Build failed":**
- Check Railway logs: `railway logs --service staging`
- Verify environment variables are set

---

## Need Help?

See full documentation: `STAGING_DEPLOYMENT_GUIDE.md`

